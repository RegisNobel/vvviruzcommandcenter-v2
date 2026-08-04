-- CreateTable
CREATE TABLE "AnalyticsImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "confirmedAt" DATETIME,
    "unmatchedReason" TEXT,
    "unmatchedNote" TEXT NOT NULL DEFAULT '',
    "unmatchedById" TEXT,
    "unmatchedByUsername" TEXT NOT NULL DEFAULT '',
    "unmatchedAt" DATETIME,
    "mappingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalyticsImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImportRow_suggestedReleaseId_fkey" FOREIGN KEY ("suggestedReleaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImportRow_confirmedReleaseId_fkey" FOREIGN KEY ("confirmedReleaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImportRow_appliedAliasId_fkey" FOREIGN KEY ("appliedAliasId") REFERENCES "ReleaseImportAlias" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImportRow_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImportRow_unmatchedById_fkey" FOREIGN KEY ("unmatchedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReleaseImportAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "exportedReleaseDate" DATETIME,
    "artistProfileId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "matchMethod" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "scopeKey" TEXT NOT NULL,
    "activeScopeKey" TEXT,
    "confirmedById" TEXT,
    "confirmedByUsername" TEXT NOT NULL DEFAULT '',
    "confirmedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokedById" TEXT,
    "revokedByUsername" TEXT NOT NULL DEFAULT '',
    "revocationReason" TEXT NOT NULL DEFAULT '',
    "supersededByAliasId" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReleaseImportAlias_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReleaseImportAlias_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReleaseImportAlias_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReleaseImportAlias_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReleaseImportAlias_supersededByAliasId_fkey" FOREIGN KEY ("supersededByAliasId") REFERENCES "ReleaseImportAlias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MappingAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "MappingAuditEvent_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "AnalyticsImportRow" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MappingAuditEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MappingAuditEvent_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "ReleaseImportAlias" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MappingAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SongPeriodSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "exportedReleaseDate" DATETIME NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "mappingRowId" TEXT,
    CONSTRAINT "SongPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SongPeriodSnapshot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SongPeriodSnapshot_mappingRowId_fkey" FOREIGN KEY ("mappingRowId") REFERENCES "AnalyticsImportRow" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SongPeriodSnapshot" ("createdAt", "exportedReleaseDate", "exportedTitle", "id", "importId", "listeners", "periodEnd", "periodStart", "releaseId", "saves", "streams") SELECT "createdAt", "exportedReleaseDate", "exportedTitle", "id", "importId", "listeners", "periodEnd", "periodStart", "releaseId", "saves", "streams" FROM "SongPeriodSnapshot";
DROP TABLE "SongPeriodSnapshot";
ALTER TABLE "new_SongPeriodSnapshot" RENAME TO "SongPeriodSnapshot";
CREATE UNIQUE INDEX "SongPeriodSnapshot_mappingRowId_key" ON "SongPeriodSnapshot"("mappingRowId");
CREATE INDEX "SongPeriodSnapshot_releaseId_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("releaseId", "periodStart", "periodEnd");
CREATE INDEX "SongPeriodSnapshot_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("periodStart", "periodEnd");
CREATE UNIQUE INDEX "SongPeriodSnapshot_importId_releaseId_periodStart_periodEnd_key" ON "SongPeriodSnapshot"("importId", "releaseId", "periodStart", "periodEnd");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "AnalyticsImportRow_confirmedScopeKey_key" ON "AnalyticsImportRow"("confirmedScopeKey");
CREATE UNIQUE INDEX "AnalyticsImportRow_importId_sourceRowNumber_key" ON "AnalyticsImportRow"("importId", "sourceRowNumber");
CREATE INDEX "AnalyticsImportRow_importId_mappingStatus_idx" ON "AnalyticsImportRow"("importId", "mappingStatus");
CREATE INDEX "AnalyticsImportRow_exportType_mappingStatus_idx" ON "AnalyticsImportRow"("exportType", "mappingStatus");
CREATE INDEX "AnalyticsImportRow_mappingConfidence_idx" ON "AnalyticsImportRow"("mappingConfidence");
CREATE INDEX "AnalyticsImportRow_suggestedReleaseId_idx" ON "AnalyticsImportRow"("suggestedReleaseId");
CREATE INDEX "AnalyticsImportRow_confirmedReleaseId_idx" ON "AnalyticsImportRow"("confirmedReleaseId");
CREATE INDEX "AnalyticsImportRow_appliedAliasId_idx" ON "AnalyticsImportRow"("appliedAliasId");
CREATE UNIQUE INDEX "ReleaseImportAlias_activeScopeKey_key" ON "ReleaseImportAlias"("activeScopeKey");
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
