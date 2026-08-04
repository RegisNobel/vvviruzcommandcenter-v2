-- Reviewed PostgreSQL companion for Stage 1 analytics data foundation.
--
-- Stage 0 physical cleanup is intentionally separate from these additions.
-- A future reviewed `prisma db push` may also propose dropping
-- public."AppearsOnArtistCredit"."artistLinkId" and its foreign key. That
-- removal must be identified and reviewed independently before approval.

CREATE TABLE "AnalyticsImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SPOTIFY_FOR_ARTISTS',
    "importType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByUsername" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportingTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "detectedPeriodStart" TIMESTAMP(3),
    "detectedPeriodEnd" TIMESTAMP(3),
    "userConfirmedPeriodStart" TIMESTAMP(3),
    "userConfirmedPeriodEnd" TIMESTAMP(3),
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
    "rawFileExpiresAt" TIMESTAMP(3),
    "rawFileDeletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,
    "withdrawalReason" TEXT NOT NULL DEFAULT '',
    "replacedByImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsImport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsImport_status_check" CHECK ("status" IN ('PENDING', 'PREVIEWED', 'IMPORTED', 'FAILED', 'WITHDRAWN', 'REPLACED')),
    CONSTRAINT "AnalyticsImport_fileHash_check" CHECK (length("fileHash") = 64),
    CONSTRAINT "AnalyticsImport_counts_check" CHECK ("rowCount" >= 0 AND "acceptedRowCount" >= 0 AND "rejectedRowCount" >= 0 AND "unmatchedRowCount" >= 0 AND "warningCount" >= 0),
    CONSTRAINT "AnalyticsImport_normalizationVersion_check" CHECK ("normalizationVersion" > 0),
    CONSTRAINT "AnalyticsImport_rawFileSizeBytes_check" CHECK ("rawFileSizeBytes" IS NULL OR "rawFileSizeBytes" >= 0),
    CONSTRAINT "AnalyticsImport_detectedPeriod_check" CHECK ("detectedPeriodStart" IS NULL OR "detectedPeriodEnd" IS NULL OR "detectedPeriodEnd" >= "detectedPeriodStart"),
    CONSTRAINT "AnalyticsImport_confirmedPeriod_check" CHECK ("userConfirmedPeriodStart" IS NULL OR "userConfirmedPeriodEnd" IS NULL OR "userConfirmedPeriodEnd" >= "userConfirmedPeriodStart")
);

CREATE TABLE "ArtistMetricObservation" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "monthlyListeners" INTEGER NOT NULL,
    "monthlyActiveListeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "playlistAdds" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistMetricObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArtistMetricObservation_metrics_check" CHECK ("listeners" >= 0 AND "monthlyListeners" >= 0 AND "monthlyActiveListeners" >= 0 AND "streams" >= 0 AND "playlistAdds" >= 0 AND "saves" >= 0 AND "followers" >= 0)
);

CREATE TABLE "TrackMetricObservation" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "spotifyTrackId" TEXT,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "streams" INTEGER NOT NULL,
    "listeners" INTEGER,
    "saves" INTEGER,
    "playlistAdds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackMetricObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrackMetricObservation_metrics_check" CHECK ("streams" >= 0 AND ("listeners" IS NULL OR "listeners" >= 0) AND ("saves" IS NULL OR "saves" >= 0) AND ("playlistAdds" IS NULL OR "playlistAdds" >= 0))
);

CREATE TABLE "SongPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "exportedTitle" TEXT NOT NULL,
    "exportedReleaseDate" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "saves" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongPeriodSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SongPeriodSnapshot_period_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "SongPeriodSnapshot_metrics_check" CHECK ("listeners" >= 0 AND "streams" >= 0 AND "saves" >= 0)
);

CREATE TABLE "PlaylistPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "playlistTitle" TEXT NOT NULL,
    "playlistAuthor" TEXT NOT NULL,
    "playlistSpotifyId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "listeners" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "dateAdded" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistPeriodSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlaylistPeriodSnapshot_period_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "PlaylistPeriodSnapshot_metrics_check" CHECK ("listeners" >= 0 AND "streams" >= 0)
);

