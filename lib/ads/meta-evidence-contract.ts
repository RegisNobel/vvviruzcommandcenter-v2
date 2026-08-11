import {createHash} from "node:crypto";
import path from "node:path";

import {normalizeMetaHeader, type MetaMetricView} from "./meta-csv";

export const META_EVIDENCE_PARSER_VERSION = "meta-evidence-v4";
export const META_EVIDENCE_NORMALIZATION_VERSION = "meta-daily-v4";
export const META_IMPORT_MAX_FILES = 8;
export const META_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const META_IMPORT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export class MetaImportValidationError extends Error {
  readonly code: "DUPLICATE_IMPORT_FILE" | "INVALID_FILE";
  readonly status: 413 | 422;

  constructor(
    message: string,
    options: {
      code?: "DUPLICATE_IMPORT_FILE" | "INVALID_FILE";
      status?: 413 | 422;
    } = {}
  ) {
    super(message);
    this.name = "MetaImportValidationError";
    this.code = options.code ?? "INVALID_FILE";
    this.status = options.status ?? 422;
  }
}

export type MetaSourceGranularity = "DAILY" | "AGGREGATE_SNAPSHOT";
export type MetaCampaignEligibility = "ELIGIBLE" | "NOT_INTERVAL_ELIGIBLE";
export type MetaDayState = "ACTIVE_EVIDENCE" | "EXPLICIT_ZERO" | "UNKNOWN";
export type MetaMetricFamily = "SPEND" | "ATTRIBUTION_RESULT";
export type MetaSourceAsOfOrigin = "META_EXPORT" | "USER_CONFIRMED" | "IMPORT_ACCEPTED_FALLBACK" | "UNKNOWN";
export type MetaCurrencyOrigin = "SOURCE_COLUMN" | "METRIC_HEADER" | "USER_CONFIRMED" | "UNKNOWN";
export type MetaTimezoneOrigin = "META_SOURCE" | "USER_CONFIRMED" | "UNKNOWN";
export type MetaViewRole = "CORE_TIMING" | "VIDEO_ENRICHMENT" | "ENGAGEMENT_ENRICHMENT" | "REACH_ENRICHMENT" | "UNKNOWN";
export type MetaEnrichmentCompatibility = "COMPATIBLE" | "COMPATIBLE_WITH_GAPS" | "DEGRADED" | "INCOMPATIBLE" | "NOT_PRESENT";

export type MetaEvidenceInputFile = {fileName: string; bytes: Uint8Array; sourceView?: MetaMetricView};
export type MetaEvidenceContext = {
  attributionSetting: string;
  sourceAsOf?: string | null;
  sourceAsOfOrigin?: MetaSourceAsOfOrigin | null;
  confirmedCurrency?: string | null;
  manualTimezone?: string | null;
  manualTimezoneOrigin?: Exclude<MetaTimezoneOrigin, "UNKNOWN"> | null;
  expectedGranularity?: MetaSourceGranularity | null;
};

export type MetaEvidenceRow = {
  sourceFileHash: string;
  sourceFileName: string;
  sourceRowNumber: number;
  sourceView: MetaMetricView;
  accountId: string;
  accountName: string;
  accountTimezone: string;
  normalizedTimezone: string;
  timezoneSource: MetaTimezoneOrigin;
  currency: string;
  currencyOrigin: MetaCurrencyOrigin;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
  adId: string;
  adName: string;
  reportingStart: string;
  reportingEnd: string;
  metricDate: string | null;
  attributionSetting: string;
  resultMetricKey: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  results: number | null;
  resultIndicator: string;
  deliveryStatus: string;
  urlParameters: string;
  sourceAsOf: string | null;
  sourceAsOfOrigin: MetaSourceAsOfOrigin;
  identityKey: string | null;
};

export type MetaMetricObservation = MetaEvidenceRow & {
  metricFamily: MetaMetricFamily;
  metricKey: string;
  identityKey: string;
};

export type MetaViewConflict = {
  identity: string;
  field: string;
  code: string;
  conflictClass: "AUTHORITATIVE" | "CROSS_VIEW_RECONCILIATION" | "DESCRIPTIVE" | "IDENTITY";
  primaryView: MetaMetricView;
  observedViews: MetaMetricView[];
  blocksCampaignEligibility: boolean;
  blocksCoreTimingEligibility: boolean;
  blocksEnrichmentCompatibility: boolean;
};

