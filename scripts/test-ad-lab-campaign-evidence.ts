import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {execFileSync} from "node:child_process";

import {buildMetaEvidenceBundle, chooseSnapshotRanking, resolveCanonicalDaily, resolveMetaDayState, type CanonicalCandidate, type MetaEvidenceInputFile} from "../lib/ads/meta-evidence-contract";

const encoder = new TextEncoder();
function csvFile(name: string, rows: string[], extraHeaders = ""): MetaEvidenceInputFile {
  const header = `Account ID,Account name,Account timezone,Currency,Campaign ID,Campaign name,Ad set ID,Ad set name,Ad ID,Ad name,Reporting starts,Reporting ends,Amount spent,Impressions,Results,Result indicator,Delivery,Attribution setting${extraHeaders}`;
  return {fileName: name, bytes: encoder.encode([header, ...rows].join("\n"))};
}
function row(values: Partial<Record<"account"|"accountName"|"tz"|"currency"|"campaign"|"campaignName"|"adset"|"adsetName"|"ad"|"adName"|"start"|"end"|"spend"|"impressions"|"results"|"indicator"|"delivery"|"attribution", string>> = {}) {
  const v = {account: "act-1", accountName: "VVV", tz: "America/New_York", currency: "USD", campaign: "cmp-1", campaignName: "Mahoraga", adset: "set-1", adsetName: "Broad", ad: "ad-1", adName: "Creative A", start: "2026-08-01", end: "2026-08-01", spend: "10", impressions: "100", results: "2", indicator: "Link clicks", delivery: "Active", attribution: "7-day click", ...values};
  return [v.account,v.accountName,v.tz,v.currency,v.campaign,v.campaignName,v.adset,v.adsetName,v.ad,v.adName,v.start,v.end,v.spend,v.impressions,v.results,v.indicator,v.delivery,v.attribution].join(",");
}
const context = {attributionSetting: "7-day click", sourceAsOf: "2026-08-02T12:00:00.000Z", expectedGranularity: "DAILY" as const};

const daily = buildMetaEvidenceBundle([csvFile("daily.csv", [row()])], context);
assert.equal(daily.sourceGranularity, "DAILY");
assert.equal(daily.campaignIntervalEligible, true);
assert.equal(daily.accountId, "act-1");
assert.equal(daily.normalizedTimezone, "America/New_York");
assert.equal(daily.mergedDailyRows[0].metricDate, "2026-08-01");
assert.ok(daily.mergedDailyRows[0].identityKey?.includes("cmp-1|set-1|ad-1|2026-08-01"));
assert.equal(daily.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 1);
assert.equal(daily.metricObservations.filter(({metricFamily}) => metricFamily === "ATTRIBUTION_RESULT").length, 1);
assert.match(daily.metricObservations.find(({metricFamily}) => metricFamily === "SPEND")!.identityKey, /\|SPEND\|USD$/);
assert.doesNotMatch(daily.metricObservations.find(({metricFamily}) => metricFamily === "SPEND")!.identityKey, /7-day click/);
assert.equal(daily.currencyOrigin, "SOURCE_COLUMN");

const headerCurrencyValues = row().split(","); headerCurrencyValues.splice(3, 1);
const headerCurrencyFile: MetaEvidenceInputFile = {fileName: "header-currency.csv", bytes: encoder.encode([
  "Account ID,Account name,Account timezone,Campaign ID,Campaign name,Ad set ID,Ad set name,Ad ID,Ad name,Reporting starts,Reporting ends,Amount spent (USD),Impressions,Results,Result indicator,Delivery,Attribution setting",
  headerCurrencyValues.join(",")
].join("\n"))};
const headerCurrency = buildMetaEvidenceBundle([headerCurrencyFile], context);
assert.equal(headerCurrency.currency, "USD");
assert.equal(headerCurrency.currencyOrigin, "METRIC_HEADER");
assert.equal(headerCurrency.campaignIntervalEligible, true);

