-- Reviewed PostgreSQL companion for Stage 4 catalog and release mapping.
-- Apply through the established reviewed prisma db push workflow; this file is
-- retained for deployment review and does not create a second migration history.

CREATE TABLE "ReleaseImportAlias" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "exportedTitle" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "exportedReleaseDate" TIMESTAMP(3),
  "artistProfileId" TEXT NOT NULL REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "releaseId" TEXT NOT NULL REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "matchMethod" TEXT NOT NULL,
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "scopeKey" TEXT NOT NULL,
  "activeScopeKey" TEXT UNIQUE,
  "confirmedById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "confirmedByUsername" TEXT NOT NULL DEFAULT '',
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "revokedByUsername" TEXT NOT NULL DEFAULT '',
  "revocationReason" TEXT NOT NULL DEFAULT '',
  "supersededByAliasId" TEXT REFERENCES "ReleaseImportAlias"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AnalyticsImportRow" (
  "id" TEXT PRIMARY KEY,
  "importId" TEXT NOT NULL REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sourceRowNumber" INTEGER NOT NULL,
  "exportType" TEXT NOT NULL,
  "rowIdentityKey" TEXT NOT NULL,
  "originalValues" TEXT NOT NULL DEFAULT '{}',
  "safeDisplayValues" TEXT NOT NULL DEFAULT '{}',
  "normalizedValues" TEXT NOT NULL DEFAULT '{}',
  "structuralOutcome" TEXT NOT NULL,
  "mappingStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  "mappingReason" TEXT NOT NULL DEFAULT '',
  "suggestedReleaseId" TEXT REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "confirmedReleaseId" TEXT REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "confirmedScopeKey" TEXT UNIQUE,
  "mappingConfidence" TEXT NOT NULL DEFAULT 'NO_MATCH',
  "mappingEvidence" TEXT NOT NULL DEFAULT '{}',
  "appliedAliasId" TEXT REFERENCES "ReleaseImportAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "confirmedById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "confirmedByUsername" TEXT NOT NULL DEFAULT '',
  "confirmedAt" TIMESTAMP(3),
  "unmatchedReason" TEXT,
  "unmatchedNote" TEXT NOT NULL DEFAULT '',
  "unmatchedById" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "unmatchedByUsername" TEXT NOT NULL DEFAULT '',
  "unmatchedAt" TIMESTAMP(3),
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsImportRow_importId_sourceRowNumber_key" UNIQUE ("importId", "sourceRowNumber")
);

CREATE TABLE "MappingAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "rowId" TEXT REFERENCES "AnalyticsImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "importId" TEXT REFERENCES "AnalyticsImport"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "aliasId" TEXT REFERENCES "ReleaseImportAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "previousMappingStatus" TEXT,
  "newMappingStatus" TEXT,
  "previousReleaseId" TEXT,
  "newReleaseId" TEXT,
  "reason" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "actorId" TEXT REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "actorUsername" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "SongPeriodSnapshot" ADD COLUMN "mappingRowId" TEXT;
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_mappingRowId_fkey" FOREIGN KEY ("mappingRowId") REFERENCES "AnalyticsImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SongPeriodSnapshot_mappingRowId_key" ON "SongPeriodSnapshot"("mappingRowId");

CREATE INDEX "AnalyticsImportRow_importId_mappingStatus_idx" ON "AnalyticsImportRow"("importId", "mappingStatus");
CREATE INDEX "AnalyticsImportRow_exportType_mappingStatus_idx" ON "AnalyticsImportRow"("exportType", "mappingStatus");
CREATE INDEX "AnalyticsImportRow_mappingConfidence_idx" ON "AnalyticsImportRow"("mappingConfidence");
CREATE INDEX "AnalyticsImportRow_suggestedReleaseId_idx" ON "AnalyticsImportRow"("suggestedReleaseId");
CREATE INDEX "AnalyticsImportRow_confirmedReleaseId_idx" ON "AnalyticsImportRow"("confirmedReleaseId");
CREATE INDEX "AnalyticsImportRow_appliedAliasId_idx" ON "AnalyticsImportRow"("appliedAliasId");
CREATE INDEX "ReleaseImportAlias_artistProfileId_source_exportType_normalizedTitle_idx" ON "ReleaseImportAlias"("artistProfileId", "source", "exportType", "normalizedTitle");
CREATE INDEX "ReleaseImportAlias_releaseId_status_idx" ON "ReleaseImportAlias"("releaseId", "status");
CREATE INDEX "ReleaseImportAlias_scopeKey_status_idx" ON "ReleaseImportAlias"("scopeKey", "status");
CREATE INDEX "ReleaseImportAlias_confirmedById_idx" ON "ReleaseImportAlias"("confirmedById");
CREATE INDEX "ReleaseImportAlias_revokedById_idx" ON "ReleaseImportAlias"("revokedById");
CREATE INDEX "ReleaseImportAlias_supersededByAliasId_idx" ON "ReleaseImportAlias"("supersededByAliasId");
CREATE INDEX "MappingAuditEvent_rowId_createdAt_idx" ON "MappingAuditEvent"("rowId", "createdAt");
CREATE INDEX "MappingAuditEvent_importId_createdAt_idx" ON "MappingAuditEvent"("importId", "createdAt");
CREATE INDEX "MappingAuditEvent_aliasId_createdAt_idx" ON "MappingAuditEvent"("aliasId", "createdAt");
CREATE INDEX "MappingAuditEvent_actorId_idx" ON "MappingAuditEvent"("actorId");
