import {createHash} from "node:crypto";

type ScalarContract = Readonly<{
  model: string;
  fields: readonly string[];
  dateFields: readonly string[];
  requiredDateFields: readonly string[];
  integerFields: readonly string[];
  nullableIntegerFields: readonly string[];
  booleanFields: readonly string[];
  nullableStringFields: readonly string[];
}>;

const TIMEZONE_QUALIFIED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS = [
  "id", "source", "importType", "originalFilename", "fileHash", "commitIdempotencyKey",
  "artistProfileId", "uploadedById", "uploadedByUsername", "uploadedAt", "status",
  "reportingTimezone", "detectedPeriodStart", "detectedPeriodEnd", "userConfirmedPeriodStart",
  "userConfirmedPeriodEnd", "periodDatesUserConfirmed", "rowCount", "acceptedRowCount",
  "rejectedRowCount", "unmatchedRowCount", "warningCount", "validationSummary", "metadata",
  "normalizationVersion", "rawFileStorageDriver", "rawFileStorageKey", "rawFileSizeBytes",
  "rawFileExpiresAt", "rawFileDeletedAt", "acceptedAt", "withdrawnAt", "withdrawnById",
  "withdrawalReason", "replacedByImportId", "createdAt", "updatedAt"
] as const;
export const GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS = [
  "uploadedAt", "detectedPeriodStart", "detectedPeriodEnd", "userConfirmedPeriodStart",
  "userConfirmedPeriodEnd", "rawFileExpiresAt", "rawFileDeletedAt", "acceptedAt", "withdrawnAt",
  "createdAt", "updatedAt"
] as const;

export const GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS = [
  "id", "rowId", "importId", "aliasId", "action", "previousMappingStatus", "newMappingStatus",
  "previousReleaseId", "newReleaseId", "reason", "evidence", "actorId", "actorUsername", "createdAt"
] as const;
export const GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS = ["createdAt"] as const;

export const GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS = [
  "id", "importId", "sourceRowNumber", "exportType", "rowIdentityKey", "originalValues",
  "safeDisplayValues", "normalizedValues", "structuralOutcome", "mappingStatus", "mappingReason",
  "suggestedReleaseId", "confirmedReleaseId", "confirmedScopeKey", "mappingConfidence",
  "mappingEvidence", "appliedAliasId", "confirmedById", "confirmedByUsername", "confirmedAt",
  "unmatchedReason", "unmatchedNote", "unmatchedById", "unmatchedByUsername", "unmatchedAt",
  "mappingVersion", "createdAt", "updatedAt"
] as const;
export const GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS = [
  "confirmedAt", "unmatchedAt", "createdAt", "updatedAt"
] as const;

export const GAME_OVER_ANALYTICS_IMPORT_RECOVERY_SELECT = GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS
  .map((field) => `i."${field}"`).join(",");
export const GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_SELECT = GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS
  .map((field) => `e."${field}"`).join(",");
export const GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_SELECT = GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS
  .map((field) => `r."${field}"`).join(",");

const CONTRACTS = {
  analyticsImport: {
    model: "AnalyticsImport",
    fields: GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS,
    dateFields: GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["uploadedAt", "createdAt", "updatedAt"],
    integerFields: ["rowCount", "acceptedRowCount", "rejectedRowCount", "unmatchedRowCount", "warningCount", "normalizationVersion", "rawFileSizeBytes"],
    nullableIntegerFields: ["rawFileSizeBytes"],
    booleanFields: ["periodDatesUserConfirmed"],
    nullableStringFields: ["commitIdempotencyKey", "uploadedById", "rawFileStorageDriver", "rawFileStorageKey", "withdrawnById", "replacedByImportId"]
  },
  auditEvent: {
    model: "MappingAuditEvent",
    fields: GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS,
    dateFields: GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["createdAt"], integerFields: [], nullableIntegerFields: [], booleanFields: [],
    nullableStringFields: ["rowId", "importId", "aliasId", "previousMappingStatus", "newMappingStatus", "previousReleaseId", "newReleaseId", "actorId"]
  },
  mappingRow: {
    model: "AnalyticsImportRow",
    fields: GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS,
    dateFields: GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["createdAt", "updatedAt"],
    integerFields: ["sourceRowNumber", "mappingVersion"], nullableIntegerFields: [], booleanFields: [],
    nullableStringFields: ["suggestedReleaseId", "confirmedReleaseId", "confirmedScopeKey", "appliedAliasId", "confirmedById", "unmatchedReason", "unmatchedById"]
  }
} as const satisfies Record<string, ScalarContract>;

