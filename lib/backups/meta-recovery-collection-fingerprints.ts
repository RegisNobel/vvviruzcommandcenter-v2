import {createHash} from "node:crypto";

type RecoveryContract = Readonly<{
  model: string;
  fields: readonly string[];
  dateFields: readonly string[];
  requiredDateFields: readonly string[];
  integerFields: readonly string[];
  nullableIntegerFields: readonly string[];
  numberFields: readonly string[];
  nullableNumberFields: readonly string[];
  nullableStringFields: readonly string[];
  sortFields: readonly string[];
}>;

const TIMEZONE_QUALIFIED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const META_IMPORT_FILE_ROW_RECOVERY_FIELDS = [
  "id", "importFileId", "sourceRowNumber", "sourceView", "sourceIdentityKey",
  "normalizedPayload", "parserVersion", "normalizationVersion", "createdAt"
] as const;
export const META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS = ["createdAt"] as const;

export const META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS = [
  "id", "importBatchId", "sourceFileIds", "sourceRowIds", "accountId", "accountName",
  "campaignId", "campaignName", "adSetId", "adSetName", "adId", "adName", "metricDate",
  "sourceReportingDate", "accountTimezone", "normalizedTimezone", "timezoneSource", "currency",
  "currencyOrigin", "metricFamily", "metricKey", "attributionSetting", "resultMetricKey", "spend",
  "impressions", "reach", "results", "resultIndicator", "deliveryStatus", "urlParameters", "sourceAsOf",
  "sourceAsOfOrigin", "acceptedAt", "parserVersion", "normalizationVersion", "identityKey", "createdAt"
] as const;
export const META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS = [
  "metricDate", "sourceAsOf", "acceptedAt", "createdAt"
] as const;

export const META_DAILY_RESOLUTION_RECOVERY_FIELDS = [
  "id", "identityKey", "accountId", "campaignId", "adSetId", "adId", "metricDate", "currency",
  "currencyOrigin", "metricFamily", "metricKey", "attributionSetting", "resultMetricKey",
  "currentObservationId", "resolvedAt", "resolutionVersion"
] as const;
export const META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS = ["metricDate", "resolvedAt"] as const;

export const META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS = [
  "id", "resolutionId", "previousObservationId", "currentObservationId", "reason",
  "precedenceEvidence", "createdAt"
] as const;
export const META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS = ["createdAt"] as const;

export const AD_CREATIVE_REPORT_RECOVERY_FIELDS = [
  "id", "importBatchId", "releaseId", "campaignName", "adSetName", "adName", "adDelivery",
  "reportingStart", "reportingEnd", "spend", "impressions", "reach", "frequency",
  "costPerThousandAccountsReached", "cpm", "results", "resultIndicator", "costPerResult",
  "linkClicks", "cpc", "ctr", "clicksAll", "ctrAll", "cpcAll", "landingPageViews",
  "costPerLandingPageView", "shopClicks", "pageEngagement", "postReactions", "postComments",
  "postSaves", "postShares", "facebookLikes", "instagramFollows", "videoPlays",
  "twoSecondContinuousPlays", "costPerTwoSecondContinuousPlay", "threeSecondPlays",
  "costPerThreeSecondPlay", "thruPlays", "costPerThruPlay", "video25", "video50", "video75",
  "video95", "video100", "qualityRanking", "engagementRateRanking", "conversionRateRanking",
  "utmSource", "utmCampaign", "utmContent", "createdAt", "updatedAt"
] as const;
export const AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS = [
  "reportingStart", "reportingEnd", "createdAt", "updatedAt"
] as const;

