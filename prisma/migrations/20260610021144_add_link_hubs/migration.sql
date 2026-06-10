-- CreateTable
CREATE TABLE "LinkHub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "releaseId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showInPublicNav" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkHub_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "hubPath" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_AnalyticsEvent" ("country", "createdAt", "eventType", "id", "linkLabel", "linkType", "page", "path", "referrer", "releaseId", "sessionId", "targetUrl", "userAgent", "utmCampaign", "utmContent", "utmMedium", "utmSource", "utmTerm", "visitorId") SELECT "country", "createdAt", "eventType", "id", "linkLabel", "linkType", "page", "path", "referrer", "releaseId", "sessionId", "targetUrl", "userAgent", "utmCampaign", "utmContent", "utmMedium", "utmSource", "utmTerm", "visitorId" FROM "AnalyticsEvent";
DROP TABLE "AnalyticsEvent";
ALTER TABLE "new_AnalyticsEvent" RENAME TO "AnalyticsEvent";
CREATE INDEX "AnalyticsEvent_page_createdAt_idx" ON "AnalyticsEvent"("page", "createdAt");
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_releaseId_createdAt_idx" ON "AnalyticsEvent"("releaseId", "createdAt");
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LinkHub_path_key" ON "LinkHub"("path");

-- CreateIndex
CREATE INDEX "LinkHub_releaseId_idx" ON "LinkHub"("releaseId");
