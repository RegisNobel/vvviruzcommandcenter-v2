import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {Prisma} from "@prisma/client";

import recovery from "../lib/backups/meta-recovery-collection-fingerprints";

type Case = {
  model: string;
  fields: readonly string[];
  dateFields: readonly string[];
  integerFields: readonly string[];
  numberFields: readonly string[];
  nullableStringFields: readonly string[];
  select: string;
  canonical: (records: Record<string, unknown>[]) => Record<string, unknown>[];
  fingerprint: (records: Record<string, unknown>[]) => string;
};

const cases: Case[] = [
  {
    model: "MetaImportFileRow", fields: recovery.META_IMPORT_FILE_ROW_RECOVERY_FIELDS,
    dateFields: recovery.META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS, integerFields: ["sourceRowNumber"],
    numberFields: [], nullableStringFields: [], select: recovery.META_IMPORT_FILE_ROW_RECOVERY_SELECT,
    canonical: recovery.canonicalMetaImportFileRowRecoveryCollection, fingerprint: recovery.fingerprintMetaImportFileRowRecovery
  },
  {
    model: "MetaDailySourceObservation", fields: recovery.META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS,
    dateFields: recovery.META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS, integerFields: ["impressions", "reach"],
    numberFields: ["spend", "results"], nullableStringFields: [], select: recovery.META_DAILY_SOURCE_OBSERVATION_RECOVERY_SELECT,
    canonical: recovery.canonicalMetaDailySourceObservationRecoveryCollection, fingerprint: recovery.fingerprintMetaDailySourceObservationRecovery
  },
  {
    model: "MetaDailyResolution", fields: recovery.META_DAILY_RESOLUTION_RECOVERY_FIELDS,
    dateFields: recovery.META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS, integerFields: ["resolutionVersion"],
    numberFields: [], nullableStringFields: [], select: recovery.META_DAILY_RESOLUTION_RECOVERY_SELECT,
    canonical: recovery.canonicalMetaDailyResolutionRecoveryCollection, fingerprint: recovery.fingerprintMetaDailyResolutionRecovery
  },
  {
    model: "MetaDailyResolutionEvent", fields: recovery.META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS,
    dateFields: recovery.META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS, integerFields: [], numberFields: [],
    nullableStringFields: ["previousObservationId"], select: recovery.META_DAILY_RESOLUTION_EVENT_RECOVERY_SELECT,
    canonical: recovery.canonicalMetaDailyResolutionEventRecoveryCollection, fingerprint: recovery.fingerprintMetaDailyResolutionEventRecovery
  },
  {
    model: "AdCreativeReport", fields: recovery.AD_CREATIVE_REPORT_RECOVERY_FIELDS,
    dateFields: recovery.AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS,
    integerFields: [
      "impressions", "reach", "linkClicks", "clicksAll", "landingPageViews", "shopClicks", "pageEngagement",
      "postReactions", "postComments", "postSaves", "postShares", "facebookLikes", "instagramFollows",
      "videoPlays", "twoSecondContinuousPlays", "threeSecondPlays", "thruPlays", "video25", "video50",
      "video75", "video95", "video100"
    ],
    numberFields: [
      "spend", "frequency", "costPerThousandAccountsReached", "cpm", "results", "costPerResult", "cpc",
      "ctr", "ctrAll", "cpcAll", "costPerLandingPageView", "costPerTwoSecondContinuousPlay",
      "costPerThreeSecondPlay", "costPerThruPlay"
    ],
    nullableStringFields: [
      "releaseId", "campaignName", "adSetName", "adDelivery", "resultIndicator", "qualityRanking",
      "engagementRateRanking", "conversionRateRanking", "utmSource", "utmCampaign", "utmContent"
    ],
    select: recovery.AD_CREATIVE_REPORT_RECOVERY_SELECT,
    canonical: recovery.canonicalAdCreativeReportRecoveryCollection, fingerprint: recovery.fingerprintAdCreativeReportRecovery
  }
];

const ISO = "2026-08-13T19:45:12.681Z";
const OFFSET_ISO = "2026-08-13T15:45:12.681-04:00";

function fixture(testCase: Case, suffix: string, datesAsObjects = false) {
  const dateFields = new Set(testCase.dateFields);
  const integerFields = new Set(testCase.integerFields);
  const numberFields = new Set(testCase.numberFields);
  const nullableStrings = new Set(testCase.nullableStringFields);
  const record = Object.fromEntries(testCase.fields.map((field, index) => {
    if (dateFields.has(field)) return [field, datesAsObjects ? new Date(ISO) : ISO];
    if (integerFields.has(field)) return [field, index + 1];
    if (numberFields.has(field)) return [field, index + 0.25];
    if (nullableStrings.has(field) && index % 2 === 0) return [field, null];
    return [field, `${field}-${suffix}`];
  })) as Record<string, unknown>;
  record.id = `id-${suffix}`;
  if (testCase.model === "MetaImportFileRow") {
    record.importFileId = `file-${suffix}`;
    record.sourceRowNumber = suffix === "a" ? 1 : 2;
  }
  if (testCase.model === "MetaDailySourceObservation" || testCase.model === "MetaDailyResolution") {
    record.identityKey = `identity-${suffix}`;
  }
  if (testCase.model === "MetaDailyResolutionEvent") record.resolutionId = `resolution-${suffix}`;
  return record;
}

