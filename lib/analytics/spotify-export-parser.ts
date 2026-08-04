import path from "node:path";

import {detectSpotifyExportSchema, normalizeSpotifyHeader, type SpotifyExportSchema} from "./spotify-export-schemas";
import {
  SPOTIFY_EXPORT_NORMALIZATION_VERSION,
  SPOTIFY_EXPORT_PARSER_VERSION,
  type ArtistAudienceTimelineRow,
  type PlaylistsPeriodRow,
  type SongsPeriodRow,
  type SpotifyExportFileInput,
  type SpotifyExportParseResult,
  type SpotifyNormalizedRow,
  type SpotifyParserLimits,
  type SpotifyPreviewRow,
  type SpotifyValidationIssue,
  type TrackStreamTimelineRow
} from "./spotify-export-types";
import {
  ALLOWED_SPOTIFY_CSV_MIME_TYPES,
  DEFAULT_SPOTIFY_PARSER_LIMITS,
  enumerateMissingSpotifyDates,
  hashRawSpotifyFile,
  issue,
  parseSpotifyDateOnly,
  parseSpotifyMetric,
  sanitizeSpotifyDisplayValue,
  validateSpotifyPreviewPeriod
} from "./spotify-export-validation";

type CsvRow = {rowNumber: number; cells: string[]};
type CsvResult = {rows: CsvRow[]; error: SpotifyValidationIssue | null};

function parseStrictCsv(text: string): CsvResult {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteClosed = false;
  let line = 1;
  let rowStart = 1;

  const endCell = () => {
    cells.push(current);
    current = "";
    quoteClosed = false;
  };
  const endRow = () => {
    endCell();
    if (cells.some((cell) => cell.trim() !== "")) rows.push({rowNumber: rowStart, cells});
    cells = [];
    rowStart = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
        quoteClosed = true;
      } else {
        current += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (quoteClosed) {
      if (char === ",") {
        endCell();
        continue;
      }
      if (char === "\r" || char === "\n") {
        if (char === "\r" && next === "\n") index += 1;
        endRow();
        line += 1;
        continue;
      }
      return {rows, error: issue("MALFORMED_CSV", `Unexpected character after a closing quote on line ${line}.`)};
    }

    if (char === '"') {
      if (current !== "") return {rows, error: issue("MALFORMED_CSV", `Unexpected quote on line ${line}.`)};
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      endCell();
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && next === "\n") index += 1;
      endRow();
      line += 1;
      continue;
    }
    current += char;
  }

  if (inQuotes) return {rows, error: issue("MALFORMED_CSV", "CSV contains an unterminated quoted field.")};
  endRow();
  return {rows, error: null};
}

function baseResult(input: SpotifyExportFileInput, bytes: Uint8Array | null): SpotifyExportParseResult {
  return {
    detectedType: null,
    dataLabel: null,
    originalHeaders: [],
    normalizedHeaders: [],
    fileMetadata: {
      fileName: input.fileName,
      safeDisplayFileName: sanitizeSpotifyDisplayValue(input.fileName).safeValue,
      extension: path.extname(input.fileName).toLowerCase(),
      mimeType: input.mimeType?.trim() || null,
      sizeBytes: bytes?.byteLength ?? 0,
      sha256: bytes ? hashRawSpotifyFile(bytes) : null,
      encoding: null,
      hadUtf8Bom: false
    },
    rowCount: 0,
    acceptedCount: 0,
    warningCount: 0,
    rejectedCount: 0,
    unmatchedCount: 0,
    rows: [],
    dateRange: null,
    missingDates: [],
    requiresPeriodConfirmation: false,
    previewPeriod: null,
    blockingErrors: [],
    fileWarnings: [],
    parserVersion: SPOTIFY_EXPORT_PARSER_VERSION,
    normalizationVersion: SPOTIFY_EXPORT_NORMALIZATION_VERSION
  };
}

