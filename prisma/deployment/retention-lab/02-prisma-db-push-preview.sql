-- REGENERATED GATE C REHEARSAL PREVIEW: 2026-08-04T21:15:58.904Z
-- Baseline commit: 75408ca4be61b1011e01b8b5c5d19690939a5b3c
-- SHA-256 (SQL body): 037ca162539965adf4a3a83f11ef00b5eba7f0af0ebf055db18e15e7b95b6015
-- Classification: 13 additive tables; only artistLinkId FK and empty column removal are destructive.
-- DropForeignKey
ALTER TABLE "AppearsOnArtistCredit" DROP CONSTRAINT "AppearsOnArtistCredit_artistLinkId_fkey";

-- AlterTable
ALTER TABLE "AppearsOnArtistCredit" DROP COLUMN "artistLinkId";

-- CreateTable
CREATE TABLE "AnalyticsImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SPOTIFY_FOR_ARTISTS',
    "importType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "commitIdempotencyKey" TEXT,
    "artistProfileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByUsername" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportingTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "detectedPeriodStart" TIMESTAMP(3),
    "detectedPeriodEnd" TIMESTAMP(3),
    "userConfirmedPeriodStart" TIMESTAMP(3),
    "userConfirmedPeriodEnd" TIMESTAMP(3),
    "periodDatesUserConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedRowCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRowCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "validationSummary" TEXT NOT NULL DEFAULT '{}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
    "rawFileStorageDriver" TEXT,
    "rawFileStorageKey" TEXT,
    "rawFileSizeBytes" INTEGER,
    "rawFileExpiresAt" TIMESTAMP(3),
    "rawFileDeletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,
    "withdrawalReason" TEXT NOT NULL DEFAULT '',
    "replacedByImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "exportType" TEXT NOT NULL,
    "rowIdentityKey" TEXT NOT NULL,
    "originalValues" TEXT NOT NULL DEFAULT '{}',
    "safeDisplayValues" TEXT NOT NULL DEFAULT '{}',
    "normalizedValues" TEXT NOT NULL DEFAULT '{}',
    "structuralOutcome" TEXT NOT NULL,
    "mappingStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "mappingReason" TEXT NOT NULL DEFAULT '',
    "suggestedReleaseId" TEXT,
    "confirmedReleaseId" TEXT,
    "confirmedScopeKey" TEXT,
    "mappingConfidence" TEXT NOT NULL DEFAULT 'NO_MATCH',
    "mappingEvidence" TEXT NOT NULL DEFAULT '{}',
    "appliedAliasId" TEXT,
    "confirmedById" TEXT,
    "confirmedByUsername" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3),
    "unmatchedReason" TEXT,
    "unmatchedNote" TEXT NOT NULL DEFAULT '',
    "unmatchedById" TEXT,
    "unmatchedByUsername" TEXT NOT NULL DEFAULT '',
    "unmatchedAt" TIMESTAMP(3),
    "mappingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseImportAlias" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "exportedReleaseDate" TIMESTAMP(3),
    "artistProfileId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "matchMethod" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "scopeKey" TEXT NOT NULL,
    "activeScopeKey" TEXT,
    "confirmedById" TEXT,
    "confirmedByUsername" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedByUsername" TEXT NOT NULL DEFAULT '',
    "revocationReason" TEXT NOT NULL DEFAULT '',
    "supersededByAliasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseImportAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingAuditEvent" (
    "id" TEXT NOT NULL,
    "rowId" TEXT,
    "importId" TEXT,
    "aliasId" TEXT,
    "action" TEXT NOT NULL,
    "previousMappingStatus" TEXT,
    "newMappingStatus" TEXT,
    "previousReleaseId" TEXT,
    "newReleaseId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappingAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCampaign" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignActiveInterval" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "activeStartDate" TIMESTAMP(3) NOT NULL,
    "activeEndDate" TIMESTAMP(3),
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
    "confirmedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByUsername" TEXT NOT NULL DEFAULT '',
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignActiveInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTimelineEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "releaseId" TEXT NOT NULL,
    "intervalId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
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
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvidence" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adImportBatchId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "importedStartDate" TIMESTAMP(3),
    "importedEndDate" TIMESTAMP(3),
    "spendStartDate" TIMESTAMP(3),
    "spendEndDate" TIMESTAMP(3),
    "suggestedStartDate" TIMESTAMP(3),
    "suggestedEndDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT '',
    "rationale" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAuditEvent" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistMetricObservation" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "monthlyListeners" INTEGER NOT NULL,
    "monthlyActiveListeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "playlistAdds" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistMetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackMetricObservation" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "spotifyTrackId" TEXT,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "streams" INTEGER NOT NULL,
    "listeners" INTEGER,
    "saves" INTEGER,
    "playlistAdds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackMetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "exportedReleaseDate" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "mappingRowId" TEXT,

    CONSTRAINT "SongPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "playlistTitle" TEXT NOT NULL,
    "playlistAuthor" TEXT NOT NULL,
    "playlistSpotifyId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "dateAdded" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImport_fileHash_key" ON "AnalyticsImport"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImport_commitIdempotencyKey_key" ON "AnalyticsImport"("commitIdempotencyKey");

-- CreateIndex
CREATE INDEX "AnalyticsImport_source_importType_idx" ON "AnalyticsImport"("source", "importType");

-- CreateIndex
CREATE INDEX "AnalyticsImport_artistProfileId_importType_acceptedAt_idx" ON "AnalyticsImport"("artistProfileId", "importType", "acceptedAt");

-- CreateIndex
CREATE INDEX "AnalyticsImport_status_acceptedAt_idx" ON "AnalyticsImport"("status", "acceptedAt");

-- CreateIndex
CREATE INDEX "AnalyticsImport_uploadedById_idx" ON "AnalyticsImport"("uploadedById");

-- CreateIndex
CREATE INDEX "AnalyticsImport_withdrawnById_idx" ON "AnalyticsImport"("withdrawnById");

-- CreateIndex
CREATE INDEX "AnalyticsImport_replacedByImportId_idx" ON "AnalyticsImport"("replacedByImportId");

-- CreateIndex
CREATE INDEX "AnalyticsImport_rawFileExpiresAt_idx" ON "AnalyticsImport"("rawFileExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImportRow_confirmedScopeKey_key" ON "AnalyticsImportRow"("confirmedScopeKey");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_importId_mappingStatus_idx" ON "AnalyticsImportRow"("importId", "mappingStatus");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_exportType_mappingStatus_idx" ON "AnalyticsImportRow"("exportType", "mappingStatus");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_mappingConfidence_idx" ON "AnalyticsImportRow"("mappingConfidence");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_suggestedReleaseId_idx" ON "AnalyticsImportRow"("suggestedReleaseId");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_confirmedReleaseId_idx" ON "AnalyticsImportRow"("confirmedReleaseId");

-- CreateIndex
CREATE INDEX "AnalyticsImportRow_appliedAliasId_idx" ON "AnalyticsImportRow"("appliedAliasId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImportRow_importId_sourceRowNumber_key" ON "AnalyticsImportRow"("importId", "sourceRowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseImportAlias_activeScopeKey_key" ON "ReleaseImportAlias"("activeScopeKey");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_artistProfileId_source_exportType_normal_idx" ON "ReleaseImportAlias"("artistProfileId", "source", "exportType", "normalizedTitle");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_releaseId_status_idx" ON "ReleaseImportAlias"("releaseId", "status");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_scopeKey_status_idx" ON "ReleaseImportAlias"("scopeKey", "status");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_confirmedById_idx" ON "ReleaseImportAlias"("confirmedById");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_revokedById_idx" ON "ReleaseImportAlias"("revokedById");

-- CreateIndex
CREATE INDEX "ReleaseImportAlias_supersededByAliasId_idx" ON "ReleaseImportAlias"("supersededByAliasId");

-- CreateIndex
CREATE INDEX "MappingAuditEvent_rowId_createdAt_idx" ON "MappingAuditEvent"("rowId", "createdAt");

-- CreateIndex
CREATE INDEX "MappingAuditEvent_importId_createdAt_idx" ON "MappingAuditEvent"("importId", "createdAt");

-- CreateIndex
CREATE INDEX "MappingAuditEvent_aliasId_createdAt_idx" ON "MappingAuditEvent"("aliasId", "createdAt");

-- CreateIndex
CREATE INDEX "MappingAuditEvent_actorId_idx" ON "MappingAuditEvent"("actorId");

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
CREATE INDEX "CampaignActiveInterval_campaignId_confirmationStatus_active_idx" ON "CampaignActiveInterval"("campaignId", "confirmationStatus", "activeStartDate");

-- CreateIndex
CREATE INDEX "CampaignActiveInterval_confirmationStatus_activeStartDate_a_idx" ON "CampaignActiveInterval"("confirmationStatus", "activeStartDate", "activeEndDate");

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
CREATE UNIQUE INDEX "CampaignEvidence_campaignId_sourceType_sourceRecordId_key" ON "CampaignEvidence"("campaignId", "sourceType", "sourceRecordId");

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

-- CreateIndex
CREATE INDEX "ArtistMetricObservation_artistProfileId_metricDate_idx" ON "ArtistMetricObservation"("artistProfileId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistMetricObservation_importId_artistProfileId_metricDate_key" ON "ArtistMetricObservation"("importId", "artistProfileId", "metricDate");

-- CreateIndex
CREATE INDEX "TrackMetricObservation_releaseId_metricDate_idx" ON "TrackMetricObservation"("releaseId", "metricDate");

-- CreateIndex
CREATE INDEX "TrackMetricObservation_spotifyTrackId_metricDate_idx" ON "TrackMetricObservation"("spotifyTrackId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrackMetricObservation_importId_releaseId_metricDate_key" ON "TrackMetricObservation"("importId", "releaseId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "SongPeriodSnapshot_mappingRowId_key" ON "SongPeriodSnapshot"("mappingRowId");

-- CreateIndex
CREATE INDEX "SongPeriodSnapshot_releaseId_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("releaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SongPeriodSnapshot_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SongPeriodSnapshot_importId_releaseId_periodStart_periodEnd_key" ON "SongPeriodSnapshot"("importId", "releaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_playlistTitle_playlistAuthor_periodS_idx" ON "PlaylistPeriodSnapshot"("playlistTitle", "playlistAuthor", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_playlistSpotifyId_periodStart_period_idx" ON "PlaylistPeriodSnapshot"("playlistSpotifyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistPeriodSnapshot_importId_playlistTitle_playlistAutho_key" ON "PlaylistPeriodSnapshot"("importId", "playlistTitle", "playlistAuthor", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_replacedByImportId_fkey" FOREIGN KEY ("replacedByImportId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_suggestedReleaseId_fkey" FOREIGN KEY ("suggestedReleaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_confirmedReleaseId_fkey" FOREIGN KEY ("confirmedReleaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_appliedAliasId_fkey" FOREIGN KEY ("appliedAliasId") REFERENCES "ReleaseImportAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsImportRow" ADD CONSTRAINT "AnalyticsImportRow_unmatchedById_fkey" FOREIGN KEY ("unmatchedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseImportAlias" ADD CONSTRAINT "ReleaseImportAlias_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseImportAlias" ADD CONSTRAINT "ReleaseImportAlias_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseImportAlias" ADD CONSTRAINT "ReleaseImportAlias_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseImportAlias" ADD CONSTRAINT "ReleaseImportAlias_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseImportAlias" ADD CONSTRAINT "ReleaseImportAlias_supersededByAliasId_fkey" FOREIGN KEY ("supersededByAliasId") REFERENCES "ReleaseImportAlias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingAuditEvent" ADD CONSTRAINT "MappingAuditEvent_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "AnalyticsImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingAuditEvent" ADD CONSTRAINT "MappingAuditEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingAuditEvent" ADD CONSTRAINT "MappingAuditEvent_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "ReleaseImportAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingAuditEvent" ADD CONSTRAINT "MappingAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CampaignEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_supersedesIntervalId_fkey" FOREIGN KEY ("supersedesIntervalId") REFERENCES "CampaignActiveInterval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "CampaignActiveInterval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_supersedesEventId_fkey" FOREIGN KEY ("supersedesEventId") REFERENCES "CampaignTimelineEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_adImportBatchId_fkey" FOREIGN KEY ("adImportBatchId") REFERENCES "AdImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAuditEvent" ADD CONSTRAINT "CampaignAuditEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAuditEvent" ADD CONSTRAINT "CampaignAuditEvent_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "CampaignActiveInterval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAuditEvent" ADD CONSTRAINT "CampaignAuditEvent_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "CampaignTimelineEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAuditEvent" ADD CONSTRAINT "CampaignAuditEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CampaignEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAuditEvent" ADD CONSTRAINT "CampaignAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistMetricObservation" ADD CONSTRAINT "ArtistMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistMetricObservation" ADD CONSTRAINT "ArtistMetricObservation_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackMetricObservation" ADD CONSTRAINT "TrackMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackMetricObservation" ADD CONSTRAINT "TrackMetricObservation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_mappingRowId_fkey" FOREIGN KEY ("mappingRowId") REFERENCES "AnalyticsImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistPeriodSnapshot" ADD CONSTRAINT "PlaylistPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