const CONTRACTS = {
  metaImportFileRow: {
    model: "MetaImportFileRow",
    fields: META_IMPORT_FILE_ROW_RECOVERY_FIELDS,
    dateFields: META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["createdAt"],
    integerFields: ["sourceRowNumber"],
    nullableIntegerFields: [], numberFields: [], nullableNumberFields: [], nullableStringFields: [],
    sortFields: ["importFileId", "sourceRowNumber", "id"]
  },
  metaDailySourceObservation: {
    model: "MetaDailySourceObservation",
    fields: META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS,
    dateFields: META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["metricDate", "acceptedAt", "createdAt"],
    integerFields: ["impressions", "reach"],
    nullableIntegerFields: ["impressions", "reach"],
    numberFields: ["spend", "results"],
    nullableNumberFields: ["spend", "results"],
    nullableStringFields: [], sortFields: ["identityKey", "id"]
  },
  metaDailyResolution: {
    model: "MetaDailyResolution",
    fields: META_DAILY_RESOLUTION_RECOVERY_FIELDS,
    dateFields: META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["metricDate", "resolvedAt"],
    integerFields: ["resolutionVersion"], nullableIntegerFields: [], numberFields: [], nullableNumberFields: [],
    nullableStringFields: [], sortFields: ["identityKey", "id"]
  },
  metaDailyResolutionEvent: {
    model: "MetaDailyResolutionEvent",
    fields: META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS,
    dateFields: META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["createdAt"], integerFields: [], nullableIntegerFields: [], numberFields: [],
    nullableNumberFields: [], nullableStringFields: ["previousObservationId"],
    sortFields: ["resolutionId", "createdAt", "id"]
  },
  adCreativeReport: {
    model: "AdCreativeReport",
    fields: AD_CREATIVE_REPORT_RECOVERY_FIELDS,
    dateFields: AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["createdAt", "updatedAt"],
    integerFields: [
      "impressions", "reach", "linkClicks", "clicksAll", "landingPageViews", "shopClicks",
      "pageEngagement", "postReactions", "postComments", "postSaves", "postShares", "facebookLikes",
      "instagramFollows", "videoPlays", "twoSecondContinuousPlays", "threeSecondPlays", "thruPlays",
      "video25", "video50", "video75", "video95", "video100"
    ],
    nullableIntegerFields: [
      "impressions", "reach", "linkClicks", "clicksAll", "landingPageViews", "shopClicks",
      "pageEngagement", "postReactions", "postComments", "postSaves", "postShares", "facebookLikes",
      "instagramFollows", "videoPlays", "twoSecondContinuousPlays", "threeSecondPlays", "thruPlays",
      "video25", "video50", "video75", "video95", "video100"
    ],
    numberFields: [
      "spend", "frequency", "costPerThousandAccountsReached", "cpm", "results", "costPerResult", "cpc",
      "ctr", "ctrAll", "cpcAll", "costPerLandingPageView", "costPerTwoSecondContinuousPlay",
      "costPerThreeSecondPlay", "costPerThruPlay"
    ],
    nullableNumberFields: [
      "spend", "frequency", "costPerThousandAccountsReached", "cpm", "results", "costPerResult", "cpc",
      "ctr", "ctrAll", "cpcAll", "costPerLandingPageView", "costPerTwoSecondContinuousPlay",
      "costPerThreeSecondPlay", "costPerThruPlay"
    ],
    nullableStringFields: [
      "releaseId", "campaignName", "adSetName", "adDelivery", "resultIndicator", "qualityRanking",
      "engagementRateRanking", "conversionRateRanking", "utmSource", "utmCampaign", "utmContent"
    ],
    sortFields: ["id"]
  }
} as const satisfies Record<string, RecoveryContract>;

export const META_IMPORT_FILE_ROW_RECOVERY_SELECT = META_IMPORT_FILE_ROW_RECOVERY_FIELDS.map((field) => `r."${field}"`).join(",");
export const META_DAILY_SOURCE_OBSERVATION_RECOVERY_SELECT = META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS.map((field) => `o."${field}"`).join(",");
export const META_DAILY_RESOLUTION_RECOVERY_SELECT = META_DAILY_RESOLUTION_RECOVERY_FIELDS.map((field) => `r."${field}"`).join(",");
export const META_DAILY_RESOLUTION_EVENT_RECOVERY_SELECT = META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS.map((field) => `e."${field}"`).join(",");
export const AD_CREATIVE_REPORT_RECOVERY_SELECT = AD_CREATIVE_REPORT_RECOVERY_FIELDS.map((field) => `r."${field}"`).join(",");