const aggregate = buildMetaEvidenceBundle([csvFile("aggregate.csv", [row({start: "2026-07-01", end: "2026-07-30"})])], {...context, expectedGranularity: "AGGREGATE_SNAPSHOT"});
assert.equal(aggregate.sourceGranularity, "AGGREGATE_SNAPSHOT");
assert.equal(aggregate.campaignIntervalEligible, false);
assert.ok(aggregate.eligibilityReasons.includes("CORE_TIMING_NOT_DAILY"));

assert.throws(() => buildMetaEvidenceBundle([csvFile("a.csv", [row()]), csvFile("b.csv", [row()])], context), /same source file/i);
const sessionA = buildMetaEvidenceBundle([csvFile("a.csv", [row({spend: "10"})])], context);
const sessionB = buildMetaEvidenceBundle([csvFile("b.csv", [row({spend: "11"})])], {...context, sourceAsOf: "2026-08-03T12:00:00.000Z"});
assert.notEqual(sessionA.bundleHash, sessionB.bundleHash);
assert.equal(sessionA.mergedDailyRows.length, 1);
assert.equal(sessionB.mergedDailyRows.length, 1);
const deliveryView = {...csvFile("delivery.csv", [row({spend: "10"})]), sourceView: "delivery" as const};
const engagementView = {...csvFile("engagement.csv", [row({spend: ""})]), sourceView: "engagement" as const};
const mergedViews = buildMetaEvidenceBundle([deliveryView, engagementView], context);
assert.equal(mergedViews.mergedDailyRows.length, 1);
assert.equal(mergedViews.mergedDailyRows[0].sourceFileHash.split(",").length, 2);
assert.equal(mergedViews.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 1);
const attributionCopy = buildMetaEvidenceBundle([
  {...csvFile("a7.csv", [row({attribution: "7-day click", results: "2"})]), sourceView: "delivery"},
  {...csvFile("a1.csv", [row({attribution: "1-day click", results: "3", indicator: "Purchases"})]), sourceView: "delivery"}
], context);
assert.equal(attributionCopy.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 1, "spend is deduplicated across attribution settings");
assert.equal(attributionCopy.metricObservations.filter(({metricFamily}) => metricFamily === "ATTRIBUTION_RESULT").length, 2, "semantically distinct result metrics remain distinct");
const viewConflict = buildMetaEvidenceBundle([
  {...csvFile("primary.csv", [row({spend: "10"})]), sourceView: "delivery"},
  {...csvFile("duplicate.csv", [row({spend: "11"})]), sourceView: "video"}
], context);
assert.equal(viewConflict.coreTimingEligible, true);
assert.ok(viewConflict.enrichmentWarnings.includes("CROSS_VIEW_SPEND_MISMATCH"));
assert.equal(viewConflict.viewConflicts[0].blocksCoreTimingEligibility, false);
assert.equal(viewConflict.viewConflicts[0].blocksEnrichmentCompatibility, true);
assert.equal(viewConflict.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 1);
const descriptiveConflict = buildMetaEvidenceBundle([
  {...csvFile("descriptive-delivery.csv", [row({spend: "10", impressions: "100"})]), sourceView: "delivery"},
  {...csvFile("descriptive-reach.csv", [row({spend: "", impressions: "99"})]), sourceView: "reach"}
], context);
assert.equal(descriptiveConflict.campaignIntervalEligible, true, "descriptive reach/impression disagreement does not block spend-based interval evidence");
assert.ok(descriptiveConflict.viewConflicts.some(({field, blocksCampaignEligibility}) => field === "impressions" && !blocksCampaignEligibility));
const incompatibleWindows = buildMetaEvidenceBundle([
  {...csvFile("window-delivery.csv", [row(), row({start: "2026-08-02", end: "2026-08-02"})]), sourceView: "delivery"},
  {...csvFile("window-video.csv", [row({spend: ""})]), sourceView: "video"}
], context);
assert.equal(incompatibleWindows.coreTimingEligible, true);
assert.equal(incompatibleWindows.enrichmentCompatibility, "COMPATIBLE_WITH_GAPS");
assert.ok(incompatibleWindows.enrichmentWarnings.includes("PARTIAL_ENRICHMENT_COVERAGE"));
const partialLater = buildMetaEvidenceBundle([{...csvFile("partial.csv", [row({spend: ""})]), sourceView: "delivery"}], {...context, sourceAsOf: "2026-08-04T12:00:00.000Z"});
assert.equal(partialLater.campaignIntervalEligible, false);
assert.ok(partialLater.eligibilityReasons.includes("DAILY_SPEND_REQUIRED"));
const deliveryOnly = buildMetaEvidenceBundle([{...csvFile("delivery-only.csv", [row()]), sourceView: "delivery"}], context);
assert.equal(deliveryOnly.coreTimingEligible, true, "missing optional views cannot block timing");
assert.equal(deliveryOnly.enrichmentCompatibility, "NOT_PRESENT");

