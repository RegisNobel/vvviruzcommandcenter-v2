-- CreateTable
CREATE TABLE "PromotionCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT NOT NULL DEFAULT '',
    "externalCampaignId" TEXT NOT NULL DEFAULT '',
    "externalCampaignName" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedByUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "PromotionCampaign_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromotionCampaign_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromotionCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PromotionCampaign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PromotionCampaign_platform_check" CHECK ("platform" IN ('META', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'EMAIL', 'OTHER')),
    CONSTRAINT "PromotionCampaign_objective_check" CHECK ("objective" IN ('AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'CONVERSIONS', 'STREAMS', 'PRESAVE', 'RETARGETING', 'OTHER')),
    CONSTRAINT "PromotionCampaign_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED')),
    CONSTRAINT "PromotionCampaign_name_check" CHECK (length(trim("name")) > 0)
);

-- CreateTable
CREATE TABLE "CampaignActiveInterval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "activeStartDate" DATETIME NOT NULL,
    "activeEndDate" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "sourceType" TEXT NOT NULL,
    "confirmationStatus" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "evidenceId" TEXT,
    "supersedesIntervalId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "correctionReason" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedByUsername" TEXT NOT NULL DEFAULT '',
    "confirmedById" TEXT,
    "confirmedByUsername" TEXT NOT NULL DEFAULT '',
    "confirmedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedByUsername" TEXT NOT NULL DEFAULT '',
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignActiveInterval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CampaignEvidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_supersedesIntervalId_fkey" FOREIGN KEY ("supersedesIntervalId") REFERENCES "CampaignActiveInterval" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignActiveInterval_sourceType_check" CHECK ("sourceType" IN ('MANUAL', 'META_REPORT_SUGGESTION', 'EXISTING_CAMPAIGN_RECORD', 'IMPORTED_EVIDENCE', 'SYSTEM_INFERRED')),
    CONSTRAINT "CampaignActiveInterval_confirmationStatus_check" CHECK ("confirmationStatus" IN ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'SUPERSEDED')),
    CONSTRAINT "CampaignActiveInterval_dates_check" CHECK ("activeEndDate" IS NULL OR "activeStartDate" <= "activeEndDate"),
    CONSTRAINT "CampaignActiveInterval_timezone_check" CHECK (length(trim("timezone")) > 0)
);

-- CreateTable
CREATE TABLE "CampaignTimelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "releaseId" TEXT NOT NULL,
    "intervalId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "eventTime" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "confirmationStatus" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "supersedesEventId" TEXT,
    "correctionReason" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedByUsername" TEXT NOT NULL DEFAULT '',
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignTimelineEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "CampaignActiveInterval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_supersedesEventId_fkey" FOREIGN KEY ("supersedesEventId") REFERENCES "CampaignTimelineEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignTimelineEvent_eventType_check" CHECK ("eventType" IN ('RELEASE_PUBLISHED', 'CAMPAIGN_STARTED', 'CAMPAIGN_PAUSED', 'CAMPAIGN_RESUMED', 'CAMPAIGN_ENDED', 'BUDGET_CHANGED', 'CREATIVE_CHANGED', 'AUDIENCE_CHANGED', 'ORGANIC_CONTENT_POSTED', 'PRESAVE_STARTED', 'MAJOR_PLAYLIST_PLACEMENT', 'OTHER_RELEASE_PUBLISHED', 'MANUAL_NOTE')),
    CONSTRAINT "CampaignTimelineEvent_source_check" CHECK ("source" IN ('SYSTEM_INTERVAL_SYNC', 'USER_ENTERED', 'IMPORTED_EVIDENCE', 'RELEASE_RECORD')),
    CONSTRAINT "CampaignTimelineEvent_confirmationStatus_check" CHECK ("confirmationStatus" IN ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'SUPERSEDED')),
    CONSTRAINT "CampaignTimelineEvent_timezone_check" CHECK (length(trim("timezone")) > 0)
);

