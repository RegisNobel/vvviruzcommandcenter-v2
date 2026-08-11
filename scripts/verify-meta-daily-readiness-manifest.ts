import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {buildMetaEvidenceBundle, type MetaEvidenceFile, type MetaEvidenceRow} from "../lib/ads/meta-evidence-contract";

const EXPECTED = new Map<string, {approvedSource: string; view: string; role: string}>([
  ["24bcfe8e487c191c8e5260024de3de9f35fe2a2eeb50d048759511cd04e4ebc6", {approvedSource: "reach(3).csv", view: "delivery", role: "CORE_TIMING"}],
  ["01f987971181a848baa8275fcb62692bed5b9f8b04ed8c62661fb4ca0a9dd656", {approvedSource: "delivery(3).csv", view: "reach", role: "REACH_ENRICHMENT"}],
  ["ac15c72aab6ed5881509dc813dd2dd497eee4cfa01208ceab5c4ab9c2130cca9", {approvedSource: "engagement(3).csv", view: "engagement", role: "ENGAGEMENT_ENRICHMENT"}],
  ["cbe4fe2569b34e93ac4abb9a066e2404864d68fd2e4b6db2b2517cf1e2949dfb", {approvedSource: "video engagement(3).csv", view: "video", role: "VIDEO_ENRICHMENT"}]
]);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
function rowIdentity(row: MetaEvidenceRow) { return [row.accountId, row.campaignId, row.adSetId, row.adId, row.metricDate].join("|"); }
function unique(rows: MetaEvidenceRow[], field: keyof MetaEvidenceRow) { return [...new Set(rows.map((row) => String(row[field] ?? "")).filter(Boolean))].sort(); }
function duplicateIdentityCount(file: MetaEvidenceFile) {
  const counts = new Map<string, number>();
  for (const row of file.rows) { const key = rowIdentity(row); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
}

async function main() {
  const sourcePaths = process.argv.slice(2);
  assert.equal(sourcePaths.length, 4, "Pass the four reviewed Meta CSV paths.");
  const inputs = await Promise.all(sourcePaths.map(async (sourcePath) => ({fileName: path.basename(sourcePath), bytes: new Uint8Array(await fs.readFile(sourcePath))})));
  const bundle = buildMetaEvidenceBundle(inputs, {attributionSetting: "", expectedGranularity: "DAILY", manualTimezone: "America/Los_Angeles", manualTimezoneOrigin: "USER_CONFIRMED"});
  assert.equal(new Set(bundle.files.map(({sha256}) => sha256)).size, 4, "Every approved source must have distinct bytes.");
  assert.deepEqual(new Set(bundle.files.map(({sha256}) => sha256)), new Set(EXPECTED.keys()), "A source hash drifted from approval.");

  for (const file of bundle.files) {
    const expected = EXPECTED.get(file.sha256);
    assert.ok(expected, `Unapproved source hash: ${file.sha256}`);
    assert.equal(file.sourceView, expected.view, `${file.sanitizedFileName} content-derived view changed.`);
    assert.equal(file.viewRole, expected.role);
    assert.equal(duplicateIdentityCount(file), 0);
    assert.equal(file.rows.filter(({metricDate}) => Boolean(metricDate)).length, file.rowCount);
  }

  const delivery = bundle.files.find(({sourceView}) => sourceView === "delivery")!;
  const coreRows = delivery.rows;
  const coreDates = unique(coreRows, "metricDate");
  const coreAds = unique(coreRows, "adId");
  const coreIdentities = new Set(coreRows.map(rowIdentity));
  const positiveRows = coreRows.filter(({spend}) => spend !== null && spend > 0);
  const zeroRows = coreRows.filter(({spend}) => spend === 0);
  const positiveIdentities = new Set(positiveRows.map(rowIdentity));
  assert.equal(coreRows.length, 210); assert.equal(coreDates.length, 30); assert.equal(coreAds.length, 7);
  assert.equal(coreDates.length * coreAds.length, 210); assert.equal(coreIdentities.size, 210);
  assert.equal(positiveRows.length, 60); assert.equal(zeroRows.length, 150);
  assert.equal(Math.round(positiveRows.reduce((sum, row) => sum + (row.spend ?? 0), 0) * 100), 28_348);
  assert.equal(bundle.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 210);
  assert.equal(bundle.coreTimingEligible, true); assert.deepEqual(bundle.coreTimingEligibilityReasons, []);
  assert.equal(bundle.currency, "USD"); assert.equal(bundle.currencyOrigin, "METRIC_HEADER");
  assert.equal(bundle.normalizedTimezone, "America/Los_Angeles"); assert.equal(bundle.timezoneSource, "USER_CONFIRMED");
  assert.equal(bundle.sourceAsOf, null); assert.equal(bundle.sourceAsOfOrigin, "UNKNOWN");
  assert.equal(bundle.viewConflicts.filter(({conflictClass}) => conflictClass === "IDENTITY").length, 0);

  const enrichment = bundle.files.filter(({sourceView}) => sourceView !== "delivery");
  for (const file of enrichment) {
    const identities = new Set(file.rows.map(rowIdentity));
    assert.equal(identities.size, 60); assert.equal(file.reportingStart, "2026-07-21"); assert.equal(file.reportingEnd, "2026-08-09");
    assert.equal([...identities].filter((identity) => !positiveIdentities.has(identity)).length, 0);
    assert.equal([...positiveIdentities].filter((identity) => !identities.has(identity)).length, 0);
  }
  const video = bundle.files.find(({sourceView}) => sourceView === "video")!;
  const deliverySpend = new Map(positiveRows.map((row) => [rowIdentity(row), row.spend]));
  assert.equal(video.rows.filter((row) => deliverySpend.get(rowIdentity(row)) === row.spend).length, 60);
  assert.equal(Math.round(video.rows.reduce((sum, row) => sum + (row.spend ?? 0), 0) * 100), 28_348);
  assert.equal(bundle.viewConflicts.filter(({code}) => code === "CROSS_VIEW_SPEND_MISMATCH").length, 0);

  const accountIds = unique(bundle.files.flatMap(({rows}) => rows), "accountId");
  const campaignIds = unique(bundle.files.flatMap(({rows}) => rows), "campaignId");
  const adSetIds = unique(bundle.files.flatMap(({rows}) => rows), "adSetId");
  const adIds = unique(bundle.files.flatMap(({rows}) => rows), "adId");
  assert.deepEqual(accountIds, ["367019114407672"]); assert.deepEqual(campaignIds, ["120243311904960172"]); assert.deepEqual(adSetIds, ["120247925536670172"]); assert.equal(adIds.length, 7);
  assert.deepEqual(unique(coreRows, "campaignName"), ["vvviruz_evergreen_nerdcore"]); assert.deepEqual(unique(coreRows, "adSetName"), ["game over ad set"]);
  assert.ok(coreRows.some(({adName}) => /game\s*over/i.test(adName)), "Game Over creative naming must remain visible in source evidence.");
  assert.ok(unique(coreRows, "resultMetricKey").some((value) => /streamingoutboundclick/.test(value)));

  const files = bundle.files.map((file) => {
    const expected = EXPECTED.get(file.sha256)!;
    return {
      approvedSource: expected.approvedSource,
      sanitizedSourceFilename: file.sanitizedFileName,
      sha256: file.sha256,
      detectedView: file.sourceView.toUpperCase(),
      role: file.viewRole,
      sizeBytes: file.sizeBytes,
      rowCount: file.rowCount,
      earliestReportingDate: file.reportingStart,
      latestReportingDate: file.reportingEnd,
      singleDayRowCount: file.rows.filter(({metricDate}) => Boolean(metricDate)).length,
      nonDailyRowCount: file.rows.filter(({metricDate}) => !metricDate).length,
      accountIds: unique(file.rows, "accountId"), campaignIds: unique(file.rows, "campaignId"), adSetIds: unique(file.rows, "adSetId"), adIds: unique(file.rows, "adId"),
      duplicateIdentityCount: duplicateIdentityCount(file), sourceGrain: "AD_DAILY"
    };
  }).sort((a, b) => a.detectedView.localeCompare(b.detectedView));
  const fingerprintInput = files.map(({sha256, detectedView, role, rowCount, earliestReportingDate, latestReportingDate, singleDayRowCount, nonDailyRowCount, accountIds, campaignIds, adSetIds, adIds, duplicateIdentityCount, sourceGrain}) => ({sha256, detectedView, role, rowCount, earliestReportingDate, latestReportingDate, singleDayRowCount, nonDailyRowCount, accountIds, campaignIds, adSetIds, adIds, duplicateIdentityCount, sourceGrain}));
  const manifest = {
    manifestVersion: "meta-daily-readiness-v1",
    purpose: "Gate E0.7 non-production source freeze",
    accountConfiguration: {
      accountId: "367019114407672",
      ianaTimezone: "America/Los_Angeles",
      origin: "USER_CONFIRMED",
      resolutionState: "CURRENT",
      confirmingAdministrator: "current authenticated administrator",
      confirmedAt: "2026-08-11T00:07:03.000Z",
      currency: "USD",
      currencyOrigin: "METRIC_HEADER"
    },
    bundleManifestFingerprint: digest(fingerprintInput),
    files,
    verifiedContract: {
      accountCount: 1, campaignCount: 1, adSetCount: 1, adCount: 7,
      coreRows: 210, coreDates: 30, expectedCoreCells: 210, presentCoreCells: 210, positiveCoreCells: 60, explicitZeroCoreCells: 150, missingCoreCells: 0,
      canonicalSpendFacts: 210, canonicalSpendUsd: 283.48, firstPositiveDate: "2026-07-21", lastObservedPositiveDate: "2026-08-09", zeroRun: {start: "2026-07-11", end: "2026-07-20"},
      enrichmentIdentityMatchesPerView: 60, videoSpendMatches: 60, videoSpendConflicts: 0, sourceAsOfOrigin: "UNKNOWN", timezone: "America/Los_Angeles", timezoneOrigin: "USER_CONFIRMED",
      externalContext: "CANDIDATE_FOR_FUTURE_GAME_OVER_REVIEW", mahoragaClassification: "CLEARLY_OTHER_CONTEXT"
    }
  };

  const duplicated = [inputs[0], {...inputs[0], fileName: "renamed-duplicate.csv"}];
  assert.throws(() => buildMetaEvidenceBundle(duplicated, {attributionSetting: "", expectedGranularity: "DAILY", manualTimezone: "America/Los_Angeles"}), /same source file more than once/);
  const modifiedBytes = new Uint8Array(inputs[0].bytes); modifiedBytes[modifiedBytes.length - 1] ^= 1;
  assert.notEqual(createHash("sha256").update(modifiedBytes).digest("hex"), files.find(({sha256}) => sha256 === createHash("sha256").update(inputs[0].bytes).digest("hex"))?.sha256);

  const frozenManifestPath = path.resolve("docs/operations/manifests/meta-daily-game-over-2026-08-10.json");
  const frozenManifest = JSON.parse(await fs.readFile(frozenManifestPath, "utf8"));
  assert.deepEqual(frozenManifest, manifest, "The frozen readiness manifest does not match the reviewed source bytes.");

  console.log(JSON.stringify(manifest, null, 2));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
