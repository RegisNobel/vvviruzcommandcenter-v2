-- Reviewed PostgreSQL companion for Stage 3 commit idempotency.
-- The separate physical removal of AppearsOnArtistCredit.artistLinkId remains
-- outside this companion and must be reviewed independently during db push.
ALTER TABLE "AnalyticsImport" ADD COLUMN "commitIdempotencyKey" TEXT;
CREATE UNIQUE INDEX "AnalyticsImport_commitIdempotencyKey_key"
ON "AnalyticsImport"("commitIdempotencyKey");
