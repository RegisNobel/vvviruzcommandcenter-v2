-- CreateTable
CREATE TABLE "ArtistProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "privateContactEmail" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "workflowStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "themeFamily" TEXT NOT NULL DEFAULT 'signal-noir',
    "tagline" TEXT NOT NULL DEFAULT '',
    "shortBio" TEXT NOT NULL DEFAULT '',
    "longBio" TEXT NOT NULL DEFAULT '',
    "differentiator" TEXT NOT NULL DEFAULT '',
    "genres" TEXT NOT NULL DEFAULT '[]',
    "primaryCtaLabel" TEXT NOT NULL DEFAULT '',
    "primaryCtaUrl" TEXT NOT NULL DEFAULT '',
    "secondaryCtaLabel" TEXT NOT NULL DEFAULT '',
    "secondaryCtaUrl" TEXT NOT NULL DEFAULT '',
    "profileImagePath" TEXT NOT NULL DEFAULT '',
    "profileImageAlt" TEXT NOT NULL DEFAULT '',
    "publishedVersionId" TEXT,
    "draftUpdatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "pausedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistProfile_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ArtistProfileVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistProfileVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "previewTokenHash" TEXT,
    "createdAt" DATETIME NOT NULL,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    CONSTRAINT "ArtistProfileVersion_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistProfileApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "decidedByEmail" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "decidedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistProfileApproval_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistProfileApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtistProfileVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistLink_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistProfileMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rightsConfirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistProfileMedia_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistFeaturedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "coverArtUrl" TEXT NOT NULL DEFAULT '',
    "isStartHere" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistFeaturedItem_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReleaseArtistCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLLABORATOR',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReleaseArtistCredit_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReleaseArtistCredit_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppearsOnArtistCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appearsOnId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FEATURED',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppearsOnArtistCredit_appearsOnId_fkey" FOREIGN KEY ("appearsOnId") REFERENCES "AppearsOn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppearsOnArtistCredit_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "eventType" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "hubPath" TEXT NOT NULL DEFAULT '',
    "playlistId" TEXT,
    "playlistSlug" TEXT NOT NULL DEFAULT '',
    "shortLinkId" TEXT,
    "releaseId" TEXT,
    "artistProfileId" TEXT,
    "platform" TEXT NOT NULL DEFAULT '',
    "entryType" TEXT NOT NULL DEFAULT '',
    "linkType" TEXT NOT NULL DEFAULT '',
    "linkLabel" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT '',
    "contentId" TEXT NOT NULL DEFAULT '',
    "interactionSource" TEXT NOT NULL DEFAULT '',
    "targetUrl" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "originalReferrer" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "visitorId" TEXT NOT NULL DEFAULT '',
    "sessionId" TEXT NOT NULL DEFAULT '',
    "utmSource" TEXT NOT NULL DEFAULT '',
    "utmMedium" TEXT NOT NULL DEFAULT '',
    "utmCampaign" TEXT NOT NULL DEFAULT '',
    "utmContent" TEXT NOT NULL DEFAULT '',
    "utmTerm" TEXT NOT NULL DEFAULT '',
    "fbclid" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "AnalyticsEvent_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AnalyticsEvent" ("contentId", "contentType", "country", "createdAt", "entryType", "eventId", "eventType", "fbclid", "hubPath", "id", "interactionSource", "linkLabel", "linkType", "originalReferrer", "page", "path", "platform", "playlistId", "playlistSlug", "referrer", "releaseId", "sessionId", "shortLinkId", "targetUrl", "userAgent", "utmCampaign", "utmContent", "utmMedium", "utmSource", "utmTerm", "visitorId") SELECT "contentId", "contentType", "country", "createdAt", "entryType", "eventId", "eventType", "fbclid", "hubPath", "id", "interactionSource", "linkLabel", "linkType", "originalReferrer", "page", "path", "platform", "playlistId", "playlistSlug", "referrer", "releaseId", "sessionId", "shortLinkId", "targetUrl", "userAgent", "utmCampaign", "utmContent", "utmMedium", "utmSource", "utmTerm", "visitorId" FROM "AnalyticsEvent";
