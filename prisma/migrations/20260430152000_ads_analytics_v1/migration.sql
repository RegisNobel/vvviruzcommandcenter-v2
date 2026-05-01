-- CreateTable
CREATE TABLE "AdImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'meta',
    "name" TEXT NOT NULL DEFAULT '',
    "releaseId" TEXT,
    "reportingStart" DATETIME,
    "reportingEnd" DATETIME,
    "fileNames" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdImportBatch_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdCreativeReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "releaseId" TEXT,
    "campaignName" TEXT,
    "adSetName" TEXT,
    "adName" TEXT NOT NULL,
    "adDelivery" TEXT,
    "reportingStart" DATETIME,
    "reportingEnd" DATETIME,
    "spend" REAL,
    "impressions" INTEGER,
    "reach" INTEGER,
    "results" REAL,
    "costPerResult" REAL,
    "linkClicks" INTEGER,
    "cpc" REAL,
    "ctr" REAL,
    "pageEngagement" INTEGER,
    "postReactions" INTEGER,
    "postComments" INTEGER,
    "postSaves" INTEGER,
    "postShares" INTEGER,
    "instagramFollows" INTEGER,
    "videoPlays" INTEGER,
    "threeSecondPlays" INTEGER,
    "thruPlays" INTEGER,
    "costPerThruPlay" REAL,
    "video25" INTEGER,
    "video50" INTEGER,
    "video75" INTEGER,
    "video95" INTEGER,
    "video100" INTEGER,
    "qualityRanking" TEXT,
    "engagementRateRanking" TEXT,
    "conversionRateRanking" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCreativeReport_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCreativeReport_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdCreativeCopyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adCreativeReportId" TEXT NOT NULL,
    "copyEntryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "AdCreativeCopyLink_adCreativeReportId_fkey" FOREIGN KEY ("adCreativeReportId") REFERENCES "AdCreativeReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCreativeCopyLink_copyEntryId_fkey" FOREIGN KEY ("copyEntryId") REFERENCES "CopyEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdCampaignLearning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "releaseId" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "whatWorked" TEXT NOT NULL DEFAULT '',
    "whatFailed" TEXT NOT NULL DEFAULT '',
    "nextTest" TEXT NOT NULL DEFAULT '',
    "decision" TEXT NOT NULL DEFAULT 'iterate',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaignLearning_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCampaignLearning_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdImportBatch_releaseId_idx" ON "AdImportBatch"("releaseId");

-- CreateIndex
CREATE INDEX "AdImportBatch_createdAt_idx" ON "AdImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "AdCreativeReport_importBatchId_idx" ON "AdCreativeReport"("importBatchId");

-- CreateIndex
CREATE INDEX "AdCreativeReport_releaseId_idx" ON "AdCreativeReport"("releaseId");

-- CreateIndex
CREATE INDEX "AdCreativeReport_utmSource_utmCampaign_utmContent_idx" ON "AdCreativeReport"("utmSource", "utmCampaign", "utmContent");

-- CreateIndex
CREATE INDEX "AdCreativeReport_adName_adSetName_reportingStart_reportingEnd_idx" ON "AdCreativeReport"("adName", "adSetName", "reportingStart", "reportingEnd");

-- CreateIndex
CREATE INDEX "AdCreativeCopyLink_copyEntryId_idx" ON "AdCreativeCopyLink"("copyEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreativeCopyLink_adCreativeReportId_copyEntryId_key" ON "AdCreativeCopyLink"("adCreativeReportId", "copyEntryId");

-- CreateIndex
CREATE INDEX "AdCampaignLearning_importBatchId_idx" ON "AdCampaignLearning"("importBatchId");

-- CreateIndex
CREATE INDEX "AdCampaignLearning_releaseId_idx" ON "AdCampaignLearning"("releaseId");

-- CreateIndex
CREATE INDEX "AdCampaignLearning_updatedAt_idx" ON "AdCampaignLearning"("updatedAt");
