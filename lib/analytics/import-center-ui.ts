export const IMPORT_CENTER_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type ImportPreviewCounts = {
  total: number;
  structurallyValid: number;
  accepted: number;
  warnings: number;
  rejected: number;
  unmatched: number;
};

export function resolveFinalReviewCounts(
  detectedType: string | null,
  counts: ImportPreviewCounts,
  options: {releaseConfirmed?: boolean; unmatchedSongRows?: number} = {}
) {
  if (detectedType === "TRACK_STREAM_TIMELINE" && options.releaseConfirmed) {
    return {total: counts.total, structurallyValid: counts.structurallyValid, accepted: counts.structurallyValid, rejected: counts.rejected, unmatched: 0};
  }
  const unmatched = detectedType === "SONGS_PERIOD" ? options.unmatchedSongRows ?? counts.unmatched : counts.unmatched;
  return {total: counts.total, structurallyValid: counts.structurallyValid, accepted: counts.accepted, rejected: counts.rejected, unmatched};
}

export function formatValidationValue(value: unknown, fallback = "Not available"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValidationValue(item, "")).filter(Boolean).join("; ") : "None";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : null;
    const message = typeof record.message === "string" ? record.message : null;
    if (code || message) return [code, message].filter(Boolean).join(": ");
    return Object.entries(record).map(([key, item]) => `${key}: ${formatValidationValue(item, "")}`).join(" · ");
  }
  return String(value);
}

export function validateSpotifyCsvFile(file: {name: string; size: number; type?: string}) {
  if (file.size > IMPORT_CENTER_MAX_FILE_BYTES) {
    return {ok: false as const, code: "FILE_TOO_LARGE", message: "Choose a CSV file that is 10 MiB or smaller."};
  }
  const extensionIsCsv = file.name.trim().toLowerCase().endsWith(".csv");
  const mimeIsCsv = !file.type || ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type.toLowerCase());
  if (!extensionIsCsv || !mimeIsCsv) {
    return {ok: false as const, code: "UNSUPPORTED_FILE", message: "Choose one supported Spotify CSV export."};
  }
  return {ok: true as const, code: "FILE_READY", message: "CSV is ready to preview."};
}

export function importErrorCopy(code: string, fallback: string) {
  const messages: Record<string, string> = {
    EXPIRED_PREVIEW: "This preview expired. Upload the CSV again to create a fresh preview.",
    DUPLICATE_FILE: "These exact file bytes already belong to an import. Open the existing import instead of committing a duplicate.",
    CONFLICT: "The import changed while you were working. Refresh before trying again.",
    MAPPING_CONFLICT: "This mapping changed in another session. Refresh the row before continuing.",
    RAW_FILE_UNAVAILABLE: "The retained raw file expired, was deleted, or is unavailable. Reprocessing cannot be retried.",
    UNAUTHORIZED: "Your administrator session ended. Sign in again to continue."
  };
  return messages[code] || fallback;
}