function childProof() {
  const result = cases.map((testCase) => {
    const records = [fixture(testCase, "b", true), fixture(testCase, "a", true)];
    return {
      model: testCase.model,
      canonical: testCase.canonical(records),
      fingerprint: testCase.fingerprint(records)
    };
  });
  process.stdout.write(JSON.stringify(result));
}

if (process.argv.includes("--timezone-child")) {
  childProof();
} else {
  for (const testCase of cases) {
    const records = [fixture(testCase, "b"), fixture(testCase, "a")];
    const baseline = testCase.fingerprint(records);
    assert.equal(testCase.fingerprint([...records].reverse()), baseline, `${testCase.model} row order must not affect the fingerprint.`);
    assert.equal(
      testCase.fingerprint(records.map((record) => Object.fromEntries(Object.entries(record).reverse()))),
      baseline,
      `${testCase.model} property order must not affect the fingerprint.`
    );
    assert.equal(
      testCase.fingerprint([fixture(testCase, "b", true), fixture(testCase, "a", true)]),
      baseline,
      `${testCase.model} Date objects and ISO strings must be equivalent.`
    );
    const offsetRecords = records.map((record) => ({...record}));
    for (const record of offsetRecords) for (const field of testCase.dateFields) record[field] = OFFSET_ISO;
    assert.equal(testCase.fingerprint(offsetRecords), baseline, `${testCase.model} explicit offsets must normalize to UTC.`);
    assert.deepEqual(Object.keys(testCase.canonical(records)[0]), testCase.fields);
    assert.ok(!testCase.select.includes("*"), `${testCase.model} selector must be explicit.`);
    const prismaFields = Prisma.dmmf.datamodel.models
      .find((model) => model.name === testCase.model)
      ?.fields.filter((field) => field.kind === "scalar")
      .map((field) => field.name);
    assert.deepEqual(prismaFields, testCase.fields, `${testCase.model} contract must cover every scalar in schema order.`);

    const missing = {...records[0]};
    delete missing[testCase.fields[0]];
    assert.throws(() => testCase.fingerprint([missing]), /field .* is missing/);
    const firstDate = testCase.dateFields[0];
    assert.throws(() => testCase.fingerprint([{...records[0], [firstDate]: "2026-08-13 19:45:12.681"}]), /explicit timezone/);
    const mutationField = testCase.fields.find((field) => !testCase.dateFields.includes(field) && !testCase.integerFields.includes(field) && !testCase.numberFields.includes(field) && field !== "id")!;
    assert.notEqual(testCase.fingerprint([{...records[0], [mutationField]: "substantive-change"}]), testCase.fingerprint([records[0]]));
    if (testCase.integerFields.length) assert.throws(() => testCase.fingerprint([{...records[0], [testCase.integerFields[0]]: "1"}]), /must be an integer/);
    if (testCase.numberFields.length) assert.throws(() => testCase.fingerprint([{...records[0], [testCase.numberFields[0]]: Number.NaN}]), /finite number/);
  }

  const script = fileURLToPath(import.meta.url);
  const timezoneProofs = ["UTC", "America/New_York"].map((timezone) => {
    const child = spawnSync(process.execPath, ["--import", "tsx", script, "--timezone-child"], {
      encoding: "utf8", env: {...process.env, TZ: timezone}
    });
    assert.equal(child.status, 0, `${timezone} child failed: ${child.stderr}`);
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(timezoneProofs[0], timezoneProofs[1], "All canonical collections must be process-timezone invariant.");

  assert.equal(cases.reduce((sum, testCase) => sum + testCase.fields.length, 0), 123);
  assert.equal(cases.reduce((sum, testCase) => sum + testCase.dateFields.length, 0), 12);
  console.log(JSON.stringify({
    suite: "meta-recovery-collection-fingerprints", models: cases.length, scalarFields: 123, dateFields: 12,
    explicitSelectors: true, propertyOrderStable: true, collectionOrderStable: true,
    dateRepresentationStable: true, timezoneLessStringsRejected: true, crossTimezoneStable: true,
    mutationSensitive: true, scalarTypesValidated: true
  }));
}