CREATE UNIQUE INDEX "AnalyticsImport_fileHash_key" ON "AnalyticsImport"("fileHash");
CREATE INDEX "AnalyticsImport_source_importType_idx" ON "AnalyticsImport"("source", "importType");
CREATE INDEX "AnalyticsImport_artistProfileId_importType_acceptedAt_idx" ON "AnalyticsImport"("artistProfileId", "importType", "acceptedAt");
CREATE INDEX "AnalyticsImport_status_acceptedAt_idx" ON "AnalyticsImport"("status", "acceptedAt");
CREATE INDEX "AnalyticsImport_uploadedById_idx" ON "AnalyticsImport"("uploadedById");
CREATE INDEX "AnalyticsImport_withdrawnById_idx" ON "AnalyticsImport"("withdrawnById");
CREATE INDEX "AnalyticsImport_replacedByImportId_idx" ON "AnalyticsImport"("replacedByImportId");
CREATE INDEX "AnalyticsImport_rawFileExpiresAt_idx" ON "AnalyticsImport"("rawFileExpiresAt");

CREATE INDEX "ArtistMetricObservation_artistProfileId_metricDate_idx" ON "ArtistMetricObservation"("artistProfileId", "metricDate");
CREATE UNIQUE INDEX "ArtistMetricObservation_importId_artistProfileId_metricDate_key" ON "ArtistMetricObservation"("importId", "artistProfileId", "metricDate");

CREATE INDEX "TrackMetricObservation_releaseId_metricDate_idx" ON "TrackMetricObservation"("releaseId", "metricDate");
CREATE INDEX "TrackMetricObservation_spotifyTrackId_metricDate_idx" ON "TrackMetricObservation"("spotifyTrackId", "metricDate");
CREATE UNIQUE INDEX "TrackMetricObservation_importId_releaseId_metricDate_key" ON "TrackMetricObservation"("importId", "releaseId", "metricDate");

CREATE INDEX "SongPeriodSnapshot_releaseId_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("releaseId", "periodStart", "periodEnd");
CREATE INDEX "SongPeriodSnapshot_periodStart_periodEnd_idx" ON "SongPeriodSnapshot"("periodStart", "periodEnd");
CREATE UNIQUE INDEX "SongPeriodSnapshot_importId_releaseId_periodStart_periodEnd_key" ON "SongPeriodSnapshot"("importId", "releaseId", "periodStart", "periodEnd");

CREATE INDEX "PlaylistPeriodSnapshot_playlistTitle_playlistAuthor_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("playlistTitle", "playlistAuthor", "periodStart", "periodEnd");
CREATE INDEX "PlaylistPeriodSnapshot_playlistSpotifyId_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("playlistSpotifyId", "periodStart", "periodEnd");
CREATE INDEX "PlaylistPeriodSnapshot_periodStart_periodEnd_idx" ON "PlaylistPeriodSnapshot"("periodStart", "periodEnd");
CREATE UNIQUE INDEX "PlaylistPeriodSnapshot_importId_playlistTitle_playlistAuthor_periodStart_periodEnd_key" ON "PlaylistPeriodSnapshot"("importId", "playlistTitle", "playlistAuthor", "periodStart", "periodEnd");

ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_replacedByImportId_fkey" FOREIGN KEY ("replacedByImportId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtistMetricObservation" ADD CONSTRAINT "ArtistMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtistMetricObservation" ADD CONSTRAINT "ArtistMetricObservation_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackMetricObservation" ADD CONSTRAINT "TrackMetricObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackMetricObservation" ADD CONSTRAINT "TrackMetricObservation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaylistPeriodSnapshot" ADD CONSTRAINT "PlaylistPeriodSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AnalyticsImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical artist creation is intentionally separated from schema application.
-- Stage 10 deployment package 04-canonical-artist.sql stops on slug/name ambiguity
-- before performing its idempotent private DRAFT insert.
