-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT NOT NULL DEFAULT '',
    "spotifyPlaylistUrl" TEXT NOT NULL DEFAULT '',
    "applePlaylistUrl" TEXT NOT NULL DEFAULT '',
    "youtubePlaylistUrl" TEXT NOT NULL DEFAULT '',
    "primaryPlatform" TEXT NOT NULL DEFAULT 'spotify',
    "featuredReleaseId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Playlist_featuredReleaseId_fkey" FOREIGN KEY ("featuredReleaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaylistRelease" (
    "playlistId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "spotifyTargetUrl" TEXT NOT NULL DEFAULT '',
    "appleTargetUrl" TEXT NOT NULL DEFAULT '',
    "youtubeTargetUrl" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("playlistId", "releaseId"),
    CONSTRAINT "PlaylistRelease_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaylistRelease_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_slug_key" ON "Playlist"("slug");

-- CreateIndex
CREATE INDEX "Playlist_featuredReleaseId_idx" ON "Playlist"("featuredReleaseId");

-- CreateIndex
CREATE INDEX "Playlist_isPublic_isArchived_idx" ON "Playlist"("isPublic", "isArchived");

-- CreateIndex
CREATE INDEX "Playlist_sortOrder_idx" ON "Playlist"("sortOrder");

-- CreateIndex
CREATE INDEX "PlaylistRelease_playlistId_position_idx" ON "PlaylistRelease"("playlistId", "position");

-- CreateIndex
CREATE INDEX "PlaylistRelease_releaseId_idx" ON "PlaylistRelease"("releaseId");
