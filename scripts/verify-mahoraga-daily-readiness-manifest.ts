import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {buildMetaEvidenceBundle, type MetaEvidenceFile, type MetaEvidenceRow} from "../lib/ads/meta-evidence-contract";

const EXPECTED = new Map<string, {approvedSource: string; view: string; role: string}>([
  ["e43d5e17fd9716203a6ac5fbb959c56265eb82e976ac51aaf23a2d933974e1a0", {approvedSource: "mahoraga(3).csv", view: "delivery", role: "CORE_TIMING"}],
  ["ba8c9ae9e0ca5448e786adc40f0adedfd3ecd914688e2eb51e25b26fa94dcec0", {approvedSource: "mahoraga2(2).csv", view: "reach", role: "REACH_ENRICHMENT"}],
  ["88007b49bf69ee3ba03db71c30a640a6165a57cef866d8d3c60cf24215841a5b", {approvedSource: "mahoraga3(2).csv", view: "engagement", role: "ENGAGEMENT_ENRICHMENT"}],
  ["fc93cdacefb53018482c1e5fe6b247a1ec293ff899db198e37d9895ed10bc583", {approvedSource: "mahoraga4(2).csv", view: "video", role: "VIDEO_ENRICHMENT"}],
]);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
function identity(row: MetaEvidenceRow) { return [row.accountId, row.campaignId, row.adSetId, row.adId, row.metricDate].join("|"); }
function unique(rows: MetaEvidenceRow[], field: keyof MetaEvidenceRow) { return [...new Set(rows.map((row) => String(row[field] ?? "")).filter(Boolean))].sort(); }
function duplicateCount(file: MetaEvidenceFile) { const counts = new Map<string, number>(); for (const row of file.rows) counts.set(identity(row), (counts.get(identity(row)) ?? 0) + 1); return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0); }