function originalValues(headers: string[], cells: string[]) {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  headers.forEach((header, index) => {
    let key = header || `column ${index + 1}`;
    let suffix = 2;
    while (key in result) key = `${header || `column ${index + 1}`} [${suffix++}]`;
    result[key] = cells[index] ?? "";
  });
  for (let index = headers.length; index < cells.length; index += 1) {
    result[`extra column ${index - headers.length + 1}`] = cells[index];
  }
  return result;
}

function displayValues(
  original: Record<string, string>,
  schema: SpotifyExportSchema | null,
  warnings: SpotifyValidationIssue[],
  rowNumber: number
) {
  return Object.fromEntries(Object.entries(original).map(([header, value]) => {
    const loneDashPlaceholder = schema?.type === "PLAYLISTS_PERIOD" && normalizeSpotifyHeader(header) === "date added";
    const sanitized = sanitizeSpotifyDisplayValue(value, {loneDashPlaceholder});
    if (sanitized.escaped) {
      warnings.push(issue("FORMULA_PREFIX_ESCAPED", `${header} was neutralized for safe spreadsheet display.`, {field: header, rowNumber}));
    }
    return [header, sanitized.safeValue];
  }));
}

function rejectedRows(csvRows: CsvRow[], headers: string[], errors: SpotifyValidationIssue[]) {
  return csvRows.map<SpotifyPreviewRow>((row) => {
    const warnings: SpotifyValidationIssue[] = [];
    const original = originalValues(headers, row.cells);
    return {
      originalRowNumber: row.rowNumber,
      outcome: "REJECTED",
      originalValues: original,
      safeDisplayValues: displayValues(original, null, warnings, row.rowNumber),
      normalizedValues: null,
      errors: errors.map((error) => ({...error, rowNumber: row.rowNumber})),
      warnings
    };
  });
}

function headerIndex(headers: string[]) {
  return new Map(headers.map((header, index) => [header, index]));
}

function parseRequiredText(value: string, field: string, rowNumber: number, errors: SpotifyValidationIssue[]) {
  const normalized = value.trim();
  if (!normalized) errors.push(issue("EMPTY_REQUIRED_VALUE", `${field} is required.`, {field, rowNumber}));
  return normalized;
}

function dateValue(value: string, field: string, rowNumber: number, errors: SpotifyValidationIssue[]) {
  const parsed = parseSpotifyDateOnly(value);
  if (!parsed) errors.push(issue("INVALID_DATE", `${field} must be a valid YYYY-MM-DD calendar date.`, {field, rowNumber}));
  return parsed;
}

function metrics(
  cells: string[],
  indexes: Map<string, number>,
  fields: string[],
  rowNumber: number,
  errors: SpotifyValidationIssue[]
) {
  return Object.fromEntries(fields.map((field) => {
    const parsed = parseSpotifyMetric(cells[indexes.get(field) ?? -1] ?? "", field, rowNumber);
    if (parsed.issue) errors.push(parsed.issue);
    return [field, parsed.value];
  })) as Record<string, number | null>;
}