export const META_SOURCE_VIEW_OWNERSHIP = {
  accountId: {required: true, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "BLOCK"},
  campaignId: {required: true, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "BLOCK"},
  adSetId: {required: true, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "BLOCK"},
  adId: {required: true, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "BLOCK"},
  reportingDate: {required: true, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "BLOCK"},
  spend: {required: true, primary: "delivery", allowed: ["video"], conflict: "CROSS_VIEW_RECONCILIATION"},
  results: {required: false, primary: "delivery", allowed: [], conflict: "BLOCK"},
  resultIndicator: {required: false, primary: "delivery", allowed: [], conflict: "BLOCK"},
  attributionSetting: {required: false, primary: "delivery", allowed: [], conflict: "BLOCK"},
  deliveryStatus: {required: false, primary: "delivery", allowed: ["engagement", "video", "reach"], conflict: "DESCRIPTIVE_WARNING"},
  urlParameters: {required: false, primary: "delivery", allowed: ["engagement"], conflict: "DESCRIPTIVE_WARNING"},
  impressions: {required: false, primary: "reach", allowed: ["delivery", "video"], conflict: "DESCRIPTIVE_WARNING"},
  reach: {required: false, primary: "reach", allowed: ["delivery", "video"], conflict: "DESCRIPTIVE_WARNING"}
} as const;

export type MetaEvidenceFile = {
  sha256: string;
  sanitizedFileName: string;
  sourceView: MetaMetricView;
  viewRole: MetaViewRole;
  rowCount: number;
  reportingStart: string | null;
  reportingEnd: string | null;
  observedDateCount: number;
  expectedDateCount: number | null;
  adCount: number;
  missingCoreDateCount: number;
  coverageState: "COMPLETE" | "GAPPED" | "NO_DAILY_COVERAGE";
  sizeBytes: number;
  warnings: string[];
  rows: MetaEvidenceRow[];
};

export type MetaEvidenceBundle = {
  bundleHash: string;
  sourceGranularity: MetaSourceGranularity;
  campaignEligibility: MetaCampaignEligibility;
  campaignIntervalEligible: boolean;
  eligibilityReasons: string[];
  coreTimingEligible: boolean;
  coreTimingEligibilityReasons: string[];
  enrichmentCompatibility: MetaEnrichmentCompatibility;
  enrichmentWarnings: string[];
  accountId: string;
  accountName: string;
  accountTimezone: string;
  normalizedTimezone: string;
  timezoneSource: MetaTimezoneOrigin;
  currency: string;
  currencyOrigin: MetaCurrencyOrigin;
  reportingStart: string | null;
  reportingEnd: string | null;
  commonReportingStart: string | null;
  commonReportingEnd: string | null;
  commonObservedDateCount: number;
  sourceAsOf: string | null;
  sourceAsOfOrigin: MetaSourceAsOfOrigin;
  files: MetaEvidenceFile[];
  mergedDailyRows: MetaEvidenceRow[];
  metricObservations: MetaMetricObservation[];
  viewConflicts: MetaViewConflict[];
  warnings: string[];
};

const aliases: Record<string, string> = {
  account_id: "accountId", ad_account_id: "accountId", account_name: "accountName", ad_account_name: "accountName",
  account_timezone: "accountTimezone", ad_account_timezone: "accountTimezone", time_zone: "accountTimezone",
  currency: "currency", account_currency: "currency",
  campaign_id: "campaignId", campaign_name: "campaignName", campaign: "campaignName",
  ad_set_id: "adSetId", adset_id: "adSetId", ad_set_name: "adSetName", adset_name: "adSetName",
  ad_id: "adId", ad_name: "adName", ad: "adName",
  reporting_date: "reportingStart", day: "reportingStart", date: "reportingStart", reporting_starts: "reportingStart", reporting_start: "reportingStart",
  reporting_ends: "reportingEnd", reporting_end: "reportingEnd",
  amount_spent: "spend", amount_spent_usd: "spend", spend: "spend", spent: "spend",
  impressions: "impressions", reach: "reach", results: "results", result_indicator: "resultIndicator",
  delivery: "deliveryStatus", ad_delivery: "deliveryStatus", attribution_setting: "attributionSetting",
  url_parameters: "urlParameters", website_url_parameters: "urlParameters", utm_parameters: "urlParameters",
  export_as_of: "sourceAsOf", exported_at: "sourceAsOf", source_as_of: "sourceAsOf"
};

const ianaAliases: Record<string, string> = {
  "america/new_york": "America/New_York", "eastern time": "America/New_York",
  "america/chicago": "America/Chicago", "central time": "America/Chicago",
  "america/denver": "America/Denver", "mountain time": "America/Denver",
  "america/los_angeles": "America/Los_Angeles", "pacific time": "America/Los_Angeles",
  utc: "UTC"
};

