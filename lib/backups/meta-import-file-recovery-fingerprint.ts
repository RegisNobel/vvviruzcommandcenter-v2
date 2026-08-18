import {createHash} from "node:crypto";

export const META_IMPORT_FILE_RECOVERY_FIELDS = [
  "id",
  "importBatchId",
  "sha256",
  "sanitizedFileName",
  "sourceView",
  "viewRole",
  "rowCount",
  "reportingStart",
  "reportingEnd",
  "observedDateCount",
  "expectedDateCount",
  "adCount",
  "missingCoreDateCount",
  "coverageState",
  "compatibilityState",
  "compatibilityWarnings",
  "rawStorageKey",
  "rawStorageSha256",
  "rawSizeBytes",
  "rawExpiresAt",
  "rawDeletedAt",
  "validationWarnings",
  "parserMetadata",
  "createdAt"
] as const;

export const META_IMPORT_FILE_RECOVERY_DATE_FIELDS = [
  "reportingStart",
  "reportingEnd",
  "rawExpiresAt",
  "rawDeletedAt",
  "createdAt"
] as const;

const DATE_FIELDS = new Set<string>(META_IMPORT_FILE_RECOVERY_DATE_FIELDS);
const REQUIRED_DATE_FIELDS = new Set(["createdAt"]);
const INTEGER_FIELDS = new Set([
  "rowCount",
  "observedDateCount",
  "expectedDateCount",
  "adCount",
  "missingCoreDateCount",
  "rawSizeBytes"
]);
const NULLABLE_INTEGER_FIELDS = new Set(["expectedDateCount", "rawSizeBytes"]);
const NULLABLE_STRING_FIELDS = new Set(["rawStorageKey", "rawStorageSha256"]);

export const META_IMPORT_FILE_RECOVERY_SELECT = META_IMPORT_FILE_RECOVERY_FIELDS
  .map((field) => `"${field}"`)
  .join(",");

function canonicalDate(field: string, value: unknown) {
  if (value === null) {
    if (REQUIRED_DATE_FIELDS.has(field)) throw new TypeError(`MetaImportFile recovery field ${field} must be a date.`);
    return null;
  }
  if (!(typeof value === "string" || value instanceof Date)) {
    throw new TypeError(`MetaImportFile recovery field ${field} must be a date or null.`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError(`MetaImportFile recovery field ${field} is not a valid date.`);
  }
  return date.toISOString();
}

function canonicalScalar(field: string, value: unknown) {
  if (DATE_FIELDS.has(field)) return canonicalDate(field, value);
  if (INTEGER_FIELDS.has(field)) {
    if (value === null && NULLABLE_INTEGER_FIELDS.has(field)) return null;
    if (!Number.isSafeInteger(value)) throw new TypeError(`MetaImportFile recovery field ${field} must be an integer.`);
    return value;
  }
  if (NULLABLE_STRING_FIELDS.has(field) && value === null) return null;
  if (typeof value !== "string") throw new TypeError(`MetaImportFile recovery field ${field} must be a string.`);
  return value;
}

export function canonicalMetaImportFileRecoveryRecord(record: Record<string, unknown>) {
  for (const field of META_IMPORT_FILE_RECOVERY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      throw new TypeError(`MetaImportFile recovery field ${field} is missing.`);
    }
  }
  return Object.fromEntries(
    META_IMPORT_FILE_RECOVERY_FIELDS.map((field) => [field, canonicalScalar(field, record[field])])
  );
}

export function canonicalMetaImportFileRecoveryCollection(records: Record<string, unknown>[]) {
  return records
    .map(canonicalMetaImportFileRecoveryRecord)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function fingerprintMetaImportFileRecovery(records: Record<string, unknown>[]) {
  const canonical = canonicalMetaImportFileRecoveryCollection(records);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const metaImportFileRecoveryFingerprint = {
  META_IMPORT_FILE_RECOVERY_DATE_FIELDS,
  META_IMPORT_FILE_RECOVERY_FIELDS,
  META_IMPORT_FILE_RECOVERY_SELECT,
  canonicalMetaImportFileRecoveryCollection,
  canonicalMetaImportFileRecoveryRecord,
  fingerprintMetaImportFileRecovery
};

export default metaImportFileRecoveryFingerprint;
