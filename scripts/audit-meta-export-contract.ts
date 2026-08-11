import fs from "node:fs";
import path from "node:path";

import {buildMetaEvidenceBundle, type MetaEvidenceInputFile} from "../lib/ads/meta-evidence-contract";

function csvHeader(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", {fatal: true}).decode(bytes).replace(/^\uFEFF/, "");
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const headers: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]; const next = line[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { headers.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  headers.push(cell.trim()); return headers;
}

const args = process.argv.slice(2); const timezoneFlag = args.indexOf("--timezone");
const reviewedTimezone = timezoneFlag >= 0 ? args[timezoneFlag + 1] : null;
const paths = timezoneFlag >= 0 ? args.filter((_, index) => index !== timezoneFlag && index !== timezoneFlag + 1) : args;
if (!paths.length) throw new Error("Pass one or more local Meta CSV paths.");
const inputs: MetaEvidenceInputFile[] = paths.map((filePath) => ({fileName: path.basename(filePath), bytes: fs.readFileSync(filePath)}));
const bundle = buildMetaEvidenceBundle(inputs, {attributionSetting: "", manualTimezone: reviewedTimezone, manualTimezoneOrigin: reviewedTimezone ? "USER_CONFIRMED" : null});
const requiredStableHeaders = ["Account ID", "Campaign ID", "Ad set ID", "Ad ID"];

const allRows = bundle.files.flatMap((file) => file.rows);
const adParents = new Map<string, Set<string>>(); const adSetParents = new Map<string, Set<string>>();
for (const row of allRows) {
  if (row.accountId && row.adId && row.adSetId) adParents.set(`${row.accountId}|${row.adId}`, (adParents.get(`${row.accountId}|${row.adId}`) ?? new Set()).add(row.adSetId));
  if (row.accountId && row.adSetId && row.campaignId) adSetParents.set(`${row.accountId}|${row.adSetId}`, (adSetParents.get(`${row.accountId}|${row.adSetId}`) ?? new Set()).add(row.campaignId));
}

console.log(JSON.stringify({
  audit: "meta-export-contract",
  files: bundle.files.map((file, index) => ({
    file: `file-${index + 1}`,
    sourceView: file.sourceView,
    rowCount: file.rowCount,
    nonDailyRowCount: file.rows.filter((row) => !row.metricDate).length,
    firstDate: file.rows.map((row) => row.metricDate).filter(Boolean).sort()[0] ?? null,
    lastDate: file.rows.map((row) => row.metricDate).filter(Boolean).sort().at(-1) ?? null,
    distinctDateCount: new Set(file.rows.map((row) => row.metricDate).filter(Boolean)).size,
    distinctAdCount: new Set(file.rows.map((row) => row.adId).filter(Boolean)).size,
    missingStableIdentityRows: file.rows.filter((row) => !row.accountId || !row.campaignId || !row.adSetId || !row.adId).length,
    headers: csvHeader(inputs[index].bytes)
  })),
  bundle: {
    sourceGranularity: bundle.sourceGranularity,
    campaignIntervalEligible: bundle.campaignIntervalEligible,
    eligibilityReasons: bundle.eligibilityReasons,
    coreTimingEligible: bundle.coreTimingEligible,
    coreTimingEligibilityReasons: bundle.coreTimingEligibilityReasons,
    coreTimingCoverage: {start: bundle.reportingStart, end: bundle.reportingEnd, dates: bundle.files.find((file) => file.sourceView === "delivery")?.observedDateCount ?? 0, rows: bundle.files.filter((file) => file.sourceView === "delivery").reduce((sum, file) => sum + file.rowCount, 0), ads: bundle.files.find((file) => file.sourceView === "delivery")?.adCount ?? 0},
    enrichmentCompatibility: bundle.enrichmentCompatibility,
    enrichmentWarnings: bundle.enrichmentWarnings,
    commonCoverage: {start: bundle.commonReportingStart, end: bundle.commonReportingEnd, dates: bundle.commonObservedDateCount},
    sourceAsOfOrigin: bundle.sourceAsOfOrigin,
    sourceAsOfPresent: Boolean(bundle.sourceAsOf),
    stableIdHeadersPresent: Object.fromEntries(requiredStableHeaders.map((header) => [header, inputs.every((file) => csvHeader(file.bytes).includes(header))])),
    timezonePresent: bundle.files.every((file) => file.rows.every((row) => Boolean(row.accountTimezone))),
    currency: bundle.currency,
    currencyOrigin: bundle.currencyOrigin,
    currencyPresent: bundle.files.every((file) => file.rows.every((row) => Boolean(row.currency))),
    adHierarchyConflictCount: [...adParents.values()].filter((parents) => parents.size > 1).length,
    adSetHierarchyConflictCount: [...adSetParents.values()].filter((parents) => parents.size > 1).length,
    metricObservationCount: bundle.metricObservations.length,
    viewConflictSummary: bundle.viewConflicts.map(({field, code, conflictClass, observedViews, blocksCoreTimingEligibility, blocksEnrichmentCompatibility}) => ({field, code, conflictClass, observedViews, blocksCoreTimingEligibility, blocksEnrichmentCompatibility})),
    deliveryHistoricalSemantics: "NOT_PROVABLE_FROM_DAILY_ROWS_WITHOUT_HISTORICAL_STATUS_DOCUMENTATION",
    rawRowsPrinted: false
  }
}, null, 2));