-- CreateTable
CREATE TABLE "CampaignEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "adImportBatchId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "importedStartDate" DATETIME,
    "importedEndDate" DATETIME,
    "spendStartDate" DATETIME,
    "spendEndDate" DATETIME,
    "suggestedStartDate" DATETIME,
    "suggestedEndDate" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT '',
    "rationale" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignEvidence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignEvidence_adImportBatchId_fkey" FOREIGN KEY ("adImportBatchId") REFERENCES "AdImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignEvidence_sourceType_check" CHECK ("sourceType" IN ('META_IMPORT_BATCH', 'META_REPORT_ROW', 'MANUAL_REFERENCE', 'EXISTING_CAMPAIGN_RECORD')),
    CONSTRAINT "CampaignEvidence_confidence_check" CHECK ("confidence" IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT "CampaignEvidence_imported_dates_check" CHECK ("importedEndDate" IS NULL OR "importedStartDate" IS NULL OR "importedStartDate" <= "importedEndDate"),
    CONSTRAINT "CampaignEvidence_spend_dates_check" CHECK ("spendEndDate" IS NULL OR "spendStartDate" IS NULL OR "spendStartDate" <= "spendEndDate"),
    CONSTRAINT "CampaignEvidence_suggested_dates_check" CHECK ("suggestedEndDate" IS NULL OR "suggestedStartDate" IS NULL OR "suggestedStartDate" <= "suggestedEndDate")
);

-- CreateTable
CREATE TABLE "CampaignAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "intervalId" TEXT,
    "timelineEventId" TEXT,
    "evidenceId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "previousValues" TEXT NOT NULL DEFAULT '{}',
    "newValues" TEXT NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignAuditEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignAuditEvent_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "CampaignActiveInterval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignAuditEvent_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "CampaignTimelineEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignAuditEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CampaignEvidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PromotionCampaign_releaseId_status_updatedAt_idx" ON "PromotionCampaign"("releaseId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PromotionCampaign_artistProfileId_status_updatedAt_idx" ON "PromotionCampaign"("artistProfileId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PromotionCampaign_platform_status_idx" ON "PromotionCampaign"("platform", "status");

-- CreateIndex
CREATE INDEX "PromotionCampaign_externalCampaignId_idx" ON "PromotionCampaign"("externalCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignActiveInterval_supersedesIntervalId_key" ON "CampaignActiveInterval"("supersedesIntervalId");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_campaignId_confirmationStatus_activeStartDate_idx" ON "CampaignActiveInterval"("campaignId", "confirmationStatus", "activeStartDate");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_confirmationStatus_activeStartDate_activeEndDate_idx" ON "CampaignActiveInterval"("confirmationStatus", "activeStartDate", "activeEndDate");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_evidenceId_idx" ON "CampaignActiveInterval"("evidenceId");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_createdById_idx" ON "CampaignActiveInterval"("createdById");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_confirmedById_idx" ON "CampaignActiveInterval"("confirmedById");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTimelineEvent_supersedesEventId_key" ON "CampaignTimelineEvent"("supersedesEventId");

-- CreateIndex
CREATE INDEX "CampaignTimelineEvent_releaseId_eventDate_eventType_idx" ON "CampaignTimelineEvent"("releaseId", "eventDate", "eventType");

-- CreateIndex
CREATE INDEX "CampaignTimelineEvent_campaignId_eventDate_eventType_idx" ON "CampaignTimelineEvent"("campaignId", "eventDate", "eventType");

-- CreateIndex
CREATE INDEX "CampaignTimelineEvent_intervalId_idx" ON "CampaignTimelineEvent"("intervalId");

-- CreateIndex
CREATE INDEX "CampaignTimelineEvent_confirmationStatus_eventDate_idx" ON "CampaignTimelineEvent"("confirmationStatus", "eventDate");

-- CreateIndex
CREATE INDEX "CampaignEvidence_campaignId_sourceType_createdAt_idx" ON "CampaignEvidence"("campaignId", "sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignEvidence_adImportBatchId_idx" ON "CampaignEvidence"("adImportBatchId");

-- CreateIndex
CREATE INDEX "CampaignEvidence_campaignName_idx" ON "CampaignEvidence"("campaignName");


-- CreateIndex
CREATE INDEX "CampaignAuditEvent_campaignId_createdAt_idx" ON "CampaignAuditEvent"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignAuditEvent_intervalId_createdAt_idx" ON "CampaignAuditEvent"("intervalId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignAuditEvent_timelineEventId_createdAt_idx" ON "CampaignAuditEvent"("timelineEventId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignAuditEvent_evidenceId_createdAt_idx" ON "CampaignAuditEvent"("evidenceId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignAuditEvent_actorId_idx" ON "CampaignAuditEvent"("actorId");
