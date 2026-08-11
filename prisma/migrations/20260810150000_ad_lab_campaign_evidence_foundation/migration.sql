ALTER TABLE "AdImportBatch" ADD COLUMN "bundleHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "AdImportBatch" ADD COLUMN "sourceGranularity" TEXT NOT NULL DEFAULT 'AGGREGATE_SNAPSHOT';
ALTER TABLE "AdImportBatch" ADD COLUMN "campaignIntervalEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdImportBatch" ADD COLUMN "eligibilityReason" TEXT NOT NULL DEFAULT 'LEGACY_AGGREGATE_SNAPSHOT';
ALTER TABLE "AdImportBatch" ADD COLUMN "validationState" TEXT NOT NULL DEFAULT 'ACCEPTED_WITH_LIMITATIONS';
ALTER TABLE "AdImportBatch" ADD COLUMN "accountId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "accountName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "accountTimezone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "normalizedTimezone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "timezoneSource" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "AdImportBatch" ADD COLUMN "currency" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "sourceAsOf" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "sourceAsOfOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "AdImportBatch" ADD COLUMN "parserVersion" TEXT NOT NULL DEFAULT 'legacy-v1';
ALTER TABLE "AdImportBatch" ADD COLUMN "normalizationVersion" TEXT NOT NULL DEFAULT 'legacy-v1';
ALTER TABLE "AdImportBatch" ADD COLUMN "acceptedById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdImportBatch" ADD COLUMN "acceptedByUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "importState" TEXT NOT NULL DEFAULT 'ACCEPTED';
ALTER TABLE "AdImportBatch" ADD COLUMN "warnings" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AdImportBatch" ADD COLUMN "withdrawnAt" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "withdrawnById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdImportBatch" ADD COLUMN "withdrawnByUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "withdrawalReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdImportBatch" ADD COLUMN "replacesBatchId" TEXT REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AdImportBatch_idempotencyKey_key" ON "AdImportBatch"("idempotencyKey");
CREATE UNIQUE INDEX "AdImportBatch_replacesBatchId_key" ON "AdImportBatch"("replacesBatchId");
CREATE INDEX "AdImportBatch_accountId_sourceGranularity_acceptedAt_idx" ON "AdImportBatch"("accountId","sourceGranularity","acceptedAt");
CREATE INDEX "AdImportBatch_campaignIntervalEligible_importState_acceptedAt_idx" ON "AdImportBatch"("campaignIntervalEligible","importState","acceptedAt");
CREATE INDEX "AdImportBatch_bundleHash_idx" ON "AdImportBatch"("bundleHash");
CREATE INDEX "AdImportBatch_replacesBatchId_idx" ON "AdImportBatch"("replacesBatchId");

CREATE TABLE "MetaImportFile" (
  "id" TEXT NOT NULL PRIMARY KEY, "importBatchId" TEXT NOT NULL, "sha256" TEXT NOT NULL,
  "sanitizedFileName" TEXT NOT NULL, "sourceView" TEXT NOT NULL, "rowCount" INTEGER NOT NULL,
  "rawStorageKey" TEXT, "rawStorageSha256" TEXT, "rawSizeBytes" INTEGER, "rawExpiresAt" DATETIME,
  "rawDeletedAt" DATETIME, "validationWarnings" TEXT NOT NULL DEFAULT '[]', "parserMetadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaImportFile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MetaImportFile_sha256_check" CHECK (length("sha256") = 64),
  CONSTRAINT "MetaImportFile_size_check" CHECK ("rowCount" >= 0 AND ("rawSizeBytes" IS NULL OR "rawSizeBytes" >= 0))
);
CREATE UNIQUE INDEX "MetaImportFile_importBatchId_sha256_key" ON "MetaImportFile"("importBatchId","sha256");
CREATE INDEX "MetaImportFile_sha256_idx" ON "MetaImportFile"("sha256");
CREATE INDEX "MetaImportFile_importBatchId_sourceView_idx" ON "MetaImportFile"("importBatchId","sourceView");
CREATE INDEX "MetaImportFile_rawExpiresAt_rawDeletedAt_idx" ON "MetaImportFile"("rawExpiresAt","rawDeletedAt");