function canonicalDate(contract: RecoveryContract, field: string, value: unknown) {
  if (value === null) {
    if (contract.requiredDateFields.includes(field)) throw new TypeError(`${contract.model} recovery field ${field} must be a date.`);
    return null;
  }
  if (!(typeof value === "string" || value instanceof Date)) throw new TypeError(`${contract.model} recovery field ${field} must be a date or null.`);
  if (typeof value === "string" && !TIMEZONE_QUALIFIED_TIMESTAMP.test(value)) {
    throw new TypeError(`${contract.model} recovery field ${field} must include an explicit timezone.`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(`${contract.model} recovery field ${field} is not a valid date.`);
  return date.toISOString();
}

function canonicalScalar(contract: RecoveryContract, field: string, value: unknown) {
  if (contract.dateFields.includes(field)) return canonicalDate(contract, field, value);
  if (contract.integerFields.includes(field)) {
    if (value === null && contract.nullableIntegerFields.includes(field)) return null;
    if (!Number.isSafeInteger(value)) throw new TypeError(`${contract.model} recovery field ${field} must be an integer.`);
    return value;
  }
  if (contract.numberFields.includes(field)) {
    if (value === null && contract.nullableNumberFields.includes(field)) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${contract.model} recovery field ${field} must be a finite number.`);
    return value;
  }
  if (value === null && contract.nullableStringFields.includes(field)) return null;
  if (typeof value !== "string") throw new TypeError(`${contract.model} recovery field ${field} must be a string.`);
  return value;
}

function canonicalRecord(contract: RecoveryContract, record: Record<string, unknown>) {
  for (const field of contract.fields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) throw new TypeError(`${contract.model} recovery field ${field} is missing.`);
  }
  return Object.fromEntries(contract.fields.map((field) => [field, canonicalScalar(contract, field, record[field])]));
}

function compareScalar(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftText = String(left);
  const rightText = String(right);
  return leftText < rightText ? -1 : 1;
}

function canonicalCollection(contract: RecoveryContract, records: Record<string, unknown>[]) {
  return records.map((record) => canonicalRecord(contract, record)).sort((left, right) => {
    for (const field of contract.sortFields) {
      const comparison = compareScalar(left[field], right[field]);
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
}

function fingerprintCollection(contract: RecoveryContract, records: Record<string, unknown>[]) {
  return createHash("sha256").update(JSON.stringify(canonicalCollection(contract, records))).digest("hex");
}

export const canonicalMetaImportFileRowRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.metaImportFileRow, records);
export const fingerprintMetaImportFileRowRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.metaImportFileRow, records);
export const canonicalMetaDailySourceObservationRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.metaDailySourceObservation, records);
export const fingerprintMetaDailySourceObservationRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.metaDailySourceObservation, records);
export const canonicalMetaDailyResolutionRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.metaDailyResolution, records);
export const fingerprintMetaDailyResolutionRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.metaDailyResolution, records);
export const canonicalMetaDailyResolutionEventRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.metaDailyResolutionEvent, records);
export const fingerprintMetaDailyResolutionEventRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.metaDailyResolutionEvent, records);
export const canonicalAdCreativeReportRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.adCreativeReport, records);
export const fingerprintAdCreativeReportRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.adCreativeReport, records);

const metaRecoveryCollectionFingerprints = {
  AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS, AD_CREATIVE_REPORT_RECOVERY_FIELDS, AD_CREATIVE_REPORT_RECOVERY_SELECT,
  META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS, META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS, META_DAILY_RESOLUTION_EVENT_RECOVERY_SELECT,
  META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS, META_DAILY_RESOLUTION_RECOVERY_FIELDS, META_DAILY_RESOLUTION_RECOVERY_SELECT,
  META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS, META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS, META_DAILY_SOURCE_OBSERVATION_RECOVERY_SELECT,
  META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS, META_IMPORT_FILE_ROW_RECOVERY_FIELDS, META_IMPORT_FILE_ROW_RECOVERY_SELECT,
  canonicalAdCreativeReportRecoveryCollection, canonicalMetaDailyResolutionEventRecoveryCollection,
  canonicalMetaDailyResolutionRecoveryCollection, canonicalMetaDailySourceObservationRecoveryCollection,
  canonicalMetaImportFileRowRecoveryCollection, fingerprintAdCreativeReportRecovery,
  fingerprintMetaDailyResolutionEventRecovery, fingerprintMetaDailyResolutionRecovery,
  fingerprintMetaDailySourceObservationRecovery, fingerprintMetaImportFileRowRecovery
};

export default metaRecoveryCollectionFingerprints;