function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }
function clean(value: unknown) { return String(value ?? "").trim(); }
function currencyCode(value: unknown) { const code = clean(value).toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : ""; }
function metricHeaderCurrency(headers: string[]) {
  const currencies = headers.flatMap((header) => {
    const match = header.match(/\bamount\s+spent\s*\(([A-Za-z]{3})\)/i);
    return match ? [match[1].toUpperCase()] : [];
  });
  return [...new Set(currencies)].length === 1 ? currencies[0] : "";
}
function safeName(value: string) { return path.basename(value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 240) || "meta-export.csv"; }
function normalizeTimezone(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const aliased = ianaAliases[cleaned.toLowerCase()] ?? cleaned;
  try { new Intl.DateTimeFormat("en-US", {timeZone: aliased}).format(new Date()); return aliased; } catch { return ""; }
}
function dateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/);
  if (!match) return "";
  const candidate = `${match[1]}-${match[2]}-${match[3]}`;
  return new Date(`${candidate}T00:00:00.000Z`).toISOString().slice(0, 10) === candidate ? candidate : "";
}
function numberOrNull(value: string) {
  const cleaned = value.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;
  const parsed = Number(cleaned); return Number.isFinite(parsed) ? parsed : null;
}
export function parseMetaEvidenceCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell); if (row.some((item) => item.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell); if (row.some((item) => item.trim())) rows.push(row);
  if (quoted) throw new MetaImportValidationError("CSV contains an unterminated quoted field.");
  return rows;
}
function viewFor(headers: string[]): MetaMetricView {
  if (headers.some((header) => /video|thruplay/.test(header))) return "video";
  if (headers.some((header) => /amount_spent|results|result_indicator|attribution_setting|quality_ranking/.test(header))) return "delivery";
  if (headers.some((header) => /click|engagement|reaction|comment|save|share/.test(header))) return "engagement";
  if (headers.some((header) => /impressions|reach|frequency/.test(header))) return "reach";
  return "unknown";
}
function formulaWarning(value: string) { return /^[=+@]|^-(?!\d)/.test(value.trim()); }
function entityDayIdentity(row: MetaEvidenceRow) {
  if (!row.metricDate || !row.accountId || !row.campaignId || !row.adSetId || !row.adId) return null;
  return [row.accountId, row.campaignId, row.adSetId, row.adId, row.metricDate].join("|");
}

