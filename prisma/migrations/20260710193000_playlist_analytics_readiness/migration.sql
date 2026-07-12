ALTER TABLE "AnalyticsEvent" ADD COLUMN "eventId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "playlistId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "playlistSlug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "shortLinkId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "platform" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "originalReferrer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "fbclid" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "AnalyticsEvent_eventId_eventType_key"
  ON "AnalyticsEvent"("eventId", "eventType");
CREATE INDEX "AnalyticsEvent_playlistId_eventType_createdAt_idx"
  ON "AnalyticsEvent"("playlistId", "eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_playlistId_releaseId_createdAt_idx"
  ON "AnalyticsEvent"("playlistId", "releaseId", "createdAt");
CREATE INDEX "AnalyticsEvent_shortLinkId_createdAt_idx"
  ON "AnalyticsEvent"("shortLinkId", "createdAt");