const start = new Date("2026-07-10T00:00:00.000Z");
const dates32 = Array.from({length: 32}, (_, index) => { const date = new Date(start); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
const dates21 = dates32.slice(11);
const splitCoverage = buildMetaEvidenceBundle([
  {...csvFile("delivery-32.csv", dates32.map((day) => row({start: day, end: day}))), sourceView: "delivery"},
  {...csvFile("video-21.csv", dates21.map((day) => row({start: day, end: day, spend: ""})), ",Video plays"), sourceView: "video"},
  {...csvFile("engagement-21.csv", dates21.map((day) => row({start: day, end: day, spend: ""})), ",Post reactions"), sourceView: "engagement"},
  {...csvFile("reach-21.csv", dates21.map((day) => row({start: day, end: day, spend: ""})), ",Frequency"), sourceView: "reach"}
], context);
assert.equal(splitCoverage.coreTimingEligible, true);
assert.equal(splitCoverage.reportingStart, "2026-07-10"); assert.equal(splitCoverage.reportingEnd, "2026-08-10");
assert.equal(splitCoverage.mergedDailyRows.length, 32); assert.equal(splitCoverage.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, 32);
assert.equal(splitCoverage.files.find(({sourceView}) => sourceView === "video")?.missingCoreDateCount, 11);
assert.equal(splitCoverage.commonObservedDateCount, 21);
assert.equal(splitCoverage.mergedDailyRows.find(({metricDate}) => metricDate === "2026-07-12")?.spend, 10);
assert.equal(splitCoverage.mergedDailyRows.find(({metricDate}) => metricDate === "2026-07-12")?.impressions, 100, "Delivery-owned descriptive values remain available");

const authoritativeConflict = buildMetaEvidenceBundle([
  {...csvFile("delivery-authority-a.csv", [row({spend: "10"})]), sourceView: "delivery"},
  {...csvFile("delivery-authority-b.csv", [row({spend: "11"})]), sourceView: "delivery"}
], context);
assert.equal(authoritativeConflict.coreTimingEligible, false);
assert.ok(authoritativeConflict.coreTimingEligibilityReasons.includes("AUTHORITATIVE_SPEND_CONFLICT"));
assert.throws(() => buildMetaEvidenceBundle(Array.from({length: 9}, (_, index) => csvFile(`${index}.csv`, [row({spend: String(index)})])), context), /between 1 and 8/i);
assert.throws(() => buildMetaEvidenceBundle([{fileName: "oversized.csv", bytes: new Uint8Array(5 * 1024 * 1024 + 1)}], context), /per-file size limit/i);
const safeFilename = buildMetaEvidenceBundle([csvFile("..\\unsafe\u0000.csv", [row()])], context).files[0].sanitizedFileName;
assert.equal(safeFilename, "unsafe.csv");

const renamed = buildMetaEvidenceBundle([csvFile("renamed.csv", [row({campaignName: "Renamed campaign", adName: "Renamed creative"})])], context);
assert.equal(renamed.mergedDailyRows[0].identityKey, daily.mergedDailyRows[0].identityKey);
const duplicateNames = buildMetaEvidenceBundle([csvFile("ids.csv", [row({ad: "ad-1", adName: "Same"}), row({ad: "ad-2", adName: "Same"})])], context);
assert.equal(duplicateNames.mergedDailyRows.length, 2);
const campaignCollision = buildMetaEvidenceBundle([csvFile("campaigns.csv", [row({campaign: "cmp-1", ad: "ad-1", adName: "Same"}), row({campaign: "cmp-2", ad: "ad-1", adName: "Same"})])], context);
assert.equal(campaignCollision.mergedDailyRows.length, 2);
assert.ok(campaignCollision.eligibilityReasons.includes("AD_SET_HIERARCHY_CONFLICT"));
const adParentCollision = buildMetaEvidenceBundle([csvFile("ad-parent.csv", [row({adset: "set-1"}), row({adset: "set-2"})])], context);
assert.ok(adParentCollision.eligibilityReasons.includes("AD_HIERARCHY_CONFLICT"));

const manualTz = buildMetaEvidenceBundle([csvFile("manual.csv", [row({tz: ""})])], {...context, manualTimezone: "America/Los_Angeles"});
assert.equal(manualTz.campaignIntervalEligible, true);
assert.equal(manualTz.timezoneSource, "USER_CONFIRMED");
assert.equal(daily.timezoneSource, "META_SOURCE");
assert.equal(manualTz.mergedDailyRows[0].metricDate, "2026-08-01");
assert.equal(manualTz.mergedDailyRows[0].normalizedTimezone, "America/Los_Angeles");
const unknownTz = buildMetaEvidenceBundle([csvFile("unknown.csv", [row({tz: ""})])], context);
assert.equal(unknownTz.campaignIntervalEligible, false);
assert.ok(unknownTz.eligibilityReasons.includes("TIMEZONE_MISSING_OR_AMBIGUOUS"));

const source = daily.mergedDailyRows[0];
const candidates: CanonicalCandidate[] = [
  {...source, id: "older", acceptedAt: "2026-08-02T13:00:00.000Z", sourceAsOf: "2026-08-02T12:00:00.000Z", importState: "ACCEPTED", spend: 10},
  {...source, id: "newer", acceptedAt: "2026-08-03T13:00:00.000Z", sourceAsOf: "2026-08-03T12:00:00.000Z", importState: "ACCEPTED", spend: 12}
];
const resolved = resolveCanonicalDaily(candidates)[0];
assert.equal(resolved.winner.id, "newer");
assert.deepEqual(resolved.superseded.map(({id}) => id), ["older"]);
assert.equal(resolveCanonicalDaily([...candidates, {...candidates[1], id: "withdrawn", sourceAsOf: "2026-08-04T12:00:00.000Z", importState: "WITHDRAWN"}])[0].winner.id, "newer");
assert.equal(resolveCanonicalDaily([{...candidates[0], id: "tie-a"}, {...candidates[0], id: "tie-b"}])[0].winner.id, "tie-b");
assert.equal(resolveCanonicalDaily([
  {...candidates[0], id: "authoritative", sourceAsOf: "2026-08-02T12:00:00.000Z", sourceAsOfOrigin: "META_EXPORT"},
  {...candidates[1], id: "fallback-later", sourceAsOf: "2026-08-04T12:00:00.000Z", sourceAsOfOrigin: "IMPORT_ACCEPTED_FALLBACK"}
])[0].winner.id, "authoritative", "fallback upload time cannot outrank a source-authoritative timestamp");
assert.equal(resolveCanonicalDaily([
  {...candidates[0], id: "meta-export", sourceAsOf: "2026-08-02T12:00:00.000Z", sourceAsOfOrigin: "META_EXPORT"},
  {...candidates[1], id: "user-later", sourceAsOf: "2026-08-05T12:00:00.000Z", sourceAsOfOrigin: "USER_CONFIRMED"}
])[0].winner.id, "meta-export", "a later user-confirmed time cannot outrank a Meta export timestamp");
assert.equal(resolveMetaDayState(null), "UNKNOWN");
assert.equal(resolveMetaDayState({spend: 0}), "EXPLICIT_ZERO");
assert.equal(resolveMetaDayState({spend: 1}), "ACTIVE_EVIDENCE");
assert.equal(chooseSnapshotRanking([{reportingEnd: "2026-07-30", exportedAt: "2026-07-31", spend: 100}, {reportingEnd: "2026-08-01", exportedAt: "2026-08-02", spend: 80}])?.spend, 80);

const formula = buildMetaEvidenceBundle([csvFile("formula.csv", [row({adName: "=HYPERLINK(evil)"})])], context);
assert.ok(formula.warnings.some((warning) => warning.startsWith("FORMULA_PREFIX_PRESENT")));
assert.throws(() => buildMetaEvidenceBundle([{fileName: "bad.csv", bytes: new Uint8Array([0xff, 0xfe])}], context), /UTF-8/);

const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260810150000_ad_lab_campaign_evidence_foundation/migration.sql"), "utf8");
const validationMigration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260810170000_meta_daily_contract_validation/migration.sql"), "utf8");
const separationMigration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260810190000_core_timing_enrichment_separation/migration.sql"), "utf8");
const db = new DatabaseSync(":memory:");
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE "AdminUser" ("id" TEXT PRIMARY KEY);
CREATE TABLE "Release" ("id" TEXT PRIMARY KEY);
CREATE TABLE "PromotionCampaign" ("id" TEXT PRIMARY KEY);
CREATE TABLE "CampaignEvidence" ("id" TEXT PRIMARY KEY,"campaignId" TEXT NOT NULL,"sourceType" TEXT NOT NULL,"sourceRecordId" TEXT NOT NULL DEFAULT '',"campaignName" TEXT NOT NULL DEFAULT '',"rationale" TEXT NOT NULL DEFAULT '',"confidence" TEXT NOT NULL DEFAULT 'LOW',"metadata" TEXT NOT NULL DEFAULT '{}',"createdByUsername" TEXT NOT NULL DEFAULT '',"createdAt" DATETIME NOT NULL,"updatedAt" DATETIME NOT NULL);
CREATE TABLE "AdImportBatch" ("id" TEXT PRIMARY KEY,"source" TEXT NOT NULL DEFAULT 'meta',"name" TEXT NOT NULL DEFAULT '',"releaseId" TEXT,"reportingStart" DATETIME,"reportingEnd" DATETIME,"exportedAt" DATETIME,"attributionSetting" TEXT NOT NULL DEFAULT '',"batchType" TEXT NOT NULL DEFAULT 'Rolling Snapshot',"fileNames" TEXT NOT NULL DEFAULT '[]',"notes" TEXT NOT NULL DEFAULT '',"createdAt" DATETIME NOT NULL,"updatedAt" DATETIME NOT NULL);
CREATE TABLE "AdCreativeReport" ("id" TEXT PRIMARY KEY,"importBatchId" TEXT NOT NULL,"adName" TEXT NOT NULL,FOREIGN KEY("importBatchId") REFERENCES "AdImportBatch"("id"));
CREATE TABLE "CopyEntry" ("id" TEXT PRIMARY KEY);
CREATE TABLE "AdCreativeCopyLink" ("id" TEXT PRIMARY KEY,"adCreativeReportId" TEXT NOT NULL,"copyEntryId" TEXT NOT NULL);
CREATE TABLE "AnalyticsImport" ("id" TEXT PRIMARY KEY,"fileHash" TEXT NOT NULL,"status" TEXT NOT NULL);
CREATE TABLE "ArtistMetricObservation" ("id" TEXT PRIMARY KEY,"importId" TEXT NOT NULL,"metricDate" DATETIME NOT NULL,"listeners" INTEGER);
CREATE TABLE "TrackMetricObservation" ("id" TEXT PRIMARY KEY,"importId" TEXT NOT NULL,"releaseId" TEXT NOT NULL,"metricDate" DATETIME NOT NULL,"streams" INTEGER);
CREATE TABLE "SongPeriodSnapshot" ("id" TEXT PRIMARY KEY,"importId" TEXT NOT NULL,"releaseId" TEXT NOT NULL,"periodStart" DATETIME NOT NULL,"periodEnd" DATETIME NOT NULL,"streams" INTEGER);
INSERT INTO "AnalyticsImport" VALUES ('spotify-import','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','IMPORTED');
INSERT INTO "ArtistMetricObservation" VALUES ('artist-observation','spotify-import','2026-08-01',100);
INSERT INTO "TrackMetricObservation" VALUES ('mahoraga-track','spotify-import','mahoraga-release','2026-08-01',50);
INSERT INTO "SongPeriodSnapshot" VALUES ('mahoraga-song','spotify-import','mahoraga-release','2026-07-05','2026-08-01',500);
`);
for (let batch = 0; batch < 5; batch += 1) {
  db.prepare(`INSERT INTO "AdImportBatch" (id,"createdAt","updatedAt") VALUES (?,?,?)`).run(`batch-${batch}`, "2026-08-01", "2026-08-01");
  for (let item = 0; item < 10; item += 1) db.prepare(`INSERT INTO "AdCreativeReport" (id,"importBatchId","adName") VALUES (?,?,?)`).run(`report-${batch}-${item}`, `batch-${batch}`, `Ad ${item}`);
}
db.prepare(`INSERT INTO "CopyEntry" (id) VALUES (?)`).run("copy-1");
for (let item = 0; item < 18; item += 1) db.prepare(`INSERT INTO "AdCreativeCopyLink" (id,"adCreativeReportId","copyEntryId") VALUES (?,?,?)`).run(`link-${item}`, `report-${Math.floor(item / 10)}-${item % 10}`, "copy-1");
const protectedFingerprint = JSON.stringify({
  imports: db.prepare(`SELECT * FROM "AnalyticsImport" ORDER BY id`).all(),
  artist: db.prepare(`SELECT * FROM "ArtistMetricObservation" ORDER BY id`).all(),
  track: db.prepare(`SELECT * FROM "TrackMetricObservation" ORDER BY id`).all(),
  songs: db.prepare(`SELECT * FROM "SongPeriodSnapshot" ORDER BY id`).all()
});
db.exec(migration);
db.exec(validationMigration);
db.exec(separationMigration);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdImportBatch"`).get() as {count: number}).count, 5);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdCreativeReport"`).get() as {count: number}).count, 50);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdCreativeCopyLink"`).get() as {count: number}).count, 18);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdImportBatch" WHERE "sourceGranularity"='AGGREGATE_SNAPSHOT' AND "campaignIntervalEligible"=0 AND "eligibilityReason"='LEGACY_AGGREGATE_SNAPSHOT'`).get() as {count: number}).count, 5);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdImportBatch" WHERE "sourceAsOfOrigin"='UNKNOWN'`).get() as {count: number}).count, 5);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdImportBatch" WHERE "currencyOrigin"='UNKNOWN'`).get() as {count: number}).count, 5);
assert.equal((db.prepare(`SELECT count(*) count FROM "AdImportBatch" WHERE "coreTimingEligible"=0 AND "enrichmentCompatibility"='NOT_EVALUATED'`).get() as {count: number}).count, 5);
assert.equal((db.prepare(`SELECT count(*) count FROM sqlite_master WHERE type='table' AND name='MetaAccountTimezoneResolution'`).get() as {count: number}).count, 1);
assert.equal(JSON.stringify({imports: db.prepare(`SELECT * FROM "AnalyticsImport" ORDER BY id`).all(), artist: db.prepare(`SELECT * FROM "ArtistMetricObservation" ORDER BY id`).all(), track: db.prepare(`SELECT * FROM "TrackMetricObservation" ORDER BY id`).all(), songs: db.prepare(`SELECT * FROM "SongPeriodSnapshot" ORDER BY id`).all()}), protectedFingerprint);
db.close();

for (const file of ["lib/analytics/retention-engine.ts", "lib/analytics/retention-calculations.ts"]) {
  assert.equal(fs.readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n"), execFileSync("git", ["show", `HEAD:${file}`], {encoding: "utf8"}).replace(/\r\n/g, "\n"), `${file} must remain unchanged`);
}

console.log(JSON.stringify({suite: "ad-lab-campaign-evidence", assertions: "passed", legacyBatches: 5, legacyReports: 50, legacyCopyLinks: 18, spotifyFingerprintUnchanged: true, mahoragaTrackPersistenceUnchanged: true, stage7FormulaFilesUnchanged: true}, null, 2));
