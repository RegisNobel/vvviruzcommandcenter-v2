-- CreateTable
CREATE TABLE "AnalyticsImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'SPOTIFY_FOR_ARTISTS',
    "importType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByUsername" TEXT NOT NULL DEFAULT '',
    "uploadedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportingTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "detectedPeriodStart" DATETIME,
    "detectedPeriodEnd" DATETIME,
    "userConfirmedPeriodStart" DATETIME,
    "userConfirmedPeriodEnd" DATETIME,
    "periodDatesUserConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedRowCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRowCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "validationSummary" TEXT NOT NULL DEFAULT '{}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
    "rawFileStorageDriver" TEXT,
    "rawFileStorageKey" TEXT,
    "rawFileSizeBytes" INTEGER,
    "rawFileExpiresAt" DATETIME,
    "rawFileDeletedAt" DATETIME,
    "acceptedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "withdrawnById" TEXT,
    "withdrawalReason" TEXT NOT NULL DEFAULT '',
    "replacedByImportId" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalyticsImport_status_check" CHECK ("status" IN ('PENDING', 'PREVIEWED', 'IMPORTED', 'FAILED', 'WITHDRAWN', 'REPLACED')),
    CONSTRAINT "AnalyticsImport_fileHash_check" CHECK (length("fileHash") = 64),
    CONSTRAINT "AnalyticsImport_counts_check" CHECK ("rowCount" >= 0 AND "acceptedRowCount" >= 0 AND "rejectedRowCount" >= 0 AND "unmatchedRowCount" >= 0 AND "warningCount" >= 0),
    CONSTRAINT "AnalyticsImport_normalizationVersion_check" CHECK ("normalizationVersion" > 0),
    CONSTRAINT "AnalyticsImport_rawFileSizeBytes_check" CHECK ("rawFileSizeBytes" IS NULL OR "rawFileSizeBytes" >= 0),
    CONSTRAINT "AnalyticsImport_detectedPeriod_check" CHECK ("detectedPeriodStart" IS NULL OR "detectedPeriodEnd" IS NULL OR "detectedPeriodEnd" >= "detectedPeriodStart"),
    CONSTRAINT "AnalyticsImport_confirmedPeriod_check" CHECK ("userConfirmedPeriodStart" IS NULL OR "userConfirmedPeriodEnd" IS NULL OR "userConfirmedPeriodEnd" >= "userConfirmedPeriodStart"),
    CONSTRAINT "AnalyticsImport_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImport_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsImport_replacedByImportId_fkey" FOREIGN KEY ("replacedByImportId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistMetricObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "metricDate" DATETIME NOT NULL,
    "listeners" INTEGER NOT NULL,
    "monthlyListeners" INTEGER NOT NULL,
    "monthlyActiveListeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "playlistAdds" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "ArtistMetricObservation_metrics_check" CHECK ("listeners" >= 0 AND "monthlyListeners" >= 0 AND "monthlyActiveListeners" >= 0 AND "streams" >= 0 AND "playlistAdds" >= 0 AND "saves" >= 0 AND "followers" >= 0),
    CONSTRAINT "ArtistMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArtistMetricObservation_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackMetricObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "spotifyTrackId" TEXT,
    "metricDate" DATETIME NOT NULL,
    "streams" INTEGER NOT NULL,
    "listeners" INTEGER,
    "saves" INTEGER,
    "playlistAdds" INTEGER,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "TrackMetricObservation_metrics_check" CHECK ("streams" >= 0 AND ("listeners" IS NULL OR "listeners" >= 0) AND ("saves" IS NULL OR "saves" >= 0) AND ("playlistAdds" IS NULL OR "playlistAdds" >= 0)),
    CONSTRAINT "TrackMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrackMetricObservation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SongPeriodSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "exportedReleaseDate" DATETIME NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "SongPeriodSnapshot_period_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "SongPeriodSnapshot_metrics_check" CHECK ("listeners" >= 0 AND "streams" >= 0 AND "saves" >= 0),
    CONSTRAINT "SongPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SongPeriodSnapshot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaylistPeriodSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "playlistTitle" TEXT NOT NULL,
    "playlistAuthor" TEXT NOT NULL,
    "playlistSpotifyId" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "dateAdded" DATETIME,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "PlaylistPeriodSnapshot_period_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "PlaylistPeriodSnapshot_metrics_check" CHECK ("listeners" >= 0 AND "streams" >= 0),
    CONSTRAINT "PlaylistPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImport_fileHash_key" ON "AnalyticsImport"("fileHash");

-- CreateIndex
CREATE INDEX "AnalyticsImport_source_importType_idx" ON "AnalyticsImport"("source", "importType");

-- CreateIndex
CREATE INDEX "AnalyticsImport_artistProfileId_importType_acceptedAt_idx" ON "AnalyticsImport"("artistProfileId", "importType", "acceptedAt");

-- CreateIndex
CREATE INDEX "AnalyticsImport_status_acceptedAt_idx" ON "AnalyticsImport"("status", "acceptedAt");

-- CreateIndex
CREATE INDEX "AnalyticsImport_uploadedById_idx" ON "AnalyticsImport"("uploadedById");

-- CreateIndex
CREATE INDEX "AnalyticsImport_withdrawnById_idx" ON "AnalyticsImport"("withdrawnById");

-- CreateIndex
CREATE INDEX "AnalyticsImport_replacedByImportId_idx" ON "AnalyticsImport"("replacedByImportId");

-- CreateIndex
CREATE INDEX "AnalyticsImport_rawFileExpiresAt_idx" ON "AnalyticsImport"("rawFileExpiresAt");

-- CreateIndex
CREATE INDEX "ArtistMetricObservation_artistProfileId_metricDate_idx" ON "ArtistMetricObservation"("artistProfileId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistMetricObservation_importId_artistProfileId_metricDate_key" ON "ArtistMetricObservation"("importId", "artistProfileId", "metricDate");

-- CreateIndex
CREATE INDEX "TrackMetricObservation_releaseId_metricDate_idx" ON "TrackMetricObservation"("releaseId", "metricDate");

-- CreateIndex
CREATE INDEX "TrackMetricObservation_spotifyTrackId_metricDate_idx" ON "TrackMetricObservation"("spotifyTrackId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrackMetricObservation_importId_releaseId_metricDate_key" ON "TrackMetricObservation"("importId", "releaseId", "metricDate");

-- CreateIndex
CREATE INDEX "SongPeriodSnapshot_releaseId_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("releaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SongPeriodSnapshot_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SongPeriodSnapshot_importId_releaseId_periodStart_periodEnd_key" ON "SongPeriodSnapshot"("importId", "releaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_playlistTitle_playlistAuthor_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("playlistTitle", "playlistAuthor", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_playlistSpotifyId_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("playlistSpotifyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlaylistPeriodSnapshot_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistPeriodSnapshot_importId_playlistTitle_playlistAuthor_periodStart_periodEnd_key" ON "PlaylistPeriodSnapshot"("importId", "playlistTitle", "playlistAuthor", "periodStart", "periodEnd");

-- Seed the private, unpublished canonical artist used by artist-level analytics.
INSERT OR IGNORE INTO "ArtistProfile" (
    "id", "slug", "displayName", "workflowStatus", "draftUpdatedAt", "createdAt", "updatedAt"
) VALUES (
    'artist-profile-vvviruz', 'vvviruz', 'vvviruz', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
