/*
  Warnings:

  - You are about to drop the `LyricLine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LyricProject` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "LyricLine_projectId_sortOrder_idx";

-- DropIndex
DROP INDEX "LyricProject_updatedAt_idx";

-- DropIndex
DROP INDEX "LyricProject_releaseId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LyricLine";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LyricProject";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AppearsOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "coverArtUrl" TEXT NOT NULL,
    "spotifyUrl" TEXT NOT NULL,
    "appleMusicUrl" TEXT NOT NULL DEFAULT '',
    "youtubeMusicUrl" TEXT NOT NULL DEFAULT '',
    "youtubeUrl" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommissionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "budgetRange" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "specificDeadline" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL,
    "beatLink" TEXT NOT NULL DEFAULT '',
    "referenceLink" TEXT NOT NULL DEFAULT '',
    "usageIntent" TEXT NOT NULL,
    "additionalNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'New',
    "quotedPrice" TEXT NOT NULL DEFAULT '',
    "paypalLink" TEXT NOT NULL DEFAULT '',
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "deliveryLink" TEXT NOT NULL DEFAULT '',
    "utmSource" TEXT NOT NULL DEFAULT '',
    "utmMedium" TEXT NOT NULL DEFAULT '',
    "utmCampaign" TEXT NOT NULL DEFAULT '',
    "utmContent" TEXT NOT NULL DEFAULT '',
    "utmTerm" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "landingPage" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdCampaignLearning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "releaseId" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "whatWorked" TEXT NOT NULL DEFAULT '',
    "whatFailed" TEXT NOT NULL DEFAULT '',
    "nextTest" TEXT NOT NULL DEFAULT '',
    "decision" TEXT NOT NULL DEFAULT 'iterate',
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT NOT NULL DEFAULT '',
    "finalDecision" TEXT NOT NULL DEFAULT '',
    "humanOverrideNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaignLearning_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AdImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdCampaignLearning_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AdCampaignLearning" ("createdAt", "decision", "id", "importBatchId", "nextTest", "releaseId", "summary", "updatedAt", "whatFailed", "whatWorked") SELECT "createdAt", "decision", "id", "importBatchId", "nextTest", "releaseId", "summary", "updatedAt", "whatFailed", "whatWorked" FROM "AdCampaignLearning";
DROP TABLE "AdCampaignLearning";
ALTER TABLE "new_AdCampaignLearning" RENAME TO "AdCampaignLearning";
CREATE INDEX "AdCampaignLearning_importBatchId_idx" ON "AdCampaignLearning"("importBatchId");
CREATE INDEX "AdCampaignLearning_releaseId_idx" ON "AdCampaignLearning"("releaseId");
CREATE INDEX "AdCampaignLearning_updatedAt_idx" ON "AdCampaignLearning"("updatedAt");
CREATE TABLE "new_CopyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT,
    "hook" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'discovery-shock',
    "hookType" TEXT NOT NULL DEFAULT 'discovery-shock',
    "contentType" TEXT NOT NULL DEFAULT 'amv-lyric-edit',
    "songSection" TEXT NOT NULL DEFAULT 'hook',
    "creativeNotes" TEXT NOT NULL DEFAULT '',
    "createdOn" DATETIME NOT NULL,
    "updatedOn" DATETIME NOT NULL,
    CONSTRAINT "CopyEntry_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CopyEntry" ("caption", "contentType", "createdOn", "creativeNotes", "hook", "hookType", "id", "releaseId", "songSection", "type", "updatedOn") SELECT "caption", "contentType", "createdOn", "creativeNotes", "hook", "hookType", "id", "releaseId", "songSection", "type", "updatedOn" FROM "CopyEntry";
DROP TABLE "CopyEntry";
ALTER TABLE "new_CopyEntry" RENAME TO "CopyEntry";
CREATE INDEX "CopyEntry_releaseId_idx" ON "CopyEntry"("releaseId");
CREATE INDEX "CopyEntry_hookType_contentType_songSection_idx" ON "CopyEntry"("hookType", "contentType", "songSection");
CREATE INDEX "CopyEntry_updatedOn_idx" ON "CopyEntry"("updatedOn");
CREATE TABLE "new_Subscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'exclusive',
    "status" TEXT NOT NULL DEFAULT 'active',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "downloadToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "unsubscribedAt" DATETIME,
    "sourceUtmSource" TEXT NOT NULL DEFAULT '',
    "sourceUtmMedium" TEXT NOT NULL DEFAULT '',
    "sourceUtmCampaign" TEXT NOT NULL DEFAULT '',
    "sourceUtmContent" TEXT NOT NULL DEFAULT '',
    "sourceUtmTerm" TEXT NOT NULL DEFAULT '',
    "sourceReferrer" TEXT NOT NULL DEFAULT '',
    "sourceLandingPage" TEXT NOT NULL DEFAULT '',
    "sourceOfferMode" TEXT NOT NULL DEFAULT '',
    "sourceOfferName" TEXT NOT NULL DEFAULT '',
    "sourceSignupContext" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Subscriber" ("consentGiven", "createdAt", "downloadToken", "email", "id", "name", "source", "status", "unsubscribeToken", "unsubscribedAt", "updatedAt") SELECT "consentGiven", "createdAt", "downloadToken", "email", "id", "name", "source", "status", "unsubscribeToken", "unsubscribedAt", "updatedAt" FROM "Subscriber";
DROP TABLE "Subscriber";
ALTER TABLE "new_Subscriber" RENAME TO "Subscriber";
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");
CREATE UNIQUE INDEX "Subscriber_downloadToken_key" ON "Subscriber"("downloadToken");
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");
CREATE INDEX "Subscriber_status_createdAt_idx" ON "Subscriber"("status", "createdAt");
CREATE INDEX "Subscriber_source_status_idx" ON "Subscriber"("source", "status");
CREATE INDEX "Subscriber_sourceUtmCampaign_idx" ON "Subscriber"("sourceUtmCampaign");
CREATE INDEX "Subscriber_sourceOfferMode_idx" ON "Subscriber"("sourceOfferMode");
CREATE TABLE "new_short_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "release_id" TEXT,
    "campaign_label" TEXT NOT NULL DEFAULT '',
    "content_label" TEXT NOT NULL DEFAULT '',
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "short_links_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_short_links" ("campaign_label", "click_count", "content_label", "created_at", "deleted_at", "destination_url", "id", "release_id", "slug", "updated_at") SELECT "campaign_label", "click_count", "content_label", "created_at", "deleted_at", "destination_url", "id", "release_id", "slug", "updated_at" FROM "short_links";
DROP TABLE "short_links";
ALTER TABLE "new_short_links" RENAME TO "short_links";
CREATE UNIQUE INDEX "short_links_slug_key" ON "short_links"("slug");
CREATE INDEX "short_links_release_id_idx" ON "short_links"("release_id");
CREATE INDEX "short_links_created_at_idx" ON "short_links"("created_at");
CREATE INDEX "short_links_deleted_at_idx" ON "short_links"("deleted_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AppearsOn_isPublished_sortOrder_idx" ON "AppearsOn"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "CommissionRequest_status_createdAt_idx" ON "CommissionRequest"("status", "createdAt");
