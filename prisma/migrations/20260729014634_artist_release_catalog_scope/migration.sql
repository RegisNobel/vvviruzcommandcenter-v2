-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArtistFeaturedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artistProfileId" TEXT NOT NULL,
    "releaseId" TEXT,
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
    CONSTRAINT "ArtistFeaturedItem_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistFeaturedItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ArtistFeaturedItem" ("artistProfileId", "coverArtAlt", "coverArtUrl", "createdAt", "description", "eyebrow", "id", "isStartHere", "itemType", "sortOrder", "subtitle", "title", "updatedAt", "url") SELECT "artistProfileId", "coverArtAlt", "coverArtUrl", "createdAt", "description", "eyebrow", "id", "isStartHere", "itemType", "sortOrder", "subtitle", "title", "updatedAt", "url" FROM "ArtistFeaturedItem";
DROP TABLE "ArtistFeaturedItem";
ALTER TABLE "new_ArtistFeaturedItem" RENAME TO "ArtistFeaturedItem";
CREATE INDEX "ArtistFeaturedItem_artistProfileId_sortOrder_idx" ON "ArtistFeaturedItem"("artistProfileId", "sortOrder");
CREATE INDEX "ArtistFeaturedItem_releaseId_idx" ON "ArtistFeaturedItem"("releaseId");
CREATE TABLE "new_Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "catalogScope" TEXT NOT NULL DEFAULT 'VVVIRUZ',
    "primaryArtistProfileId" TEXT,
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
    "releaseDate" DATETIME,
    "conceptDetails" TEXT NOT NULL DEFAULT '',
    "publicDescription" TEXT NOT NULL DEFAULT '',
    "publicLongDescription" TEXT NOT NULL DEFAULT '',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "genres" TEXT NOT NULL DEFAULT '[]',
    "moods" TEXT NOT NULL DEFAULT '[]',
    "inspirationContext" TEXT NOT NULL DEFAULT '',
    "themes" TEXT NOT NULL DEFAULT '[]',
    "listenerContexts" TEXT NOT NULL DEFAULT '[]',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "coverArtAltText" TEXT NOT NULL DEFAULT '',
    "socialShareTitle" TEXT NOT NULL DEFAULT '',
    "socialShareDescription" TEXT NOT NULL DEFAULT '',
    "contextualCtaLabel" TEXT NOT NULL DEFAULT '',
    "contextualCtaUrl" TEXT NOT NULL DEFAULT '',
    "spotifyUrl" TEXT NOT NULL DEFAULT '',
    "appleMusicUrl" TEXT NOT NULL DEFAULT '',
    "youtubeUrl" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredVideoUrl" TEXT NOT NULL DEFAULT '',
    "publicLyricsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lyricsRightsConfirmedAt" DATETIME,
    "conceptComplete" BOOLEAN NOT NULL DEFAULT false,
    "beatMade" BOOLEAN NOT NULL DEFAULT false,
    "lyricsFinished" BOOLEAN NOT NULL DEFAULT false,
    "recorded" BOOLEAN NOT NULL DEFAULT false,
    "mixMastered" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdOn" DATETIME NOT NULL,
    "updatedOn" DATETIME NOT NULL,
    CONSTRAINT "Release_primaryArtistProfileId_fkey" FOREIGN KEY ("primaryArtistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Release" ("appleMusicUrl", "beatMade", "collaborator", "collaboratorName", "conceptComplete", "conceptDetails", "contextualCtaLabel", "contextualCtaUrl", "coverArtAltText", "coverArtFileName", "coverArtId", "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn", "featuredVideoUrl", "genres", "id", "inspirationContext", "isFeatured", "isPublished", "isrc", "languages", "listenerContexts", "lyrics", "lyricsFinished", "metaDescription", "mixMastered", "moods", "pinned", "publicDescription", "publicLongDescription", "publicLyricsEnabled", "published", "recorded", "releaseDate", "seoTitle", "slug", "socialShareDescription", "socialShareTitle", "spotifyUrl", "themes", "title", "type", "upc", "updatedOn", "youtubeUrl") SELECT "appleMusicUrl", "beatMade", "collaborator", "collaboratorName", "conceptComplete", "conceptDetails", "contextualCtaLabel", "contextualCtaUrl", "coverArtAltText", "coverArtFileName", "coverArtId", "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn", "featuredVideoUrl", "genres", "id", "inspirationContext", "isFeatured", "isPublished", "isrc", "languages", "listenerContexts", "lyrics", "lyricsFinished", "metaDescription", "mixMastered", "moods", "pinned", "publicDescription", "publicLongDescription", "publicLyricsEnabled", "published", "recorded", "releaseDate", "seoTitle", "slug", "socialShareDescription", "socialShareTitle", "spotifyUrl", "themes", "title", "type", "upc", "updatedOn", "youtubeUrl" FROM "Release";
DROP TABLE "Release";
ALTER TABLE "new_Release" RENAME TO "Release";
CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");
CREATE INDEX "Release_pinned_updatedOn_idx" ON "Release"("pinned", "updatedOn");
CREATE INDEX "Release_isPublished_releaseDate_idx" ON "Release"("isPublished", "releaseDate");
CREATE INDEX "Release_isFeatured_releaseDate_idx" ON "Release"("isFeatured", "releaseDate");
CREATE INDEX "Release_catalogScope_isPublished_releaseDate_idx" ON "Release"("catalogScope", "isPublished", "releaseDate");
CREATE INDEX "Release_primaryArtistProfileId_updatedOn_idx" ON "Release"("primaryArtistProfileId", "updatedOn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
