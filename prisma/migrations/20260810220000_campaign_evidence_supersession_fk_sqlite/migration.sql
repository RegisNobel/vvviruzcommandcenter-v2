-- Align SQLite's Gate E0 campaign-evidence supersession relation with the
-- logical Prisma schema while preserving all evidence rows and indexes.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CampaignEvidence" (
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
  "suggestionKey" TEXT NOT NULL DEFAULT '',
  "generationVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceResolutionFingerprint" TEXT NOT NULL DEFAULT '',
  "suggestionState" TEXT NOT NULL DEFAULT 'LEGACY',
  "supersededByEvidenceId" TEXT,
  "createdById" TEXT,
  "createdByUsername" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CampaignEvidence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CampaignEvidence_adImportBatchId_fkey" FOREIGN KEY ("adImportBatchId") REFERENCES "AdImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CampaignEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CampaignEvidence_supersededByEvidenceId_fkey" FOREIGN KEY ("supersededByEvidenceId") REFERENCES "CampaignEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_CampaignEvidence" ("adImportBatchId", "campaignId", "campaignName", "confidence", "createdAt", "createdById", "createdByUsername", "generationVersion", "id", "importedEndDate", "importedStartDate", "metadata", "rationale", "sourceRecordId", "sourceResolutionFingerprint", "sourceType", "spendEndDate", "spendStartDate", "suggestedEndDate", "suggestedStartDate", "suggestionKey", "suggestionState", "supersededByEvidenceId", "timezone", "updatedAt")
SELECT "adImportBatchId", "campaignId", "campaignName", "confidence", "createdAt", "createdById", "createdByUsername", "generationVersion", "id", "importedEndDate", "importedStartDate", "metadata", "rationale", "sourceRecordId", "sourceResolutionFingerprint", "sourceType", "spendEndDate", "spendStartDate", "suggestedEndDate", "suggestedStartDate", "suggestionKey", "suggestionState", "supersededByEvidenceId", "timezone", "updatedAt" FROM "CampaignEvidence";

DROP TABLE "CampaignEvidence";
ALTER TABLE "new_CampaignEvidence" RENAME TO "CampaignEvidence";
CREATE UNIQUE INDEX "CampaignEvidence_supersededByEvidenceId_key" ON "CampaignEvidence"("supersededByEvidenceId");
CREATE INDEX "CampaignEvidence_campaignId_sourceType_createdAt_idx" ON "CampaignEvidence"("campaignId", "sourceType", "createdAt");
CREATE INDEX "CampaignEvidence_adImportBatchId_idx" ON "CampaignEvidence"("adImportBatchId");
CREATE INDEX "CampaignEvidence_campaignName_idx" ON "CampaignEvidence"("campaignName");
CREATE INDEX "CampaignEvidence_campaignId_suggestionKey_suggestionState_idx" ON "CampaignEvidence"("campaignId", "suggestionKey", "suggestionState");
CREATE INDEX "CampaignEvidence_sourceResolutionFingerprint_idx" ON "CampaignEvidence"("sourceResolutionFingerprint");
CREATE UNIQUE INDEX "CampaignEvidence_campaignId_sourceType_sourceRecordId_key" ON "CampaignEvidence"("campaignId", "sourceType", "sourceRecordId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
