export const IMPORT_CENTER_MAX_FILE_BYTES = 10 * 1024 * 1024;

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