async function main() {
  const sourcePaths = process.argv.slice(2);
  assert.equal(sourcePaths.length, 4, "Pass the four final Mahoraga CSV paths.");
  const inputs = await Promise.all(sourcePaths.map(async (sourcePath) => ({fileName: path.basename(sourcePath), bytes: new Uint8Array(await fs.readFile(sourcePath))})));
  const bundle = buildMetaEvidenceBundle(inputs, {attributionSetting: "", expectedGranularity: "DAILY", manualTimezone: "America/Los_Angeles", manualTimezoneOrigin: "USER_CONFIRMED"});
  assert.equal(new Set(bundle.files.map(({sha256}) => sha256)).size, 4);
  assert.deepEqual(new Set(bundle.files.map(({sha256}) => sha256)), new Set(EXPECTED.keys()), "A Mahoraga source hash drifted from approval.");
  for (const file of bundle.files) { const expected = EXPECTED.get(file.sha256); assert.ok(expected); assert.equal(file.sourceView, expected.view); assert.equal(file.viewRole, expected.role); assert.equal(duplicateCount(file), 0); }

  const core = bundle.files.find(({sourceView}) => sourceView === "delivery")!;
  const coreRows = core.rows; const coreIdentities = new Set(coreRows.map(identity)); const coreDates = unique(coreRows, "metricDate"); const coreAds = unique(coreRows, "adId");
  const positiveRows = coreRows.filter(({spend}) => (spend ?? 0) > 0); const zeroRows = coreRows.filter(({spend}) => spend === 0); const positiveIdentities = new Set(positiveRows.map(identity));
  assert.equal(coreRows.length, 852); assert.equal(coreDates.length, 71); assert.equal(coreAds.length, 12); assert.equal(coreIdentities.size, 852); assert.equal(coreDates.length * coreAds.length, 852);
  assert.equal(positiveRows.length, 110); assert.equal(zeroRows.length, 742); assert.equal(Math.round(coreRows.reduce((sum, row) => sum + (row.spend ?? 0), 0) * 100), 82_718);
  assert.equal(bundle.coreTimingEligible, true); assert.deepEqual(bundle.coreTimingEligibilityReasons, []); assert.equal(bundle.currency, "USD"); assert.equal(bundle.currencyOrigin, "METRIC_HEADER"); assert.equal(bundle.normalizedTimezone, "America/Los_Angeles"); assert.equal(bundle.timezoneSource, "USER_CONFIRMED"); assert.equal(bundle.sourceAsOfOrigin, "UNKNOWN");
  assert.deepEqual(unique(coreRows, "accountId"), ["367019114407672"]); assert.deepEqual(unique(coreRows, "campaignId"), ["120243311904960172"]); assert.deepEqual(unique(coreRows, "adSetId"), ["120245448816970172"]); assert.deepEqual(unique(coreRows, "campaignName"), ["vvviruz_evergreen_nerdcore"]); assert.deepEqual(unique(coreRows, "adSetName"), ["mahoraga ad set"]);
  assert.equal(bundle.viewConflicts.filter(({conflictClass}) => conflictClass === "IDENTITY").length, 0);
  const zeroOnly = coreRows.filter(({adName}) => adName === "mahoraga_cover_verse2_rev1"); assert.equal(zeroOnly.length, 71); assert.deepEqual(unique(zeroOnly, "adId"), ["120245898614110172"]); assert.equal(zeroOnly.filter(({spend}) => (spend ?? 0) > 0).length, 0); assert.equal(zeroOnly.reduce((sum, row) => sum + (row.spend ?? 0), 0), 0);

  const spendByDate = new Map<string, number>(); for (const row of coreRows) spendByDate.set(row.metricDate!, (spendByDate.get(row.metricDate!) ?? 0) + (row.spend ?? 0));
  const positiveDates = [...spendByDate].filter(([, spend]) => spend > 0).map(([date]) => date).sort(); const zeroDates = [...spendByDate].filter(([, spend]) => spend === 0).map(([date]) => date).sort();
  assert.equal(positiveDates.length, 62); assert.equal(positiveDates[0], "2026-06-10"); assert.equal(positiveDates.at(-1), "2026-08-10"); assert.deepEqual(zeroDates, ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09"]);

  const enrichments = bundle.files.filter(({sourceView}) => sourceView !== "delivery"); const enrichmentSets = enrichments.map((file) => new Set(file.rows.map(identity)));
  for (const [index, file] of enrichments.entries()) { assert.equal(file.rows.length, 121); assert.equal(enrichmentSets[index].size, 121); assert.equal([...enrichmentSets[index]].filter((key) => !coreIdentities.has(key)).length, 0); assert.equal([...positiveIdentities].filter((key) => !enrichmentSets[index].has(key)).length, 0); assert.equal([...enrichmentSets[index]].filter((key) => !positiveIdentities.has(key)).length, 11); }
  assert.deepEqual([...enrichmentSets[0]].sort(), [...enrichmentSets[1]].sort()); assert.deepEqual([...enrichmentSets[1]].sort(), [...enrichmentSets[2]].sort());
  const video = bundle.files.find(({sourceView}) => sourceView === "video")!; const deliverySpend = new Map(coreRows.map((row) => [identity(row), row.spend]));
  assert.equal(video.rows.filter((row) => deliverySpend.get(identity(row)) === row.spend).length, 121); assert.equal(Math.round(video.rows.reduce((sum, row) => sum + (row.spend ?? 0), 0) * 100), 82_718); assert.equal(coreRows.filter((row) => !enrichmentSets[2].has(identity(row))).length, 731); assert.equal(coreRows.filter((row) => !enrichmentSets[2].has(identity(row))).reduce((sum, row) => sum + (row.spend ?? 0), 0), 0);
  const revised = coreRows.find((row) => row.adName === "mahoraga_cover_verse1_rev1" && row.metricDate === "2026-08-10"); assert.equal(revised?.spend, 3.84); assert.equal(video.rows.find((row) => row.adName === "mahoraga_cover_verse1_rev1" && row.metricDate === "2026-08-10")?.spend, 3.84);

  const files = bundle.files.map((file) => { const expected = EXPECTED.get(file.sha256)!; return {approvedSource: expected.approvedSource, sanitizedSourceFilename: file.sanitizedFileName, sha256: file.sha256, detectedView: file.sourceView.toUpperCase(), role: file.viewRole, sizeBytes: file.sizeBytes, rowCount: file.rowCount, earliestReportingDate: file.reportingStart, latestReportingDate: file.reportingEnd, accountIds: unique(file.rows, "accountId"), campaignIds: unique(file.rows, "campaignId"), adSetIds: unique(file.rows, "adSetId"), adIds: unique(file.rows, "adId"), duplicateIdentityCount: duplicateCount(file), sourceGrain: "AD_DAILY"}; }).sort((a, b) => a.detectedView.localeCompare(b.detectedView));
  const manifest = {
    manifestVersion: "meta-daily-readiness-v1", purpose: "Gate E0.8 Mahoraga non-production source freeze",
    accountConfiguration: {accountId: "367019114407672", ianaTimezone: "America/Los_Angeles", origin: "USER_CONFIRMED", currency: "USD", currencyOrigin: "METRIC_HEADER"},
    bundleManifestFingerprint: digest(files.map(({sha256, detectedView, role, sizeBytes, rowCount, earliestReportingDate, latestReportingDate, accountIds, campaignIds, adSetIds, adIds, duplicateIdentityCount, sourceGrain}) => ({sha256, detectedView, role, sizeBytes, rowCount, earliestReportingDate, latestReportingDate, accountIds, campaignIds, adSetIds, adIds, duplicateIdentityCount, sourceGrain}))), files,
    verifiedContract: {accountCount: 1, campaignCount: 1, adSetCount: 1, adCount: 12, coreRows: 852, coreDates: 71, expectedCoreCells: 852, presentCoreCells: 852, positiveCoreCells: 110, explicitZeroCoreCells: 742, missingCoreCells: 0, canonicalSpendFacts: 852, canonicalSpendUsd: 827.18, firstPositiveDate: "2026-06-10", lastObservedPositiveDate: "2026-08-10", zeroRun: {start: "2026-06-01", end: "2026-06-09"}, enrichmentIdentityMatchesPerView: 121, enrichmentAdditionalExplicitZeroFacts: 11, coreOnlyFacts: 731, coreOnlySpendUsd: 0, videoSpendMatches: 121, videoSpendConflicts: 0, sourceAsOfOrigin: "UNKNOWN", zeroOnlyCreative: {adName: "mahoraga_cover_verse2_rev1", adId: "120245898614110172", rows: 71, spendUsd: 0}},
    historicalRevision: {comparisonProvenance: "PRODUCT_OWNER_REVIEWED_PRIOR_SOURCE_COMPARISON", priorSourceArtifactPresentInGate: false, comparableRows: 852, identicalSpendRows: 851, revisedRows: 1, priorTotalUsd: 826.05, currentTotalUsd: 827.18, revisedFact: {adName: "mahoraga_cover_verse1_rev1", metricDate: "2026-08-10", priorSpendUsd: 2.71, currentSpendUsd: 3.84, differenceUsd: 1.13, currentDeliveryVerified: true, currentVideoVerified: true}, canonicalFutureSource: "FINAL_STABLE_ID_BUNDLE", priorEvidenceDisposition: "PRESERVE_IF_IMPORTED_NEVER_DELETE_SILENTLY"}
  };
  try { assert.deepEqual(JSON.parse(await fs.readFile(path.resolve("docs/operations/manifests/meta-daily-mahoraga-2026-08-10.json"), "utf8")), manifest); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  console.log(JSON.stringify(manifest, null, 2));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
