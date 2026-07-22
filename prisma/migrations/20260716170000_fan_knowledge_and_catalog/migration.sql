ALTER TABLE "Release" ADD COLUMN "contextualCtaLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Release" ADD COLUMN "contextualCtaUrl" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Album" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'album',
  "description" TEXT NOT NULL DEFAULT '',
  "story" TEXT NOT NULL DEFAULT '',
  "coverArtUrl" TEXT NOT NULL DEFAULT '',
  "coverArtAltText" TEXT NOT NULL DEFAULT '',
  "releaseDate" DATETIME,
  "spotifyUrl" TEXT NOT NULL DEFAULT '',
  "appleMusicUrl" TEXT NOT NULL DEFAULT '',
  "youtubeUrl" TEXT NOT NULL DEFAULT '',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");
CREATE INDEX "Album_isPublished_releaseDate_idx" ON "Album"("isPublished", "releaseDate");
CREATE INDEX "Album_type_releaseDate_idx" ON "Album"("type", "releaseDate");

CREATE TABLE "AlbumTrack" (
  "albumId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  PRIMARY KEY ("albumId", "releaseId"),
  CONSTRAINT "AlbumTrack_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlbumTrack_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AlbumTrack_albumId_position_idx" ON "AlbumTrack"("albumId", "position");
CREATE INDEX "AlbumTrack_releaseId_idx" ON "AlbumTrack"("releaseId");

CREATE TABLE "ReleaseAnnotation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'lyric_note',
  "lyricExcerpt" TEXT NOT NULL DEFAULT '',
  "lineStart" INTEGER,
  "lineEnd" INTEGER,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "confidence" TEXT NOT NULL DEFAULT 'official_context',
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "lastReviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReleaseAnnotation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReleaseAnnotation_releaseId_status_isPublic_sortOrder_idx" ON "ReleaseAnnotation"("releaseId", "status", "isPublic", "sortOrder");
CREATE INDEX "ReleaseAnnotation_updatedAt_idx" ON "ReleaseAnnotation"("updatedAt");

CREATE TABLE "ReleaseAnnotationSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "annotationId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReleaseAnnotationSource_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "ReleaseAnnotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReleaseAnnotationSource_annotationId_sortOrder_idx" ON "ReleaseAnnotationSource"("annotationId", "sortOrder");

CREATE TABLE "FanUpdate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'release',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "href" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FanUpdate_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "FanUpdate_isPublished_publishedAt_idx" ON "FanUpdate"("isPublished", "publishedAt");
CREATE INDEX "FanUpdate_releaseId_idx" ON "FanUpdate"("releaseId");

CREATE TABLE "VaultItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "itemType" TEXT NOT NULL DEFAULT 'track',
  "description" TEXT NOT NULL DEFAULT '',
  "coverArtUrl" TEXT NOT NULL DEFAULT '',
  "previewUrl" TEXT NOT NULL DEFAULT '',
  "priceLabel" TEXT NOT NULL DEFAULT '',
  "checkoutUrl" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VaultItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VaultItem_slug_key" ON "VaultItem"("slug");
CREATE INDEX "VaultItem_status_sortOrder_idx" ON "VaultItem"("status", "sortOrder");
CREATE INDEX "VaultItem_releaseId_idx" ON "VaultItem"("releaseId");
