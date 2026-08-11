-- AlterTable
ALTER TABLE "AdImportBatch" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedById" TEXT,
ADD COLUMN     "acceptedByUsername" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "accountId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "accountName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "accountTimezone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bundleHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "campaignIntervalEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commonCoverageDateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commonCoverageEnd" TIMESTAMP(3),
ADD COLUMN     "commonCoverageStart" TIMESTAMP(3),
ADD COLUMN     "coreTimingEligibilityReason" TEXT NOT NULL DEFAULT 'LEGACY_AGGREGATE_SNAPSHOT',
ADD COLUMN     "coreTimingEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coreTimingEnd" TIMESTAMP(3),
ADD COLUMN     "coreTimingStart" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currencyOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "eligibilityReason" TEXT NOT NULL DEFAULT 'LEGACY_AGGREGATE_SNAPSHOT',
ADD COLUMN     "enrichmentCompatibility" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
ADD COLUMN     "enrichmentWarnings" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "importState" TEXT NOT NULL DEFAULT 'ACCEPTED',
ADD COLUMN     "normalizationVersion" TEXT NOT NULL DEFAULT 'legacy-v1',
ADD COLUMN     "normalizedTimezone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "parserVersion" TEXT NOT NULL DEFAULT 'legacy-v1',
ADD COLUMN     "replacesBatchId" TEXT,
ADD COLUMN     "sourceAsOf" TIMESTAMP(3),
ADD COLUMN     "sourceAsOfOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "sourceGranularity" TEXT NOT NULL DEFAULT 'AGGREGATE_SNAPSHOT',
ADD COLUMN     "timezoneSource" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "validationState" TEXT NOT NULL DEFAULT 'ACCEPTED_WITH_LIMITATIONS',
ADD COLUMN     "warnings" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "withdrawalReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnById" TEXT,
ADD COLUMN     "withdrawnByUsername" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CampaignEvidence" ADD COLUMN     "generationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sourceResolutionFingerprint" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "suggestionKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "suggestionState" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "supersededByEvidenceId" TEXT;

