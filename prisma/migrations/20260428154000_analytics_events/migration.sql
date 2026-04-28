CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "path" TEXT NOT NULL DEFAULT '',
  "releaseId" TEXT,
  "linkType" TEXT NOT NULL DEFAULT '',
  "linkLabel" TEXT NOT NULL DEFAULT '',
  "targetUrl" TEXT NOT NULL DEFAULT '',
  "referrer" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT NOT NULL DEFAULT '',
  "visitorId" TEXT NOT NULL DEFAULT '',
  "sessionId" TEXT NOT NULL DEFAULT '',
  "utmSource" TEXT NOT NULL DEFAULT '',
  "utmMedium" TEXT NOT NULL DEFAULT '',
  "utmCampaign" TEXT NOT NULL DEFAULT '',
  "utmContent" TEXT NOT NULL DEFAULT '',
  "utmTerm" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL
);

CREATE INDEX "AnalyticsEvent_page_createdAt_idx" ON "AnalyticsEvent"("page", "createdAt");
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_releaseId_createdAt_idx" ON "AnalyticsEvent"("releaseId", "createdAt");
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