function normalizeRow(
  schema: SpotifyExportSchema,
  cells: string[],
  indexes: Map<string, number>,
  rowNumber: number,
  errors: SpotifyValidationIssue[],
  warnings: SpotifyValidationIssue[]
): SpotifyNormalizedRow | null {
  if (schema.type === "ARTIST_AUDIENCE_TIMELINE") {
    const metricDate = dateValue(cells[indexes.get("date") ?? -1] ?? "", "date", rowNumber, errors);
    const values = metrics(cells, indexes, ["listeners", "monthly listeners", "monthly active listeners", "streams", "playlist adds", "saves", "followers"], rowNumber, errors);
    if (!metricDate || errors.length) return null;
    return {
      metricDate,
      listeners: values.listeners!,
      monthlyListeners: values["monthly listeners"]!,
      monthlyActiveListeners: values["monthly active listeners"]!,
      streams: values.streams!,
      playlistAdds: values["playlist adds"]!,
      saves: values.saves!,
      followers: values.followers!
    } satisfies ArtistAudienceTimelineRow;
  }

  if (schema.type === "TRACK_STREAM_TIMELINE") {
    const metricDate = dateValue(cells[indexes.get("date") ?? -1] ?? "", "date", rowNumber, errors);
    const values = metrics(cells, indexes, ["streams"], rowNumber, errors);
    if (!metricDate || errors.length) return null;
    warnings.push(issue("IDENTITY_NOT_PRESENT", "Track identity is not present in this export and must be supplied during mapping.", {rowNumber}));
    return {metricDate, streams: values.streams!} satisfies TrackStreamTimelineRow;
  }

  if (schema.type === "SONGS_PERIOD") {
    const exportedTitle = parseRequiredText(cells[indexes.get("song") ?? -1] ?? "", "song", rowNumber, errors);
    const exportedReleaseDate = dateValue(cells[indexes.get("release date") ?? -1] ?? "", "release date", rowNumber, errors);
    const values = metrics(cells, indexes, ["listeners", "streams", "saves"], rowNumber, errors);
    if (!exportedTitle || !exportedReleaseDate || errors.length) return null;
    warnings.push(issue("IDENTITY_NOT_PRESENT", "Stable track and release identity is not present and requires future catalog mapping.", {rowNumber}));
    return {exportedTitle, exportedReleaseDate, listeners: values.listeners!, streams: values.streams!, saves: values.saves!} satisfies SongsPeriodRow;
  }

  const playlistTitle = parseRequiredText(cells[indexes.get("playlist title") ?? -1] ?? "", "playlist title", rowNumber, errors);
  const playlistAuthor = parseRequiredText(cells[indexes.get("author") ?? -1] ?? "", "author", rowNumber, errors);
  const values = metrics(cells, indexes, ["listeners", "streams"], rowNumber, errors);
  const rawDateAdded = (cells[indexes.get("date added") ?? -1] ?? "").trim();
  let dateAdded: string | null = null;
  if (!rawDateAdded || rawDateAdded.toLowerCase() === "n/a" || rawDateAdded === "-") {
    warnings.push(issue("DATE_ADDED_NOT_AVAILABLE", "Playlist date added is not available and was normalized to null.", {field: "date added", rowNumber}));
  } else {
    dateAdded = dateValue(rawDateAdded, "date added", rowNumber, errors);
  }
  if (!playlistTitle || !playlistAuthor || errors.length) return null;
  return {playlistTitle, playlistAuthor, listeners: values.listeners!, streams: values.streams!, dateAdded} satisfies PlaylistsPeriodRow;
}

function duplicateKey(type: SpotifyExportSchema["type"], normalized: SpotifyNormalizedRow) {
  if (type === "ARTIST_AUDIENCE_TIMELINE" || type === "TRACK_STREAM_TIMELINE") {
    return (normalized as ArtistAudienceTimelineRow | TrackStreamTimelineRow).metricDate;
  }
  if (type === "SONGS_PERIOD") {
    const row = normalized as SongsPeriodRow;
    return `${row.exportedTitle}\u0000${row.exportedReleaseDate}`;
  }
  const row = normalized as PlaylistsPeriodRow;
  return `${row.playlistTitle}\u0000${row.playlistAuthor}\u0000${row.dateAdded ?? ""}`;
}