function spendIdentity(row: MetaEvidenceRow) {
  const base = entityDayIdentity(row); return base && row.currency ? `${base}|SPEND|${row.currency}` : null;
}
function resultIdentity(row: MetaEvidenceRow) {
  const base = entityDayIdentity(row); return base && row.resultMetricKey !== "NONE" ? `${base}|ATTRIBUTION_RESULT|${row.attributionSetting || "UNSPECIFIED"}|${row.resultMetricKey}` : null;
}
function sourceAuthority(origin: MetaSourceAsOfOrigin) {
  return origin === "META_EXPORT" ? 4 : origin === "USER_CONFIRMED" ? 3 : origin === "IMPORT_ACCEPTED_FALLBACK" ? 2 : 1;
}
function sourceViewRank(view: MetaMetricView, primary: MetaMetricView) { return view === primary ? 0 : view === "unknown" ? 9 : 1; }
function viewRole(view: MetaMetricView): MetaViewRole {
  return view === "delivery" ? "CORE_TIMING" : view === "video" ? "VIDEO_ENRICHMENT" : view === "engagement" ? "ENGAGEMENT_ENRICHMENT" : view === "reach" ? "REACH_ENRICHMENT" : "UNKNOWN";
}
function inclusiveDateCount(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.floor((new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
}
function conflict(input: Omit<MetaViewConflict, "blocksCampaignEligibility">): MetaViewConflict {
  return {...input, blocksCampaignEligibility: input.blocksCoreTimingEligibility};
}

function resolveAuthoritativeSpend(input: {rows: MetaEvidenceRow[]; coreReasons: string[]; enrichmentWarnings: string[]; warnings: string[]; conflicts: MetaViewConflict[]}) {
  const groups = new Map<string, MetaEvidenceRow[]>();
  for (const row of input.rows) {
    const key = spendIdentity(row); if (!key || row.spend === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const observations: MetaMetricObservation[] = [];
  for (const [identityKey, rows] of groups) {
    const authoritative = rows.filter((row) => row.sourceView === "delivery").sort((a, b) => a.sourceFileHash.localeCompare(b.sourceFileHash) || a.sourceRowNumber - b.sourceRowNumber);
    if (!authoritative.length) continue;
    const authoritativeValues = [...new Set(authoritative.map((row) => row.spend))];
    if (authoritativeValues.length > 1) {
      input.coreReasons.push("AUTHORITATIVE_SPEND_CONFLICT"); input.warnings.push("AUTHORITATIVE_SPEND_CONFLICT");
      input.conflicts.push(conflict({identity: identityKey, field: "spend", code: "AUTHORITATIVE_SPEND_CONFLICT", conflictClass: "AUTHORITATIVE", primaryView: "delivery", observedViews: ["delivery"], blocksCoreTimingEligibility: true, blocksEnrichmentCompatibility: true}));
    }
    const winner = authoritative[0];
    const copied = rows.filter((row) => row.sourceView !== "delivery");
    if (copied.some((row) => row.spend !== winner.spend)) {
      input.enrichmentWarnings.push("CROSS_VIEW_SPEND_MISMATCH"); input.warnings.push("CROSS_VIEW_SPEND_MISMATCH");
      input.conflicts.push(conflict({identity: identityKey, field: "spend", code: "CROSS_VIEW_SPEND_MISMATCH", conflictClass: "CROSS_VIEW_RECONCILIATION", primaryView: "delivery", observedViews: [...new Set(["delivery" as const, ...copied.map((row) => row.sourceView)])], blocksCoreTimingEligibility: false, blocksEnrichmentCompatibility: true}));
    }
    observations.push({...winner, sourceFileHash: [...new Set(authoritative.map((row) => row.sourceFileHash))].sort().join(","), metricFamily: "SPEND", metricKey: "SPEND", identityKey});
  }
  return observations;
}

function resolveDeliveryResults(rows: MetaEvidenceRow[], enrichmentWarnings: string[], warnings: string[], conflicts: MetaViewConflict[]) {
  const groups = new Map<string, MetaEvidenceRow[]>();
  for (const row of rows.filter((item) => item.sourceView === "delivery")) {
    const key = resultIdentity(row); if (!key || row.results === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const observations: MetaMetricObservation[] = [];
  for (const [identityKey, candidates] of groups) {
    const ordered = [...candidates].sort((a, b) => a.sourceFileHash.localeCompare(b.sourceFileHash) || a.sourceRowNumber - b.sourceRowNumber);
    if (new Set(ordered.map((row) => row.results)).size > 1) {
      enrichmentWarnings.push("AUTHORITATIVE_RESULT_CONFLICT"); warnings.push("AUTHORITATIVE_RESULT_CONFLICT");
      conflicts.push(conflict({identity: identityKey, field: "results", code: "AUTHORITATIVE_RESULT_CONFLICT", conflictClass: "AUTHORITATIVE", primaryView: "delivery", observedViews: ["delivery"], blocksCoreTimingEligibility: false, blocksEnrichmentCompatibility: true}));
    }
    observations.push({...ordered[0], sourceFileHash: [...new Set(ordered.map((row) => row.sourceFileHash))].sort().join(","), metricFamily: "ATTRIBUTION_RESULT", metricKey: ordered[0].resultMetricKey, identityKey});
  }
  return observations;
}

export function buildMetaEvidenceBundle(inputs: MetaEvidenceInputFile[], context: MetaEvidenceContext): MetaEvidenceBundle {
  if (!inputs.length || inputs.length > META_IMPORT_MAX_FILES) throw new MetaImportValidationError(`Upload between 1 and ${META_IMPORT_MAX_FILES} CSV files.`);
  const total = inputs.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (total > META_IMPORT_MAX_TOTAL_BYTES) throw new MetaImportValidationError("Meta import bundle exceeds the total size limit.", {status: 413});
  const manualTimezone = normalizeTimezone(context.manualTimezone ?? "");
  const files = inputs.map((input): MetaEvidenceFile => {
    if (input.bytes.byteLength > META_IMPORT_MAX_FILE_BYTES) throw new MetaImportValidationError("A Meta import file exceeds the per-file size limit.", {status: 413});
    let text: string;
    try { text = new TextDecoder("utf-8", {fatal: true}).decode(input.bytes); } catch { throw new MetaImportValidationError("Meta CSV files must be valid UTF-8."); }
    const matrix = parseMetaEvidenceCsv(text.replace(/^\uFEFF/, "")); if (matrix.length < 2) throw new MetaImportValidationError("Meta CSV file has no data rows.");
    const rawHeaders = matrix[0].map(clean);
    const normalizedHeaders = rawHeaders.map(normalizeMetaHeader); const sourceView = input.sourceView ?? viewFor(normalizedHeaders);
    const headerCurrency = metricHeaderCurrency(rawHeaders);
    const hash = sha256(input.bytes); const warnings: string[] = [];
    const rows = matrix.slice(1).map((cells, rowIndex): MetaEvidenceRow => {
      const values: Record<string, string> = {};
      normalizedHeaders.forEach((header, index) => { const field = aliases[header]; if (field) values[field] = clean(cells[index]); });
      if (cells.some(formulaWarning)) warnings.push(`FORMULA_PREFIX_PRESENT_ROW_${rowIndex + 2}`);
      const start = dateOnly(values.reportingStart ?? ""); const end = dateOnly(values.reportingEnd ?? "") || start;
      const providedTimezone = normalizeTimezone(values.accountTimezone ?? "");
      const tz = providedTimezone || manualTimezone;
      const resultIndicator = clean(values.resultIndicator); const resultMetricKey = normalizeMetaHeader(resultIndicator) || "NONE";
      const sourceAsOfFromExport = clean(values.sourceAsOf);
      const sourceAsOfRaw = sourceAsOfFromExport || clean(context.sourceAsOf);
      const sourceAsOf = sourceAsOfRaw && /(Z|[+-]\d{2}:\d{2})$/i.test(sourceAsOfRaw) && !Number.isNaN(new Date(sourceAsOfRaw).getTime())
        ? new Date(sourceAsOfRaw).toISOString()
        : null;
      const sourceAsOfOrigin: MetaSourceAsOfOrigin = sourceAsOf
        ? sourceAsOfFromExport ? "META_EXPORT" : context.sourceAsOfOrigin === "META_EXPORT" ? "META_EXPORT" : "USER_CONFIRMED"
        : "UNKNOWN";
      if (sourceAsOfRaw && !sourceAsOf) warnings.push("SOURCE_AS_OF_IGNORED_WITHOUT_OFFSET");
      const sourceCurrency = currencyCode(values.currency);
      const confirmedCurrency = currencyCode(context.confirmedCurrency);
      const currency = sourceCurrency || headerCurrency || confirmedCurrency;
      const currencyOrigin: MetaCurrencyOrigin = sourceCurrency ? "SOURCE_COLUMN" : headerCurrency ? "METRIC_HEADER" : confirmedCurrency ? "USER_CONFIRMED" : "UNKNOWN";
      const row: MetaEvidenceRow = {
        sourceFileHash: hash, sourceFileName: safeName(input.fileName), sourceRowNumber: rowIndex + 2, sourceView,
        accountId: clean(values.accountId), accountName: clean(values.accountName), accountTimezone: clean(values.accountTimezone) || clean(context.manualTimezone),
        normalizedTimezone: tz, timezoneSource: providedTimezone ? "META_SOURCE" : manualTimezone ? (context.manualTimezoneOrigin ?? "USER_CONFIRMED") : "UNKNOWN",
        currency, currencyOrigin, campaignId: clean(values.campaignId), campaignName: clean(values.campaignName),
        adSetId: clean(values.adSetId), adSetName: clean(values.adSetName), adId: clean(values.adId), adName: clean(values.adName),
        reportingStart: start, reportingEnd: end, metricDate: start && start === end ? start : null,
        attributionSetting: clean(values.attributionSetting) || clean(context.attributionSetting), resultMetricKey,
        spend: numberOrNull(values.spend ?? ""), impressions: numberOrNull(values.impressions ?? ""), reach: numberOrNull(values.reach ?? ""),
        results: numberOrNull(values.results ?? ""), resultIndicator, deliveryStatus: clean(values.deliveryStatus), urlParameters: clean(values.urlParameters),
        sourceAsOf, sourceAsOfOrigin, identityKey: null
      };
      row.identityKey = entityDayIdentity(row); return row;
    });
    const dates = [...new Set(rows.map((row) => row.metricDate).filter((value): value is string => Boolean(value)))].sort();
    const reportingStart = dates[0] ?? null; const reportingEnd = dates.at(-1) ?? null; const expectedDateCount = inclusiveDateCount(reportingStart, reportingEnd);
    return {sha256: hash, sanitizedFileName: safeName(input.fileName), sourceView, viewRole: viewRole(sourceView), rowCount: rows.length, reportingStart, reportingEnd, observedDateCount: dates.length, expectedDateCount, adCount: new Set(rows.map((row) => row.adId).filter(Boolean)).size, missingCoreDateCount: 0, coverageState: !dates.length ? "NO_DAILY_COVERAGE" : expectedDateCount === dates.length ? "COMPLETE" : "GAPPED", sizeBytes: input.bytes.byteLength, warnings: [...new Set(warnings)], rows};
  });
  const duplicateHashes = files.filter((file, index) => files.findIndex((candidate) => candidate.sha256 === file.sha256) !== index);
  if (duplicateHashes.length) {
    throw new MetaImportValidationError(
      "Remove the duplicate source file; the same source file was selected more than once. Then retry the preview.",
      {code: "DUPLICATE_IMPORT_FILE", status: 422}
    );
  }
  const allRows = files.flatMap((file) => file.rows);
  const coreRows = allRows.filter((row) => row.sourceView === "delivery");
  const enrichmentRows = allRows.filter((row) => row.sourceView !== "delivery");
  const observedCoreCurrencies = [...new Set(coreRows.map((row) => row.currency).filter(Boolean))];
  if (observedCoreCurrencies.length === 1) {
    const inheritedCurrency = observedCoreCurrencies[0];
    const inheritedOrigin = coreRows.find((row) => row.currency === inheritedCurrency)?.currencyOrigin ?? "UNKNOWN";
    for (const row of allRows) if (!row.currency) { row.currency = inheritedCurrency; row.currencyOrigin = inheritedOrigin; }
  }
  const daily = allRows.every((row) => Boolean(row.metricDate));
  const sourceGranularity: MetaSourceGranularity = daily ? "DAILY" : "AGGREGATE_SNAPSHOT";
  const warnings: string[] = []; const coreReasons: string[] = []; const enrichmentWarnings: string[] = [];
  const consistentCore = (selector: (row: MetaEvidenceRow) => string, code: string, required = true) => {
    const values = [...new Set(coreRows.map(selector).filter(Boolean))]; if ((required && !values.length) || values.length > 1) coreReasons.push(code); return values[0] ?? "";
  };
  const accountId = consistentCore((row) => row.accountId, "ACCOUNT_ID_MISSING_OR_CONFLICTING");
  const accountName = consistentCore((row) => row.accountName, "ACCOUNT_NAME_CONFLICTING", false);
  const normalizedTimezone = consistentCore((row) => row.normalizedTimezone, "TIMEZONE_MISSING_OR_AMBIGUOUS");
  const accountTimezone = consistentCore((row) => row.accountTimezone, "SOURCE_TIMEZONE_CONFLICTING", false);
  const currency = consistentCore((row) => row.currency, "CURRENCY_MISSING_OR_CONFLICTING");
  const currencyOrigin = currency ? (coreRows.find((row) => row.currency === currency)?.currencyOrigin ?? "UNKNOWN") : "UNKNOWN";
  if (!coreRows.length) coreReasons.push("DELIVERY_VIEW_REQUIRED");
  if (context.expectedGranularity === "DAILY" && coreRows.some((row) => !row.metricDate)) coreReasons.push("DECLARED_GRANULARITY_MISMATCH");
  if (coreRows.some((row) => !row.metricDate)) coreReasons.push("CORE_TIMING_NOT_DAILY");
  if (coreRows.some((row) => row.spend === null)) coreReasons.push("DAILY_SPEND_REQUIRED");
  if (coreRows.some((row) => !row.accountId || !row.campaignId || !row.adSetId || !row.adId || !row.metricDate)) coreReasons.push("STABLE_DAILY_IDENTITY_INCOMPLETE");
  if (enrichmentRows.some((row) => !row.accountId || !row.campaignId || !row.adSetId || !row.adId || !row.metricDate)) enrichmentWarnings.push("ENRICHMENT_IDENTITY_OR_DATE_INCOMPLETE");
  const coreAdParents = new Map<string, Set<string>>(); const coreAdSetParents = new Map<string, Set<string>>();
  for (const row of coreRows) {
    if (row.accountId && row.adId && row.adSetId) coreAdParents.set(`${row.accountId}|${row.adId}`, (coreAdParents.get(`${row.accountId}|${row.adId}`) ?? new Set()).add(row.adSetId));
    if (row.accountId && row.adSetId && row.campaignId) coreAdSetParents.set(`${row.accountId}|${row.adSetId}`, (coreAdSetParents.get(`${row.accountId}|${row.adSetId}`) ?? new Set()).add(row.campaignId));
  }
  const adHierarchyConflicts = [...coreAdParents.entries()].filter(([, parents]) => parents.size > 1).map(([identity]) => identity);
  const adSetHierarchyConflicts = [...coreAdSetParents.entries()].filter(([, parents]) => parents.size > 1).map(([identity]) => identity);
  if (adHierarchyConflicts.length) coreReasons.push("AD_HIERARCHY_CONFLICT");
  if (adSetHierarchyConflicts.length) coreReasons.push("AD_SET_HIERARCHY_CONFLICT");
  const allAdParents = new Map<string, Set<string>>(); const allAdSetParents = new Map<string, Set<string>>();
  for (const row of allRows) {
    if (row.accountId && row.adId && row.adSetId) allAdParents.set(`${row.accountId}|${row.adId}`, (allAdParents.get(`${row.accountId}|${row.adId}`) ?? new Set()).add(row.adSetId));
    if (row.accountId && row.adSetId && row.campaignId) allAdSetParents.set(`${row.accountId}|${row.adSetId}`, (allAdSetParents.get(`${row.accountId}|${row.adSetId}`) ?? new Set()).add(row.campaignId));
  }
  const crossAdHierarchyConflicts = [...allAdParents.entries()].filter(([identity, parents]) => parents.size > 1 && !adHierarchyConflicts.includes(identity)).map(([identity]) => identity);
  const crossAdSetHierarchyConflicts = [...allAdSetParents.entries()].filter(([identity, parents]) => parents.size > 1 && !adSetHierarchyConflicts.includes(identity)).map(([identity]) => identity);
  if (crossAdHierarchyConflicts.length) enrichmentWarnings.push("CROSS_VIEW_AD_HIERARCHY_CONFLICT");
  if (crossAdSetHierarchyConflicts.length) enrichmentWarnings.push("CROSS_VIEW_AD_SET_HIERARCHY_CONFLICT");
  const enrichmentAccounts = [...new Set(enrichmentRows.map((row) => row.accountId).filter(Boolean))];
  if (accountId && enrichmentAccounts.some((value) => value !== accountId)) enrichmentWarnings.push("INCOMPATIBLE_ENRICHMENT_ACCOUNT");
  if (files.some((file) => file.sourceView === "unknown")) warnings.push("UNKNOWN_SOURCE_VIEW");
  const viewConflicts: MetaViewConflict[] = [];
  for (const identity of adHierarchyConflicts) viewConflicts.push(conflict({identity, field: "adSetId", code: "AD_HIERARCHY_CONFLICT", conflictClass: "IDENTITY", primaryView: "delivery", observedViews: ["delivery"], blocksCoreTimingEligibility: true, blocksEnrichmentCompatibility: true}));
  for (const identity of adSetHierarchyConflicts) viewConflicts.push(conflict({identity, field: "campaignId", code: "AD_SET_HIERARCHY_CONFLICT", conflictClass: "IDENTITY", primaryView: "delivery", observedViews: ["delivery"], blocksCoreTimingEligibility: true, blocksEnrichmentCompatibility: true}));
  for (const identity of crossAdHierarchyConflicts) viewConflicts.push(conflict({identity, field: "adSetId", code: "CROSS_VIEW_AD_HIERARCHY_CONFLICT", conflictClass: "IDENTITY", primaryView: "delivery", observedViews: [...new Set(allRows.filter((row) => `${row.accountId}|${row.adId}` === identity).map((row) => row.sourceView))], blocksCoreTimingEligibility: false, blocksEnrichmentCompatibility: true}));
  for (const identity of crossAdSetHierarchyConflicts) viewConflicts.push(conflict({identity, field: "campaignId", code: "CROSS_VIEW_AD_SET_HIERARCHY_CONFLICT", conflictClass: "IDENTITY", primaryView: "delivery", observedViews: [...new Set(allRows.filter((row) => `${row.accountId}|${row.adSetId}` === identity).map((row) => row.sourceView))], blocksCoreTimingEligibility: false, blocksEnrichmentCompatibility: true}));
  const metricObservations = [
    ...resolveAuthoritativeSpend({rows: allRows, coreReasons, enrichmentWarnings, warnings, conflicts: viewConflicts}),
    ...resolveDeliveryResults(allRows, enrichmentWarnings, warnings, viewConflicts)
  ];
  const byIdentity = new Map<string, MetaEvidenceRow>();
  for (const row of coreRows) if (row.identityKey && !byIdentity.has(row.identityKey)) byIdentity.set(row.identityKey, {...row});
  for (const row of enrichmentRows) {
    if (!row.identityKey) continue;
    const prior = byIdentity.get(row.identityKey);
    if (!prior) continue;
    const merge = <K extends keyof MetaEvidenceRow>(key: K) => {
      if ((prior[key] === null || prior[key] === "") && row[key] !== null && row[key] !== "") {
        (prior as Record<string, unknown>)[key] = row[key];
      } else if (row[key] !== null && row[key] !== "" && prior[key] !== row[key]) {
        const field = String(key);
        warnings.push(`VIEW_CONFLICT_${field}`);
        if (!viewConflicts.some((conflict) => conflict.identity === row.identityKey && conflict.field === field)) {
          viewConflicts.push(conflict({identity: row.identityKey!, field, code: `VIEW_CONFLICT_${field}`, conflictClass: "DESCRIPTIVE", primaryView: field === "impressions" || field === "reach" ? "reach" : "delivery", observedViews: [...new Set([prior.sourceView, row.sourceView])], blocksCoreTimingEligibility: false, blocksEnrichmentCompatibility: false}));
        }
      }
    };
    (["accountName", "campaignName", "adSetName", "adName", "impressions", "reach", "deliveryStatus", "urlParameters"] as const).forEach(merge);
    prior.sourceFileHash = [...new Set([prior.sourceFileHash, row.sourceFileHash])].sort().join(",");
  }
  const byLabelDay = new Map<string, MetaEvidenceRow[]>();
  for (const row of coreRows) {
    if (!row.metricDate || !row.accountName || !row.campaignName || !row.adSetName || !row.adName) continue;
    const labelDay = [row.accountName, row.campaignName, row.adSetName, row.adName, row.metricDate].map((value) => value.toLowerCase()).join("|");
    byLabelDay.set(labelDay, [...(byLabelDay.get(labelDay) ?? []), row]);
  }
  for (const rows of byLabelDay.values()) {
    const stableIdentities = [...new Set(rows.map((row) => [row.accountId, row.campaignId, row.adSetId, row.adId].join("|")))];
    if (stableIdentities.length <= 1) continue;
    const identity = rows[0].identityKey ?? "UNRESOLVED_LABEL_DAY";
    coreReasons.push("VIEW_CONFLICT_STABLE_IDENTITY"); warnings.push("VIEW_CONFLICT_STABLE_IDENTITY");
    viewConflicts.push(conflict({identity, field: "stableIdentity", code: "VIEW_CONFLICT_STABLE_IDENTITY", conflictClass: "IDENTITY", primaryView: "delivery", observedViews: ["delivery"], blocksCoreTimingEligibility: true, blocksEnrichmentCompatibility: true}));
  }
  const coreDates = [...new Set(coreRows.map((row) => row.metricDate).filter((value): value is string => Boolean(value)))].sort();
  const coreDateSet = new Set(coreDates);
  for (const file of files) file.missingCoreDateCount = [...coreDateSet].filter((date) => !file.rows.some((row) => row.metricDate === date)).length;
  const fileDateSets = files.map((file) => new Set(file.rows.map((row) => row.metricDate).filter((value): value is string => Boolean(value))));
  const commonDates = fileDateSets.length ? [...fileDateSets[0]].filter((date) => fileDateSets.every((dates) => dates.has(date))).sort() : [];
  const sourceAsOfValues = [...new Set(coreRows.map((row) => row.sourceAsOf).filter((value): value is string => Boolean(value)))];
  const sourceAsOf = sourceAsOfValues.length === 1 ? sourceAsOfValues[0] : null;
  if (sourceAsOfValues.length > 1) warnings.push("SOURCE_AS_OF_CONFLICTING");
  const sourceAsOfOrigin = sourceAsOf ? (coreRows.every((row) => row.sourceAsOfOrigin === "META_EXPORT") ? "META_EXPORT" : "USER_CONFIRMED") : "UNKNOWN";
  const optionalFiles = files.filter((file) => file.sourceView !== "delivery");
  const hasCoverageGaps = optionalFiles.some((file) => file.missingCoreDateCount > 0 || file.coverageState !== "COMPLETE");
  if (hasCoverageGaps) enrichmentWarnings.push("PARTIAL_ENRICHMENT_COVERAGE");
  const uniqueCoreReasons = [...new Set(coreReasons)]; const coreEligible = uniqueCoreReasons.length === 0;
  const uniqueEnrichmentWarnings = [...new Set(enrichmentWarnings)];
  const enrichmentCompatibility: MetaEnrichmentCompatibility = !optionalFiles.length ? "NOT_PRESENT"
    : uniqueEnrichmentWarnings.some((item) => item.startsWith("INCOMPATIBLE_") || item.startsWith("CROSS_VIEW_AD")) ? "INCOMPATIBLE"
    : uniqueEnrichmentWarnings.some((item) => item.includes("CONFLICT") || item.includes("MISMATCH")) ? "DEGRADED"
    : hasCoverageGaps ? "COMPATIBLE_WITH_GAPS" : "COMPATIBLE";
  return {
    bundleHash: sha256(files.map((file) => file.sha256).sort().join("|")), sourceGranularity,
    campaignEligibility: coreEligible ? "ELIGIBLE" : "NOT_INTERVAL_ELIGIBLE", campaignIntervalEligible: coreEligible,
    eligibilityReasons: uniqueCoreReasons, coreTimingEligible: coreEligible, coreTimingEligibilityReasons: uniqueCoreReasons, enrichmentCompatibility, enrichmentWarnings: uniqueEnrichmentWarnings,
    accountId, accountName, accountTimezone, normalizedTimezone,
    timezoneSource: normalizedTimezone ? (coreRows.some((row) => row.timezoneSource === "META_SOURCE") ? "META_SOURCE" : context.manualTimezoneOrigin ?? "USER_CONFIRMED") : "UNKNOWN",
    currency, currencyOrigin, reportingStart: coreDates[0] ?? null, reportingEnd: coreDates.at(-1) ?? null,
    commonReportingStart: commonDates[0] ?? null, commonReportingEnd: commonDates.at(-1) ?? null, commonObservedDateCount: commonDates.length, sourceAsOf, sourceAsOfOrigin,
    files, mergedDailyRows: [...byIdentity.values()], metricObservations, viewConflicts,
    warnings: [...new Set([...warnings, ...uniqueEnrichmentWarnings, ...files.flatMap((file) => file.warnings)])]
  };
}

export type CanonicalCandidate = MetaEvidenceRow & {id: string; acceptedAt: string; importState: "ACCEPTED" | "WITHDRAWN" | "REPLACED"};
export function resolveCanonicalDaily(candidates: CanonicalCandidate[]) {
  const active = candidates.filter((candidate) => candidate.identityKey && candidate.importState === "ACCEPTED");
  const groups = new Map<string, CanonicalCandidate[]>();
  for (const candidate of active) groups.set(candidate.identityKey!, [...(groups.get(candidate.identityKey!) ?? []), candidate]);
  return [...groups.entries()].map(([identityKey, values]) => {
    const sorted = values.sort((left, right) => {
      const authority = sourceAuthority(right.sourceAsOfOrigin) - sourceAuthority(left.sourceAsOfOrigin);
      if (authority) return authority;
      const authoritativeTime = sourceAuthority(left.sourceAsOfOrigin) && sourceAuthority(right.sourceAsOfOrigin)
        ? (right.sourceAsOf ?? "").localeCompare(left.sourceAsOf ?? "") : 0;
      return authoritativeTime || right.acceptedAt.localeCompare(left.acceptedAt) || right.id.localeCompare(left.id);
    });
    return {identityKey, winner: sorted[0], superseded: sorted.slice(1), precedence: ["sourceAsOf origin trust: META_EXPORT > USER_CONFIRMED > IMPORT_ACCEPTED_FALLBACK > UNKNOWN", "sourceAsOf DESC within equal origin", "acceptedAt DESC", "id DESC"]};
  });
}

export function resolveMetaDayState(observation: Pick<MetaEvidenceRow, "spend"> | null): MetaDayState {
  if (!observation || observation.spend === null) return "UNKNOWN";
  return observation.spend > 0 ? "ACTIVE_EVIDENCE" : observation.spend === 0 ? "EXPLICIT_ZERO" : "UNKNOWN";
}

export function chooseSnapshotRanking<T extends {reportingEnd: string; exportedAt: string; spend: number}>(rows: T[]) {
  return [...rows].sort((left, right) => right.reportingEnd.localeCompare(left.reportingEnd) || right.exportedAt.localeCompare(left.exportedAt))[0] ?? null;
}
