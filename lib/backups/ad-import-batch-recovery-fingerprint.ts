import {createHash} from "node:crypto";

export const AD_IMPORT_BATCH_RECOVERY_FIELDS = [
  "id",
  "source",
  "name",
  "releaseId",
  "reportingStart",
  "reportingEnd",
  "exportedAt",
  "attributionSetting",
  "batchType",
  "fileNames",
  "notes",
  "bundleHash",
  "idempotencyKey",
  "sourceGranularity",
  "campaignIntervalEligible",
  "eligibilityReason",
  "coreTimingEligible",
  "coreTimingEligibilityReason",
  "enrichmentCompatibility",
  "enrichmentWarnings",
  "coreTimingStart",
  "coreTimingEnd",
  "commonCoverageStart",
  "commonCoverageEnd",
  "commonCoverageDateCount",
  "validationState",
  "accountId",
  "accountName",
  "accountTimezone",
  "normalizedTimezone",
  "timezoneSource",
  "currency",
  "currencyOrigin",
  "sourceAsOf",
  "sourceAsOfOrigin",
  "parserVersion",
  "normalizationVersion",
  "acceptedById",
  "acceptedByUsername",
  "acceptedAt",
  "importState",
  "warnings",
  "withdrawnAt",
  "withdrawnById",
  "withdrawnByUsername",
  "withdrawalReason",
  "replacesBatchId",
  "createdAt",
  "updatedAt"
] as const;

export const AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS = [
  "reportingStart",
  "reportingEnd",
  "exportedAt",
  "sourceAsOf",
  "acceptedAt",
  "withdrawnAt",
  "createdAt",
  "updatedAt",
  "coreTimingStart",
  "coreTimingEnd",
  "commonCoverageStart",
  "commonCoverageEnd"
] as const;

const DATE_FIELDS = new Set<string>(AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS);
const BOOLEAN_FIELDS = new Set(["campaignIntervalEligible", "coreTimingEligible"]);
const INTEGER_FIELDS = new Set(["commonCoverageDateCount"]);
const REQUIRED_DATE_FIELDS = new Set(["createdAt", "updatedAt"]);
const NULLABLE_STRING_FIELDS = new Set([
  "releaseId",
  "idempotencyKey",
  "acceptedById",
  "withdrawnById",
  "replacesBatchId"
]);

export const AD_IMPORT_BATCH_RECOVERY_SELECT = AD_IMPORT_BATCH_RECOVERY_FIELDS
  .map((field) => `"${field}"`)
  .join(",");

function canonicalDate(field: string, value: unknown) {
  if (value === null) {
    if (REQUIRED_DATE_FIELDS.has(field)) throw new TypeError(`AdImportBatch recovery field ${field} must be a date.`);
    return null;
  }
  if (!(typeof value === "string" || value instanceof Date)) {
    throw new TypeError(`AdImportBatch recovery field ${field} must be a date or null.`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError(`AdImportBatch recovery field ${field} is not a valid date.`);
  }
  return date.toISOString();
}

function canonicalScalar(field: string, value: unknown) {
  if (DATE_FIELDS.has(field)) return canonicalDate(field, value);
  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof value !== "boolean") throw new TypeError(`AdImportBatch recovery field ${field} must be boolean.`);
    return value;
  }
  if (INTEGER_FIELDS.has(field)) {
    if (!Number.isSafeInteger(value)) throw new TypeError(`AdImportBatch recovery field ${field} must be an integer.`);
    return value;
  }
  if (NULLABLE_STRING_FIELDS.has(field) && value === null) return null;
  if (typeof value !== "string") throw new TypeError(`AdImportBatch recovery field ${field} must be a string.`);
  return value;
}

export function canonicalAdImportBatchRecoveryRecord(record: Record<string, unknown>) {
  for (const field of AD_IMPORT_BATCH_RECOVERY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      throw new TypeError(`AdImportBatch recovery field ${field} is missing.`);
    }
  }
  return Object.fromEntries(
    AD_IMPORT_BATCH_RECOVERY_FIELDS.map((field) => [field, canonicalScalar(field, record[field])])
  );
}

export function fingerprintAdImportBatchRecovery(record: Record<string, unknown>) {
  const canonical = canonicalAdImportBatchRecoveryRecord(record);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const adImportBatchRecoveryFingerprint = {
  AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_SELECT,
  canonicalAdImportBatchRecoveryRecord,
  fingerprintAdImportBatchRecovery
};

export default adImportBatchRecoveryFingerprint;
