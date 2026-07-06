-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlaylistRelease" (
    "playlistId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "spotifyTargetUrl" TEXT NOT NULL DEFAULT '',
    "spotifyTrackUrl" TEXT NOT NULL DEFAULT '',
    "spotifyTargetMode" TEXT NOT NULL DEFAULT 'manual',
    "appleTargetUrl" TEXT NOT NULL DEFAULT '',
    "youtubeTargetUrl" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("playlistId", "releaseId"),
    CONSTRAINT "PlaylistRelease_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaylistRelease_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlaylistRelease" ("appleTargetUrl", "createdAt", "isActive", "playlistId", "position", "releaseId", "spotifyTargetUrl", "updatedAt", "youtubeTargetUrl") SELECT "appleTargetUrl", "createdAt", "isActive", "playlistId", "position", "releaseId", "spotifyTargetUrl", "updatedAt", "youtubeTargetUrl" FROM "PlaylistRelease";
DROP TABLE "PlaylistRelease";
ALTER TABLE "new_PlaylistRelease" RENAME TO "PlaylistRelease";
CREATE INDEX "PlaylistRelease_playlistId_position_idx" ON "PlaylistRelease"("playlistId", "position");
CREATE INDEX "PlaylistRelease_releaseId_idx" ON "PlaylistRelease"("releaseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