function canonicalDate(contract: ScalarContract, field: string, value: unknown) {
  if (value === null) {
    if (contract.requiredDateFields.includes(field)) throw new TypeError(`${contract.model} recovery field ${field} must be a date.`);
    return null;
  }
  if (!(typeof value === "string" || value instanceof Date)) throw new TypeError(`${contract.model} recovery field ${field} must be a date or null.`);
  if (typeof value === "string" && !TIMEZONE_QUALIFIED_TIMESTAMP.test(value)) throw new TypeError(`${contract.model} recovery field ${field} must include an explicit timezone.`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(`${contract.model} recovery field ${field} is not a valid date.`);
  return date.toISOString();
}

function canonicalScalarRecord(contract: ScalarContract, record: Record<string, unknown>) {
  for (const field of contract.fields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) throw new TypeError(`${contract.model} recovery field ${field} is missing.`);
  }
  return Object.fromEntries(contract.fields.map((field) => {
    const value = record[field];
    if (contract.dateFields.includes(field)) return [field, canonicalDate(contract, field, value)];
    if (contract.integerFields.includes(field)) {
      if (value === null && contract.nullableIntegerFields.includes(field)) return [field, null];
      if (!Number.isSafeInteger(value)) throw new TypeError(`${contract.model} recovery field ${field} must be an integer.`);
      return [field, value];
    }
    if (contract.booleanFields.includes(field)) {
      if (typeof value !== "boolean") throw new TypeError(`${contract.model} recovery field ${field} must be a boolean.`);
      return [field, value];
    }
    if (value === null && contract.nullableStringFields.includes(field)) return [field, null];
    if (typeof value !== "string") throw new TypeError(`${contract.model} recovery field ${field} must be a string.`);
    return [field, value];
  }));
}

function canonicalCollection(contract: ScalarContract, records: Record<string, unknown>[]) {
  return records.map((record) => canonicalScalarRecord(contract, record)).sort((left, right) => {
    const leftId = left.id as string;
    const rightId = right.id as string;
    return leftId === rightId ? 0 : leftId < rightId ? -1 : 1;
  });
}

function canonicalJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Recovery JSON contains a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalJson(child)]));
  }
  throw new TypeError("Recovery JSON contains an unsupported value.");
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function canonicalGameOverAnalyticsImportRecoveryRecord(record: Record<string, unknown>) {
  return canonicalScalarRecord(CONTRACTS.analyticsImport, record);
}

export function fingerprintGameOverAnalyticsImportRecovery(record: Record<string, unknown>) {
  return sha256(canonicalGameOverAnalyticsImportRecoveryRecord(record));
}

export function canonicalGameOverProvenanceRecovery({
  analyticsImport, auditEvents, mappingRows, releaseIds
}: {
  analyticsImport: Record<string, unknown>;
  auditEvents: Record<string, unknown>[];
  mappingRows: Record<string, unknown>[];
  releaseIds: string[];
}) {
  const canonicalImport = canonicalGameOverAnalyticsImportRecoveryRecord(analyticsImport);
  let metadata: unknown;
  try {
    metadata = JSON.parse(canonicalImport.metadata as string);
  } catch {
    throw new TypeError("AnalyticsImport recovery metadata must be valid JSON.");
  }
  const metadataRecord = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  const previewResultChecksum = metadataRecord.previewResultChecksum ?? null;
  if (previewResultChecksum !== null && typeof previewResultChecksum !== "string") {
    throw new TypeError("AnalyticsImport previewResultChecksum must be a string or null.");
  }
  if (!releaseIds.every((id) => typeof id === "string" && id.length > 0)) {
    throw new TypeError("Game Over release IDs must be non-empty strings.");
  }
  return {
    importId: canonicalImport.id,
    importType: canonicalImport.importType,
    fileHash: canonicalImport.fileHash,
    actorId: canonicalImport.uploadedById,
    actorUsername: canonicalImport.uploadedByUsername,
    releaseIds: [...new Set(releaseIds)].sort(),
    auditEvents: canonicalCollection(CONTRACTS.auditEvent, auditEvents),
    mappingRows: canonicalCollection(CONTRACTS.mappingRow, mappingRows),
    commitIdempotencyKey: canonicalImport.commitIdempotencyKey,
    confirmations: canonicalJson(metadataRecord.confirmations ?? null),
    previewResultChecksum
  };
}

export function fingerprintGameOverProvenanceRecovery(input: Parameters<typeof canonicalGameOverProvenanceRecovery>[0]) {
  return sha256(canonicalGameOverProvenanceRecovery(input));
}

const gameOverRecoveryFingerprints = {
  GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS,
  GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS,
  GAME_OVER_ANALYTICS_IMPORT_RECOVERY_SELECT,
  GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS,
  GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS,
  GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_SELECT,
  GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS,
  GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS,
  GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_SELECT,
  canonicalGameOverAnalyticsImportRecoveryRecord,
  canonicalGameOverProvenanceRecovery,
  fingerprintGameOverAnalyticsImportRecovery,
  fingerprintGameOverProvenanceRecovery
};

export default gameOverRecoveryFingerprints;