CREATE TABLE "MetaImportFileRow" (
  "id" TEXT NOT NULL PRIMARY KEY, "importFileId" TEXT NOT NULL, "sourceRowNumber" INTEGER NOT NULL,
  "sourceView" TEXT NOT NULL, "sourceIdentityKey" TEXT NOT NULL, "normalizedPayload" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL, "normalizationVersion" TEXT NOT NULL, "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaImportFileRow_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "MetaImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MetaImportFileRow_importFileId_sourceRowNumber_key" ON "MetaImportFileRow"("importFileId","sourceRowNumber");
CREATE INDEX "MetaImportFileRow_sourceIdentityKey_idx" ON "MetaImportFileRow"("sourceIdentityKey");

CREATE TABLE "MetaDailySourceObservation" (
  "id" TEXT NOT NULL PRIMARY KEY, "importBatchId" TEXT NOT NULL, "sourceFileIds" TEXT NOT NULL DEFAULT '[]', "sourceRowIds" TEXT NOT NULL DEFAULT '[]',
  "accountId" TEXT NOT NULL, "accountName" TEXT NOT NULL DEFAULT '', "campaignId" TEXT NOT NULL, "campaignName" TEXT NOT NULL DEFAULT '',
  "adSetId" TEXT NOT NULL, "adSetName" TEXT NOT NULL DEFAULT '', "adId" TEXT NOT NULL, "adName" TEXT NOT NULL DEFAULT '',
  "metricDate" DATETIME NOT NULL, "sourceReportingDate" TEXT NOT NULL, "accountTimezone" TEXT NOT NULL, "normalizedTimezone" TEXT NOT NULL,
  "timezoneSource" TEXT NOT NULL, "currency" TEXT NOT NULL, "metricFamily" TEXT NOT NULL DEFAULT 'SPEND', "metricKey" TEXT NOT NULL DEFAULT 'SPEND', "attributionSetting" TEXT NOT NULL, "resultMetricKey" TEXT NOT NULL DEFAULT 'NONE',
  "spend" REAL, "impressions" INTEGER, "reach" INTEGER, "results" REAL, "resultIndicator" TEXT NOT NULL DEFAULT '', "deliveryStatus" TEXT NOT NULL DEFAULT '',
  "urlParameters" TEXT NOT NULL DEFAULT '', "sourceAsOf" DATETIME, "sourceAsOfOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN', "acceptedAt" DATETIME NOT NULL, "parserVersion" TEXT NOT NULL,
  "normalizationVersion" TEXT NOT NULL, "identityKey" TEXT NOT NULL, "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaDailySourceObservation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaDailySourceObservation_identity_check" CHECK (length("accountId") > 0 AND length("campaignId") > 0 AND length("adSetId") > 0 AND length("adId") > 0),
  CONSTRAINT "MetaDailySourceObservation_metric_check" CHECK (("spend" IS NULL OR "spend" >= 0) AND ("impressions" IS NULL OR "impressions" >= 0) AND ("reach" IS NULL OR "reach" >= 0))
);
CREATE UNIQUE INDEX "MetaDailySourceObservation_importBatchId_identityKey_key" ON "MetaDailySourceObservation"("importBatchId","identityKey");
CREATE INDEX "MetaDailySourceObservation_accountId_campaignId_metricDate_idx" ON "MetaDailySourceObservation"("accountId","campaignId","metricDate");
CREATE INDEX "MetaDailySourceObservation_campaignId_metricDate_idx" ON "MetaDailySourceObservation"("campaignId","metricDate");
CREATE INDEX "MetaDailySourceObservation_adId_metricDate_idx" ON "MetaDailySourceObservation"("adId","metricDate");
CREATE INDEX "MetaDailySourceObservation_identityKey_sourceAsOf_acceptedAt_idx" ON "MetaDailySourceObservation"("identityKey","sourceAsOf","acceptedAt");

CREATE TABLE "MetaDailyResolution" (
  "id" TEXT NOT NULL PRIMARY KEY, "identityKey" TEXT NOT NULL, "accountId" TEXT NOT NULL, "campaignId" TEXT NOT NULL,
  "adSetId" TEXT NOT NULL, "adId" TEXT NOT NULL, "metricDate" DATETIME NOT NULL, "currency" TEXT NOT NULL DEFAULT '', "metricFamily" TEXT NOT NULL DEFAULT 'SPEND', "metricKey" TEXT NOT NULL DEFAULT 'SPEND', "attributionSetting" TEXT NOT NULL,
  "resultMetricKey" TEXT NOT NULL DEFAULT 'NONE', "currentObservationId" TEXT NOT NULL, "resolvedAt" DATETIME NOT NULL,
  "resolutionVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MetaDailyResolution_currentObservationId_fkey" FOREIGN KEY ("currentObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MetaDailyResolution_identityKey_key" ON "MetaDailyResolution"("identityKey");
CREATE INDEX "MetaDailyResolution_accountId_campaignId_metricDate_idx" ON "MetaDailyResolution"("accountId","campaignId","metricDate");
CREATE INDEX "MetaDailyResolution_campaignId_metricDate_idx" ON "MetaDailyResolution"("campaignId","metricDate");
CREATE INDEX "MetaDailyResolution_currentObservationId_idx" ON "MetaDailyResolution"("currentObservationId");

ALTER TABLE "CampaignEvidence" ADD COLUMN "suggestionKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CampaignEvidence" ADD COLUMN "generationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CampaignEvidence" ADD COLUMN "sourceResolutionFingerprint" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CampaignEvidence" ADD COLUMN "suggestionState" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "CampaignEvidence" ADD COLUMN "supersededByEvidenceId" TEXT;
CREATE UNIQUE INDEX "CampaignEvidence_supersededByEvidenceId_key" ON "CampaignEvidence"("supersededByEvidenceId");
CREATE INDEX "CampaignEvidence_campaignId_suggestionKey_suggestionState_idx" ON "CampaignEvidence"("campaignId","suggestionKey","suggestionState");
CREATE INDEX "CampaignEvidence_sourceResolutionFingerprint_idx" ON "CampaignEvidence"("sourceResolutionFingerprint");

CREATE TABLE "MetaDailyResolutionEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "resolutionId" TEXT NOT NULL, "previousObservationId" TEXT, "currentObservationId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "precedenceEvidence" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaDailyResolutionEvent_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "MetaDailyResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MetaDailyResolutionEvent_previousObservationId_fkey" FOREIGN KEY ("previousObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaDailyResolutionEvent_currentObservationId_fkey" FOREIGN KEY ("currentObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MetaDailyResolutionEvent_resolutionId_createdAt_idx" ON "MetaDailyResolutionEvent"("resolutionId","createdAt");
CREATE INDEX "MetaDailyResolutionEvent_currentObservationId_idx" ON "MetaDailyResolutionEvent"("currentObservationId");

CREATE TABLE "MetaImportAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "importBatchId" TEXT NOT NULL, "action" TEXT NOT NULL, "reason" TEXT NOT NULL DEFAULT '',
  "previousValues" TEXT NOT NULL DEFAULT '{}', "newValues" TEXT NOT NULL DEFAULT '{}', "actorId" TEXT, "actorUsername" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaImportAuditEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaImportAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MetaImportAuditEvent_importBatchId_createdAt_idx" ON "MetaImportAuditEvent"("importBatchId","createdAt");
CREATE INDEX "MetaImportAuditEvent_actorId_idx" ON "MetaImportAuditEvent"("actorId");

CREATE TABLE "MetaPromotionLink" (
  "id" TEXT NOT NULL PRIMARY KEY, "promotionCampaignId" TEXT NOT NULL, "accountId" TEXT NOT NULL, "scopeType" TEXT NOT NULL DEFAULT 'CAMPAIGN', "externalCampaignId" TEXT NOT NULL,
  "externalAdSetId" TEXT NOT NULL DEFAULT '', "externalAdId" TEXT NOT NULL DEFAULT '', "scopeIdentityKey" TEXT NOT NULL,
  "currentDisplayName" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'SUGGESTED', "associationMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE', "monetaryAttribution" TEXT NOT NULL DEFAULT 'UNALLOCATED', "ambiguous" BOOLEAN NOT NULL DEFAULT false, "evidence" TEXT NOT NULL DEFAULT '{}', "reason" TEXT NOT NULL DEFAULT '',
  "actorId" TEXT, "actorUsername" TEXT NOT NULL DEFAULT '', "supersedesLinkId" TEXT, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MetaPromotionLink_promotionCampaignId_fkey" FOREIGN KEY ("promotionCampaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_supersedesLinkId_fkey" FOREIGN KEY ("supersedesLinkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_status_check" CHECK ("status" IN ('SUGGESTED','CONFIRMED','REJECTED','REVOKED')),
  CONSTRAINT "MetaPromotionLink_scopeType_check" CHECK ("scopeType" IN ('CAMPAIGN','AD_SET','AD'))
);
CREATE UNIQUE INDEX "MetaPromotionLink_supersedesLinkId_key" ON "MetaPromotionLink"("supersedesLinkId");
CREATE INDEX "MetaPromotionLink_scopeIdentityKey_status_idx" ON "MetaPromotionLink"("scopeIdentityKey","status");
CREATE INDEX "MetaPromotionLink_accountId_externalCampaignId_scopeType_status_idx" ON "MetaPromotionLink"("accountId","externalCampaignId","scopeType","status");
CREATE INDEX "MetaPromotionLink_accountId_externalCampaignId_externalAdSetId_externalAdId_idx" ON "MetaPromotionLink"("accountId","externalCampaignId","externalAdSetId","externalAdId");
CREATE INDEX "MetaPromotionLink_promotionCampaignId_status_idx" ON "MetaPromotionLink"("promotionCampaignId","status");
CREATE INDEX "MetaPromotionLink_status_createdAt_idx" ON "MetaPromotionLink"("status","createdAt");

CREATE TABLE "MetaPromotionLinkAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "linkId" TEXT NOT NULL, "action" TEXT NOT NULL, "reason" TEXT NOT NULL DEFAULT '',
  "previousValues" TEXT NOT NULL DEFAULT '{}', "newValues" TEXT NOT NULL DEFAULT '{}', "actorId" TEXT, "actorUsername" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaPromotionLinkAuditEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLinkAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MetaPromotionLinkAuditEvent_linkId_createdAt_idx" ON "MetaPromotionLinkAuditEvent"("linkId","createdAt");
CREATE INDEX "MetaPromotionLinkAuditEvent_actorId_idx" ON "MetaPromotionLinkAuditEvent"("actorId");