function applyDuplicateErrors(rows: SpotifyPreviewRow[], schema: SpotifyExportSchema) {
  const byKey = new Map<string, SpotifyPreviewRow[]>();
  for (const row of rows) {
    if (!row.normalizedValues || row.errors.length) continue;
    const key = duplicateKey(schema.type, row.normalizedValues);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  for (const duplicates of byKey.values()) {
    if (duplicates.length < 2) continue;
    const code = schema.type.endsWith("TIMELINE") ? "DUPLICATE_DATE" : "DUPLICATE_LOGICAL_ROW";
    for (const row of duplicates) {
      row.errors.push(issue(code, "This row has the same logical identity as another row in the file.", {rowNumber: row.originalRowNumber}));
    }
  }
}

function finalizeRows(result: SpotifyExportParseResult, schema: SpotifyExportSchema) {
  for (const row of result.rows) {
    row.outcome = row.errors.length
      ? "REJECTED"
      : row.warnings.some(({code}) => code === "IDENTITY_NOT_PRESENT")
        ? "UNMATCHED"
        : row.warnings.length
          ? "WARNING"
          : "ACCEPTED";
  }
  if (schema.type.endsWith("TIMELINE")) {
    result.rows.sort((left, right) => {
      const leftDate = (left.normalizedValues as ArtistAudienceTimelineRow | TrackStreamTimelineRow | null)?.metricDate;
      const rightDate = (right.normalizedValues as ArtistAudienceTimelineRow | TrackStreamTimelineRow | null)?.metricDate;
      if (leftDate && rightDate) return leftDate.localeCompare(rightDate) || left.originalRowNumber - right.originalRowNumber;
      if (leftDate) return -1;
      if (rightDate) return 1;
      return left.originalRowNumber - right.originalRowNumber;
    });
    const dates = result.rows.flatMap((row) => {
      const date = (row.normalizedValues as ArtistAudienceTimelineRow | TrackStreamTimelineRow | null)?.metricDate;
      return date ? [date] : [];
    });
    if (dates.length) {
      const sorted = [...new Set(dates)].sort();
      result.missingDates = enumerateMissingSpotifyDates(sorted);
      result.dateRange = {minimumDate: sorted[0], maximumDate: sorted[sorted.length - 1], missingDateCount: result.missingDates.length};
    }
  }
  result.acceptedCount = result.rows.filter(({outcome}) => outcome === "ACCEPTED").length;
  result.warningCount = result.rows.filter(({outcome}) => outcome === "WARNING").length;
  result.rejectedCount = result.rows.filter(({outcome}) => outcome === "REJECTED").length;
  result.unmatchedCount = result.rows.filter(({outcome}) => outcome === "UNMATCHED").length;
}

export function parseSpotifyExport(input: SpotifyExportFileInput): SpotifyExportParseResult {
  const bytes = input.bytes ? new Uint8Array(input.bytes) : null;
  const result = baseResult(input, bytes);
  const limits: SpotifyParserLimits = {...DEFAULT_SPOTIFY_PARSER_LIMITS, ...input.limits};
  if (!bytes) {
    result.blockingErrors.push(issue("FILE_NOT_FOUND", "File bytes are required."));
    return result;
  }
  if (result.fileMetadata.extension !== ".csv") result.blockingErrors.push(issue("UNSUPPORTED_EXTENSION", "Only .csv files are supported."));
  const mime = input.mimeType?.split(";", 1)[0].trim().toLowerCase();
  if (mime && !ALLOWED_SPOTIFY_CSV_MIME_TYPES.has(mime)) result.blockingErrors.push(issue("UNSUPPORTED_MIME", `Unsupported CSV MIME type: ${mime}.`));
  if (bytes.byteLength === 0) result.blockingErrors.push(issue("EMPTY_FILE", "File is empty."));
  if (bytes.byteLength > limits.maxFileBytes) result.blockingErrors.push(issue("FILE_TOO_LARGE", `File exceeds the ${limits.maxFileBytes}-byte limit.`));
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
    result.blockingErrors.push(issue("UNSUPPORTED_ENCODING", "UTF-16 CSV files are not supported; upload UTF-8."));
  }
  if (bytes.includes(0)) result.blockingErrors.push(issue("NULL_BYTE", "File contains null bytes."));
  if (result.blockingErrors.length) return result;

  result.fileMetadata.hadUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    result.blockingErrors.push(issue("UNSUPPORTED_ENCODING", "File is not valid UTF-8."));
    return result;
  }
  result.fileMetadata.encoding = "UTF-8";
  if (result.fileMetadata.hadUtf8Bom) {
    text = text.replace(/^\uFEFF/, "");
    result.fileWarnings.push(issue("UTF8_BOM_REMOVED", "UTF-8 byte-order mark was removed before header detection."));
  }
  if (!text.trim()) {
    result.blockingErrors.push(issue("EMPTY_FILE", "File contains only whitespace."));
    return result;
  }

  const parsed = parseStrictCsv(text);
  if (parsed.error) {
    result.blockingErrors.push(parsed.error);
    return result;
  }
  if (parsed.rows.length < 2) {
    result.blockingErrors.push(issue("EMPTY_FILE", "CSV contains no data rows."));
    return result;
  }
  const [headerRow, ...csvRows] = parsed.rows;
  result.originalHeaders = headerRow.cells;
  result.normalizedHeaders = headerRow.cells.map(normalizeSpotifyHeader);
  result.rowCount = csvRows.length;

  if (csvRows.length > limits.maxRows) result.blockingErrors.push(issue("TOO_MANY_ROWS", `CSV exceeds the ${limits.maxRows}-row limit.`));
  if (parsed.rows.some(({cells}) => cells.length > limits.maxColumns)) result.blockingErrors.push(issue("TOO_MANY_COLUMNS", `CSV exceeds the ${limits.maxColumns}-column limit.`));
  const rawComparable = headerRow.cells.map((header) => header.trim().toLowerCase());
  const duplicateRaw = rawComparable.filter((header, index) => rawComparable.indexOf(header) !== index);
  if (duplicateRaw.length) result.blockingErrors.push(issue("DUPLICATE_HEADER", `Duplicate header: ${[...new Set(duplicateRaw)].join(", ")}.`));
  const collisions = result.normalizedHeaders.filter((header, index) => result.normalizedHeaders.indexOf(header) !== index);
  if (collisions.length && !duplicateRaw.length) result.blockingErrors.push(issue("HEADER_COLLISION", `Headers normalize to the same verified field: ${[...new Set(collisions)].join(", ")}.`));

  const detected = detectSpotifyExportSchema(result.normalizedHeaders);
  result.blockingErrors.push(...detected.blockingErrors);
  const schema = detected.schema;
  if (!schema || result.blockingErrors.length) {
    result.rows = rejectedRows(csvRows, result.originalHeaders, result.blockingErrors);
    result.rejectedCount = result.rows.length;
    return result;
  }

  result.detectedType = schema.type;
  result.dataLabel = schema.label;
  result.requiresPeriodConfirmation = schema.requiresPeriodConfirmation;
  const unexpected = result.normalizedHeaders.filter((header) => !schema.knownHeaders.includes(header));
  if (unexpected.length) result.fileWarnings.push(issue("UNEXPECTED_HEADER", `Ignored extra header${unexpected.length === 1 ? "" : "s"}: ${unexpected.join(", ")}.`));
  const period = validateSpotifyPreviewPeriod(input.previewPeriod);
  result.previewPeriod = period.normalized;
  if (period.issue) result.blockingErrors.push(period.issue);
  if (schema.requiresPeriodConfirmation && !input.previewPeriod) {
    result.fileWarnings.push(issue("PERIOD_CONFIRMATION_REQUIRED", "This export does not contain its report period; preview confirmation is required."));
  }

  const indexes = headerIndex(result.normalizedHeaders);
  result.rows = csvRows.map((csvRow) => {
    const errors: SpotifyValidationIssue[] = [];
    const warnings: SpotifyValidationIssue[] = [];
    if (csvRow.cells.length !== result.originalHeaders.length) {
      errors.push(issue("COLUMN_COUNT_MISMATCH", `Expected ${result.originalHeaders.length} columns but found ${csvRow.cells.length}.`, {rowNumber: csvRow.rowNumber}));
    }
    const original = originalValues(result.originalHeaders, csvRow.cells);
    const safe = displayValues(original, schema, warnings, csvRow.rowNumber);
    const normalized = normalizeRow(schema, csvRow.cells, indexes, csvRow.rowNumber, errors, warnings);
    return {originalRowNumber: csvRow.rowNumber, outcome: "ACCEPTED", originalValues: original, safeDisplayValues: safe, normalizedValues: normalized, errors, warnings};
  });
  applyDuplicateErrors(result.rows, schema);
  finalizeRows(result, schema);
  return result;
}
