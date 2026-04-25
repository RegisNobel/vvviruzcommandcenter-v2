-- Store release dates as proper nullable datetimes instead of ad hoc strings.
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
    "releaseDate" DATETIME,
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

INSERT INTO "new_Release" (
    "appleMusicUrl", "beatMade", "collaborator", "collaboratorName",
    "conceptComplete", "conceptDetails", "coverArtFileName", "coverArtId",
    "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn",
    "featuredVideoUrl", "id", "isFeatured", "isPublished", "isrc",
    "lyrics", "lyricsFinished", "mixMastered", "pinned", "publicDescription",
    "publicLongDescription", "publicLyricsEnabled", "published", "recorded",
    "releaseDate", "slug", "spotifyUrl", "title", "type", "upc",
    "updatedOn", "youtubeUrl"
)
SELECT
    "appleMusicUrl", "beatMade", "collaborator", "collaboratorName",
    "conceptComplete", "conceptDetails", "coverArtFileName", "coverArtId",
    "coverArtMimeType", "coverArtPath", "coverArtUrl", "createdOn",
    "featuredVideoUrl", "id", "isFeatured", "isPublished", "isrc",
    "lyrics", "lyricsFinished", "mixMastered", "pinned", "publicDescription",
    "publicLongDescription", "publicLyricsEnabled", "published", "recorded",
    CASE
      WHEN "releaseDate" IS NULL OR trim("releaseDate") = '' THEN NULL
      WHEN strftime('%Y-%m-%dT%H:%M:%fZ', "releaseDate") IS NOT NULL
        THEN strftime('%Y-%m-%dT%H:%M:%fZ', "releaseDate")
      ELSE NULL
    END,
    "slug", "spotifyUrl", "title", "type", "upc", "updatedOn", "youtubeUrl"
FROM "Release";

DROP TABLE "Release";
ALTER TABLE "new_Release" RENAME TO "Release";
CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");
CREATE INDEX "Release_pinned_updatedOn_idx" ON "Release"("pinned", "updatedOn");
CREATE INDEX "Release_isPublished_releaseDate_idx" ON "Release"("isPublished", "releaseDate");
CREATE INDEX "Release_isFeatured_releaseDate_idx" ON "Release"("isFeatured", "releaseDate");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