DROP TABLE "AnalyticsEvent";
ALTER TABLE "new_AnalyticsEvent" RENAME TO "AnalyticsEvent";
CREATE INDEX "AnalyticsEvent_page_createdAt_idx" ON "AnalyticsEvent"("page", "createdAt");
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_releaseId_createdAt_idx" ON "AnalyticsEvent"("releaseId", "createdAt");
CREATE INDEX "AnalyticsEvent_artistProfileId_createdAt_idx" ON "AnalyticsEvent"("artistProfileId", "createdAt");
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
CREATE INDEX "AnalyticsEvent_playlistId_eventType_createdAt_idx" ON "AnalyticsEvent"("playlistId", "eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_playlistId_releaseId_createdAt_idx" ON "AnalyticsEvent"("playlistId", "releaseId", "createdAt");
CREATE INDEX "AnalyticsEvent_shortLinkId_createdAt_idx" ON "AnalyticsEvent"("shortLinkId", "createdAt");
CREATE UNIQUE INDEX "AnalyticsEvent_eventId_eventType_key" ON "AnalyticsEvent"("eventId", "eventType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfile_slug_key" ON "ArtistProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfile_publishedVersionId_key" ON "ArtistProfile"("publishedVersionId");

-- CreateIndex
CREATE INDEX "ArtistProfile_workflowStatus_updatedAt_idx" ON "ArtistProfile"("workflowStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "ArtistProfile_publishedAt_idx" ON "ArtistProfile"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfileVersion_previewTokenHash_key" ON "ArtistProfileVersion"("previewTokenHash");

-- CreateIndex
CREATE INDEX "ArtistProfileVersion_artistProfileId_createdAt_idx" ON "ArtistProfileVersion"("artistProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ArtistProfileVersion_approvalStatus_createdAt_idx" ON "ArtistProfileVersion"("approvalStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfileVersion_artistProfileId_version_key" ON "ArtistProfileVersion"("artistProfileId", "version");

-- CreateIndex
CREATE INDEX "ArtistProfileApproval_artistProfileId_decidedAt_idx" ON "ArtistProfileApproval"("artistProfileId", "decidedAt");

-- CreateIndex
CREATE INDEX "ArtistProfileApproval_versionId_decidedAt_idx" ON "ArtistProfileApproval"("versionId", "decidedAt");

-- CreateIndex
CREATE INDEX "ArtistLink_artistProfileId_sortOrder_idx" ON "ArtistLink"("artistProfileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistLink_artistProfileId_platform_key" ON "ArtistLink"("artistProfileId", "platform");

-- CreateIndex
CREATE INDEX "ArtistProfileMedia_artistProfileId_kind_sortOrder_idx" ON "ArtistProfileMedia"("artistProfileId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "ArtistFeaturedItem_artistProfileId_sortOrder_idx" ON "ArtistFeaturedItem"("artistProfileId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReleaseArtistCredit_releaseId_displayOrder_idx" ON "ReleaseArtistCredit"("releaseId", "displayOrder");

-- CreateIndex
CREATE INDEX "ReleaseArtistCredit_artistProfileId_displayOrder_idx" ON "ReleaseArtistCredit"("artistProfileId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseArtistCredit_releaseId_artistProfileId_role_key" ON "ReleaseArtistCredit"("releaseId", "artistProfileId", "role");

-- CreateIndex
CREATE INDEX "AppearsOnArtistCredit_appearsOnId_displayOrder_idx" ON "AppearsOnArtistCredit"("appearsOnId", "displayOrder");

-- CreateIndex
CREATE INDEX "AppearsOnArtistCredit_artistProfileId_displayOrder_idx" ON "AppearsOnArtistCredit"("artistProfileId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AppearsOnArtistCredit_appearsOnId_artistProfileId_role_key" ON "AppearsOnArtistCredit"("appearsOnId", "artistProfileId", "role");
