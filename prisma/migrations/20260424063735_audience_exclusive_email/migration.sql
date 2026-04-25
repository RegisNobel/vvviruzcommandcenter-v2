-- CreateTable
CREATE TABLE "Subscriber" (
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
    "unsubscribedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "previewText" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT NOT NULL DEFAULT '',
    "audienceFilter" TEXT NOT NULL DEFAULT 'all_active',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "EmailSendLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailSendLog_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "collaborator" BOOLEAN NOT NULL DEFAULT false,
    "collaboratorName" TEXT NOT NULL DEFAULT '',
    "upc" TEXT NOT NULL DEFAULT '',
    "isrc" TEXT NOT NULL DEFAULT '',
    "coverArtId" TEXT,
    "coverArtFileName" TEXT,
    "coverArtUrl" TEXT,
    "coverArtPath" TEXT NOT NULL DEFAULT '',
    "coverArtMimeType" TEXT,
    "lyrics" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'nerdcore',
    "releaseDate" TEXT NOT NULL DEFAULT '',
    "conceptDetails" TEXT NOT NULL DEFAULT '',
    "publicDescription" TEXT NOT NULL DEFAULT '',
    "publicLongDescription" TEXT NOT NULL DEFAULT '',
    "spotifyUrl" TEXT NOT NULL DEFAULT '',
    "appleMusicUrl" TEXT NOT NULL DEFAULT '',
    "youtubeUrl" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredVideoUrl" TEXT NOT NULL DEFAULT '',
    "publicLyricsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "conceptComplete" BOOLEAN NOT NULL DEFAULT false,
    "beatMade" BOOLEAN NOT NULL DEFAULT false,
    "lyricsFinished" BOOLEAN NOT NULL DEFAULT false,
    "recorded" BOOLEAN NOT NULL DEFAULT false,
    "mixMastered" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdOn" DATETIME NOT NULL,
    "updatedOn" DATETIME NOT NULL
);
INSERT INTO "new_Release" ("appleMusicUrl", "beatMade", "collaborator", "collaboratorName", "conceptComplete", "conceptDetails", "coverArtFileName", "coverArtId", "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn", "featuredVideoUrl", "id", "isFeatured", "isPublished", "isrc", "lyrics", "lyricsFinished", "mixMastered", "pinned", "publicDescription", "publicLongDescription", "publicLyricsEnabled", "published", "recorded", "releaseDate", "slug", "spotifyUrl", "title", "type", "upc", "updatedOn", "youtubeUrl") SELECT "appleMusicUrl", "beatMade", "collaborator", "collaboratorName", "conceptComplete", "conceptDetails", "coverArtFileName", "coverArtId", "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn", "featuredVideoUrl", "id", "isFeatured", "isPublished", "isrc", "lyrics", "lyricsFinished", "mixMastered", "pinned", "publicDescription", "publicLongDescription", "publicLyricsEnabled", "published", "recorded", "releaseDate", "slug", "spotifyUrl", "title", "type", "upc", "updatedOn", "youtubeUrl" FROM "Release";
DROP TABLE "Release";
ALTER TABLE "new_Release" RENAME TO "Release";
CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");
CREATE INDEX "Release_pinned_updatedOn_idx" ON "Release"("pinned", "updatedOn");
CREATE INDEX "Release_isPublished_releaseDate_idx" ON "Release"("isPublished", "releaseDate");
CREATE INDEX "Release_isFeatured_releaseDate_idx" ON "Release"("isFeatured", "releaseDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_downloadToken_key" ON "Subscriber"("downloadToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "Subscriber_status_createdAt_idx" ON "Subscriber"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Subscriber_source_status_idx" ON "Subscriber"("source", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_createdAt_idx" ON "EmailCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_campaignId_createdAt_idx" ON "EmailSendLog"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_subscriberId_idx" ON "EmailSendLog"("subscriberId");

-- CreateIndex
CREATE INDEX "EmailSendLog_status_createdAt_idx" ON "EmailSendLog"("status", "createdAt");