-- CreateTable
CREATE TABLE "MetaImportFile" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sanitizedFileName" TEXT NOT NULL,
    "sourceView" TEXT NOT NULL,
    "viewRole" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "rowCount" INTEGER NOT NULL,
    "reportingStart" TIMESTAMP(3),
    "reportingEnd" TIMESTAMP(3),
    "observedDateCount" INTEGER NOT NULL DEFAULT 0,
    "expectedDateCount" INTEGER,
    "adCount" INTEGER NOT NULL DEFAULT 0,
    "missingCoreDateCount" INTEGER NOT NULL DEFAULT 0,
    "coverageState" TEXT NOT NULL DEFAULT 'NO_DAILY_COVERAGE',
    "compatibilityState" TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
    "compatibilityWarnings" TEXT NOT NULL DEFAULT '[]',
    "rawStorageKey" TEXT,
    "rawStorageSha256" TEXT,
    "rawSizeBytes" INTEGER,
    "rawExpiresAt" TIMESTAMP(3),
    "rawDeletedAt" TIMESTAMP(3),
    "validationWarnings" TEXT NOT NULL DEFAULT '[]',
    "parserMetadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaImportFileRow" (
    "id" TEXT NOT NULL,
    "importFileId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sourceView" TEXT NOT NULL,
    "sourceIdentityKey" TEXT NOT NULL,
    "normalizedPayload" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaImportFileRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDailySourceObservation" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sourceFileIds" TEXT NOT NULL DEFAULT '[]',
    "sourceRowIds" TEXT NOT NULL DEFAULT '[]',
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL DEFAULT '',
    "adSetId" TEXT NOT NULL,
    "adSetName" TEXT NOT NULL DEFAULT '',
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL DEFAULT '',
    "metricDate" TIMESTAMP(3) NOT NULL,
    "sourceReportingDate" TEXT NOT NULL,
    "accountTimezone" TEXT NOT NULL,
    "normalizedTimezone" TEXT NOT NULL,
    "timezoneSource" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "currencyOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "metricFamily" TEXT NOT NULL DEFAULT 'SPEND',
    "metricKey" TEXT NOT NULL DEFAULT 'SPEND',
    "attributionSetting" TEXT NOT NULL,
    "resultMetricKey" TEXT NOT NULL DEFAULT 'NONE',
    "spend" DOUBLE PRECISION,
    "impressions" INTEGER,
    "reach" INTEGER,
    "results" DOUBLE PRECISION,
    "resultIndicator" TEXT NOT NULL DEFAULT '',
    "deliveryStatus" TEXT NOT NULL DEFAULT '',
    "urlParameters" TEXT NOT NULL DEFAULT '',
    "sourceAsOf" TIMESTAMP(3),
    "sourceAsOfOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaDailySourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDailyResolution" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "currencyOrigin" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "metricFamily" TEXT NOT NULL DEFAULT 'SPEND',
    "metricKey" TEXT NOT NULL DEFAULT 'SPEND',
    "attributionSetting" TEXT NOT NULL,
    "resultMetricKey" TEXT NOT NULL DEFAULT 'NONE',
    "currentObservationId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "resolutionVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MetaDailyResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDailyResolutionEvent" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "previousObservationId" TEXT,
    "currentObservationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "precedenceEvidence" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaDailyResolutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaImportAuditEvent" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "previousValues" TEXT NOT NULL DEFAULT '{}',
    "newValues" TEXT NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaImportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAccountTimezoneResolution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ianaTimezone" TEXT NOT NULL,
    "sourceOrigin" TEXT NOT NULL,
    "resolutionState" TEXT NOT NULL DEFAULT 'CURRENT',
    "supersedesResolutionId" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "confirmedById" TEXT,
    "confirmedByUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAccountTimezoneResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPromotionLink" (
    "id" TEXT NOT NULL,
    "promotionCampaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'CAMPAIGN',
    "externalCampaignId" TEXT NOT NULL,
    "externalAdSetId" TEXT NOT NULL DEFAULT '',
    "externalAdId" TEXT NOT NULL DEFAULT '',
    "scopeIdentityKey" TEXT NOT NULL,
    "currentDisplayName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "associationMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "monetaryAttribution" TEXT NOT NULL DEFAULT 'UNALLOCATED',
    "ambiguous" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL DEFAULT '',
    "supersedesLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPromotionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPromotionLinkAuditEvent" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "previousValues" TEXT NOT NULL DEFAULT '{}',
    "newValues" TEXT NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPromotionLinkAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaImportFile_sha256_idx" ON "MetaImportFile"("sha256");

-- CreateIndex
CREATE INDEX "MetaImportFile_importBatchId_sourceView_idx" ON "MetaImportFile"("importBatchId", "sourceView");

-- CreateIndex
CREATE INDEX "MetaImportFile_rawExpiresAt_rawDeletedAt_idx" ON "MetaImportFile"("rawExpiresAt", "rawDeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaImportFile_importBatchId_sha256_key" ON "MetaImportFile"("importBatchId", "sha256");

-- CreateIndex
CREATE INDEX "MetaImportFileRow_sourceIdentityKey_idx" ON "MetaImportFileRow"("sourceIdentityKey");

-- CreateIndex
CREATE UNIQUE INDEX "MetaImportFileRow_importFileId_sourceRowNumber_key" ON "MetaImportFileRow"("importFileId", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "MetaDailySourceObservation_accountId_campaignId_metricDate_idx" ON "MetaDailySourceObservation"("accountId", "campaignId", "metricDate");

-- CreateIndex
CREATE INDEX "MetaDailySourceObservation_campaignId_metricDate_idx" ON "MetaDailySourceObservation"("campaignId", "metricDate");

-- CreateIndex
CREATE INDEX "MetaDailySourceObservation_adId_metricDate_idx" ON "MetaDailySourceObservation"("adId", "metricDate");

-- CreateIndex
CREATE INDEX "MetaDailySourceObservation_identityKey_sourceAsOf_acceptedA_idx" ON "MetaDailySourceObservation"("identityKey", "sourceAsOf", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaDailySourceObservation_importBatchId_identityKey_key" ON "MetaDailySourceObservation"("importBatchId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "MetaDailyResolution_identityKey_key" ON "MetaDailyResolution"("identityKey");

-- CreateIndex
CREATE INDEX "MetaDailyResolution_accountId_campaignId_metricDate_idx" ON "MetaDailyResolution"("accountId", "campaignId", "metricDate");

-- CreateIndex
CREATE INDEX "MetaDailyResolution_campaignId_metricDate_idx" ON "MetaDailyResolution"("campaignId", "metricDate");

-- CreateIndex
CREATE INDEX "MetaDailyResolution_currentObservationId_idx" ON "MetaDailyResolution"("currentObservationId");

-- CreateIndex
CREATE INDEX "MetaDailyResolutionEvent_resolutionId_createdAt_idx" ON "MetaDailyResolutionEvent"("resolutionId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaDailyResolutionEvent_currentObservationId_idx" ON "MetaDailyResolutionEvent"("currentObservationId");

-- CreateIndex
CREATE INDEX "MetaImportAuditEvent_importBatchId_createdAt_idx" ON "MetaImportAuditEvent"("importBatchId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaImportAuditEvent_actorId_idx" ON "MetaImportAuditEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAccountTimezoneResolution_supersedesResolutionId_key" ON "MetaAccountTimezoneResolution"("supersedesResolutionId");

-- CreateIndex
CREATE INDEX "MetaAccountTimezoneResolution_accountId_resolutionState_idx" ON "MetaAccountTimezoneResolution"("accountId", "resolutionState");

-- CreateIndex
CREATE INDEX "MetaAccountTimezoneResolution_confirmedById_idx" ON "MetaAccountTimezoneResolution"("confirmedById");

-- CreateIndex
CREATE UNIQUE INDEX "MetaPromotionLink_supersedesLinkId_key" ON "MetaPromotionLink"("supersedesLinkId");

-- CreateIndex
CREATE INDEX "MetaPromotionLink_scopeIdentityKey_status_idx" ON "MetaPromotionLink"("scopeIdentityKey", "status");

-- CreateIndex
CREATE INDEX "MetaPromotionLink_accountId_externalCampaignId_scopeType_st_idx" ON "MetaPromotionLink"("accountId", "externalCampaignId", "scopeType", "status");

-- CreateIndex
CREATE INDEX "MetaPromotionLink_accountId_externalCampaignId_externalAdSe_idx" ON "MetaPromotionLink"("accountId", "externalCampaignId", "externalAdSetId", "externalAdId");

-- CreateIndex
CREATE INDEX "MetaPromotionLink_promotionCampaignId_status_idx" ON "MetaPromotionLink"("promotionCampaignId", "status");

-- CreateIndex
CREATE INDEX "MetaPromotionLink_status_createdAt_idx" ON "MetaPromotionLink"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MetaPromotionLinkAuditEvent_linkId_createdAt_idx" ON "MetaPromotionLinkAuditEvent"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaPromotionLinkAuditEvent_actorId_idx" ON "MetaPromotionLinkAuditEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "AdImportBatch_idempotencyKey_key" ON "AdImportBatch"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdImportBatch_replacesBatchId_key" ON "AdImportBatch"("replacesBatchId");

-- CreateIndex
CREATE INDEX "AdImportBatch_accountId_sourceGranularity_acceptedAt_idx" ON "AdImportBatch"("accountId", "sourceGranularity", "acceptedAt");

-- CreateIndex
CREATE INDEX "AdImportBatch_campaignIntervalEligible_importState_accepted_idx" ON "AdImportBatch"("campaignIntervalEligible", "importState", "acceptedAt");

-- CreateIndex
CREATE INDEX "AdImportBatch_coreTimingEligible_importState_acceptedAt_idx" ON "AdImportBatch"("coreTimingEligible", "importState", "acceptedAt");

-- CreateIndex
CREATE INDEX "AdImportBatch_bundleHash_idx" ON "AdImportBatch"("bundleHash");

-- CreateIndex
CREATE INDEX "AdImportBatch_replacesBatchId_idx" ON "AdImportBatch"("replacesBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEvidence_supersededByEvidenceId_key" ON "CampaignEvidence"("supersededByEvidenceId");

-- CreateIndex
CREATE INDEX "CampaignEvidence_campaignId_suggestionKey_suggestionState_idx" ON "CampaignEvidence"("campaignId", "suggestionKey", "suggestionState");

-- CreateIndex
CREATE INDEX "CampaignEvidence_sourceResolutionFingerprint_idx" ON "CampaignEvidence"("sourceResolutionFingerprint");

-- AddForeignKey
ALTER TABLE "AdImportBatch" ADD CONSTRAINT "AdImportBatch_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImportBatch" ADD CONSTRAINT "AdImportBatch_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImportBatch" ADD CONSTRAINT "AdImportBatch_replacesBatchId_fkey" FOREIGN KEY ("replacesBatchId") REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaImportFile" ADD CONSTRAINT "MetaImportFile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaImportFileRow" ADD CONSTRAINT "MetaImportFileRow_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "MetaImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDailySourceObservation" ADD CONSTRAINT "MetaDailySourceObservation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDailyResolution" ADD CONSTRAINT "MetaDailyResolution_currentObservationId_fkey" FOREIGN KEY ("currentObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDailyResolutionEvent" ADD CONSTRAINT "MetaDailyResolutionEvent_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "MetaDailyResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDailyResolutionEvent" ADD CONSTRAINT "MetaDailyResolutionEvent_previousObservationId_fkey" FOREIGN KEY ("previousObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDailyResolutionEvent" ADD CONSTRAINT "MetaDailyResolutionEvent_currentObservationId_fkey" FOREIGN KEY ("currentObservationId") REFERENCES "MetaDailySourceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaImportAuditEvent" ADD CONSTRAINT "MetaImportAuditEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaImportAuditEvent" ADD CONSTRAINT "MetaImportAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAccountTimezoneResolution" ADD CONSTRAINT "MetaAccountTimezoneResolution_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAccountTimezoneResolution" ADD CONSTRAINT "MetaAccountTimezoneResolution_supersedesResolutionId_fkey" FOREIGN KEY ("supersedesResolutionId") REFERENCES "MetaAccountTimezoneResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_supersededByEvidenceId_fkey" FOREIGN KEY ("supersededByEvidenceId") REFERENCES "CampaignEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPromotionLink" ADD CONSTRAINT "MetaPromotionLink_promotionCampaignId_fkey" FOREIGN KEY ("promotionCampaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPromotionLink" ADD CONSTRAINT "MetaPromotionLink_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPromotionLink" ADD CONSTRAINT "MetaPromotionLink_supersedesLinkId_fkey" FOREIGN KEY ("supersedesLinkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPromotionLinkAuditEvent" ADD CONSTRAINT "MetaPromotionLinkAuditEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPromotionLinkAuditEvent" ADD CONSTRAINT "MetaPromotionLinkAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
