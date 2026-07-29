-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArtistFeaturedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "coverArtUrl" TEXT NOT NULL DEFAULT '',
    "coverArtAlt" TEXT NOT NULL DEFAULT '',
    "isStartHere" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistFeaturedItem_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArtistFeaturedItem" ("artistProfileId", "coverArtUrl", "createdAt", "description", "eyebrow", "id", "isStartHere", "itemType", "sortOrder", "subtitle", "title", "updatedAt", "url") SELECT "artistProfileId", "coverArtUrl", "createdAt", "description", "eyebrow", "id", "isStartHere", "itemType", "sortOrder", "subtitle", "title", "updatedAt", "url" FROM "ArtistFeaturedItem";
DROP TABLE "ArtistFeaturedItem";
ALTER TABLE "new_ArtistFeaturedItem" RENAME TO "ArtistFeaturedItem";
CREATE INDEX "ArtistFeaturedItem_artistProfileId_sortOrder_idx" ON "ArtistFeaturedItem"("artistProfileId", "sortOrder");
CREATE TABLE "new_ArtistProfile" (
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
    "presentationCopy" TEXT NOT NULL DEFAULT '{}',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "socialImageUrl" TEXT NOT NULL DEFAULT '',
    "publishedVersionId" TEXT,
    "draftUpdatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "pausedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistProfile_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ArtistProfileVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ArtistProfile" ("archivedAt", "createdAt", "differentiator", "displayName", "draftUpdatedAt", "genres", "id", "location", "longBio", "pausedAt", "primaryCtaLabel", "primaryCtaUrl", "privateContactEmail", "profileImageAlt", "profileImagePath", "publishedAt", "publishedVersionId", "secondaryCtaLabel", "secondaryCtaUrl", "shortBio", "slug", "tagline", "themeFamily", "updatedAt", "workflowStatus") SELECT "archivedAt", "createdAt", "differentiator", "displayName", "draftUpdatedAt", "genres", "id", "location", "longBio", "pausedAt", "primaryCtaLabel", "primaryCtaUrl", "privateContactEmail", "profileImageAlt", "profileImagePath", "publishedAt", "publishedVersionId", "secondaryCtaLabel", "secondaryCtaUrl", "shortBio", "slug", "tagline", "themeFamily", "updatedAt", "workflowStatus" FROM "ArtistProfile";
DROP TABLE "ArtistProfile";
ALTER TABLE "new_ArtistProfile" RENAME TO "ArtistProfile";
CREATE UNIQUE INDEX "ArtistProfile_slug_key" ON "ArtistProfile"("slug");
CREATE UNIQUE INDEX "ArtistProfile_publishedVersionId_key" ON "ArtistProfile"("publishedVersionId");
CREATE INDEX "ArtistProfile_workflowStatus_updatedAt_idx" ON "ArtistProfile"("workflowStatus", "updatedAt");
CREATE INDEX "ArtistProfile_publishedAt_idx" ON "ArtistProfile"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
