import {checksumSha256} from "@/lib/backups/encryption";

import type {
  SpotifyParserLimits,
  SpotifyPreviewPeriod,
  SpotifyValidationCode,
  SpotifyValidationIssue
} from "./spotify-export-types";

export const DEFAULT_SPOTIFY_PARSER_LIMITS: SpotifyParserLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRows: 100_000,
  maxColumns: 64
};

export const ALLOWED_SPOTIFY_CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain"
]);

export function hashRawSpotifyFile(bytes: Uint8Array) {
  return checksumSha256(Buffer.from(bytes));
}

export function sanitizeSpotifyDisplayValue(value: string, options: {loneDashPlaceholder?: boolean} = {}) {
  if (options.loneDashPlaceholder && value.trim() === "-") {
    return {originalValue: value, safeValue: value, escaped: false};
  }
  const firstVisible = value.trimStart()[0] ?? "";
  const escaped = ["=", "+", "-", "@"].includes(firstVisible);
  return {
    originalValue: value,
    safeValue: escaped ? `'${value}` : value,
    escaped
  };
}

export function parseSpotifyDateOnly(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function enumerateMissingSpotifyDates(dates: string[]) {
  const unique = [...new Set(dates)].sort();
  if (unique.length < 2) return [];
  const present = new Set(unique);
  const missing: string[] = [];
  let cursor = Date.parse(`${unique[0]}T00:00:00.000Z`);
  const end = Date.parse(`${unique[unique.length - 1]}T00:00:00.000Z`);
  for (cursor += 86_400_000; cursor < end; cursor += 86_400_000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    if (!present.has(date)) missing.push(date);
  }
  return missing;
}

export function parseSpotifyMetric(
  rawValue: string,
  field: string,
  rowNumber: number
): {value: number | null; issue?: SpotifyValidationIssue} {
  const value = rawValue.trim();
  if (!value) {
    return {value: null, issue: {code: "EMPTY_REQUIRED_VALUE", message: `${field} is required.`, field, rowNumber}};
  }
  if (/^-\d+$/.test(value)) {
    return {value: null, issue: {code: "NEGATIVE_METRIC", message: `${field} must not be negative.`, field, rowNumber}};
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return {value: null, issue: {code: "INVALID_INTEGER", message: `${field} must be a plain non-negative integer.`, field, rowNumber}};
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return {value: null, issue: {code: "INTEGER_OUT_OF_RANGE", message: `${field} exceeds the supported safe integer range.`, field, rowNumber}};
  }
  return {value: parsed};
}

export function validateSpotifyPreviewPeriod(period: SpotifyPreviewPeriod | null | undefined): {
  normalized: SpotifyPreviewPeriod | null;
  issue: SpotifyValidationIssue | null;
} {
  if (!period) return {normalized: null, issue: null};
  const periodStart = parseSpotifyDateOnly(period.periodStart);
  const periodEnd = parseSpotifyDateOnly(period.periodEnd);
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return {
      normalized: null,
      issue: {code: "INVALID_PERIOD", message: "Preview period must contain valid dates and start on or before its end."}
    };
  }
  return {normalized: {periodStart, periodEnd}, issue: null};
}

export function issue(
  code: SpotifyValidationCode,
  message: string,
  options: Pick<SpotifyValidationIssue, "field" | "rowNumber"> = {}
): SpotifyValidationIssue {
  return {code, message, ...options};
}
