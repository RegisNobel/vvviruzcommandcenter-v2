-- Forward-only cleanup for local SQLite databases that applied the original,
-- never-deployed campaign-only link model before Gate E0.8 generalized it.
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS "MetaCampaignLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "promotionCampaignId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "externalCampaignId" TEXT NOT NULL,
  "currentDisplayName" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
  "associationMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "reason" TEXT NOT NULL DEFAULT '',
  "actorId" TEXT,
  "actorUsername" TEXT NOT NULL DEFAULT '',
  "supersedesLinkId" TEXT,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "MetaCampaignLinkAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "linkId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "previousValues" TEXT NOT NULL DEFAULT '{}',
  "newValues" TEXT NOT NULL DEFAULT '{}',
  "actorId" TEXT,
  "actorUsername" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "MetaPromotionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "promotionCampaignId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL DEFAULT 'CAMPAIGN',
  "externalCampaignId" TEXT NOT NULL,
  "externalAdSetId" TEXT NOT NULL DEFAULT '',
  "externalAdId" TEXT NOT NULL DEFAULT '',
  "scopeIdentityKey" TEXT NOT NULL,
  "currentDisplayName" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
  "associationMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  "monetaryAttribution" TEXT NOT NULL DEFAULT 'UNALLOCATED',
  "ambiguous" BOOLEAN NOT NULL DEFAULT false,
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "reason" TEXT NOT NULL DEFAULT '',
  "actorId" TEXT,
  "actorUsername" TEXT NOT NULL DEFAULT '',
  "supersedesLinkId" TEXT,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MetaPromotionLink_promotionCampaignId_fkey" FOREIGN KEY ("promotionCampaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_supersedesLinkId_fkey" FOREIGN KEY ("supersedesLinkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLink_status_check" CHECK ("status" IN ('SUGGESTED','CONFIRMED','REJECTED','REVOKED')),
  CONSTRAINT "MetaPromotionLink_scopeType_check" CHECK ("scopeType" IN ('CAMPAIGN','AD_SET','AD'))
);

INSERT OR IGNORE INTO "MetaPromotionLink" (
  "id", "promotionCampaignId", "accountId", "scopeType", "externalCampaignId",
  "externalAdSetId", "externalAdId", "scopeIdentityKey", "currentDisplayName",
  "status", "associationMode", "monetaryAttribution", "ambiguous", "evidence",
  "reason", "actorId", "actorUsername", "supersedesLinkId", "createdAt", "updatedAt"
)
SELECT
  "id", "promotionCampaignId", "accountId", 'CAMPAIGN', "externalCampaignId",
  '', '', json_array("accountId", "externalCampaignId"), "currentDisplayName",
  "status", "associationMode",
  CASE WHEN "associationMode" = 'SHARED_EXTERNAL_CAMPAIGN' THEN 'UNALLOCATED_SHARED' WHEN "status" = 'CONFIRMED' THEN 'EXTERNAL_SCOPE_ONLY' ELSE 'UNALLOCATED' END,
  CASE WHEN "associationMode" = 'SHARED_EXTERNAL_CAMPAIGN' THEN true ELSE false END,
  "evidence", "reason", "actorId", "actorUsername", "supersedesLinkId", "createdAt", "updatedAt"
FROM "MetaCampaignLink";

CREATE TABLE IF NOT EXISTS "MetaPromotionLinkAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "linkId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "previousValues" TEXT NOT NULL DEFAULT '{}',
  "newValues" TEXT NOT NULL DEFAULT '{}',
  "actorId" TEXT,
  "actorUsername" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaPromotionLinkAuditEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MetaPromotionLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MetaPromotionLinkAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT OR IGNORE INTO "MetaPromotionLinkAuditEvent" ("id", "linkId", "action", "reason", "previousValues", "newValues", "actorId", "actorUsername", "createdAt")
SELECT "id", "linkId", "action", "reason", "previousValues", "newValues", "actorId", "actorUsername", "createdAt"
FROM "MetaCampaignLinkAuditEvent";

DROP TABLE "MetaCampaignLinkAuditEvent";
DROP TABLE "MetaCampaignLink";

CREATE UNIQUE INDEX IF NOT EXISTS "MetaPromotionLink_supersedesLinkId_key" ON "MetaPromotionLink"("supersedesLinkId");
CREATE INDEX IF NOT EXISTS "MetaPromotionLink_scopeIdentityKey_status_idx" ON "MetaPromotionLink"("scopeIdentityKey", "status");
CREATE INDEX IF NOT EXISTS "MetaPromotionLink_accountId_externalCampaignId_scopeType_status_idx" ON "MetaPromotionLink"("accountId", "externalCampaignId", "scopeType", "status");
CREATE INDEX IF NOT EXISTS "MetaPromotionLink_accountId_externalCampaignId_externalAdSetId_externalAdId_idx" ON "MetaPromotionLink"("accountId", "externalCampaignId", "externalAdSetId", "externalAdId");
CREATE INDEX IF NOT EXISTS "MetaPromotionLink_promotionCampaignId_status_idx" ON "MetaPromotionLink"("promotionCampaignId", "status");
CREATE INDEX IF NOT EXISTS "MetaPromotionLink_status_createdAt_idx" ON "MetaPromotionLink"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MetaPromotionLinkAuditEvent_linkId_createdAt_idx" ON "MetaPromotionLinkAuditEvent"("linkId", "createdAt");
CREATE INDEX IF NOT EXISTS "MetaPromotionLinkAuditEvent_actorId_idx" ON "MetaPromotionLinkAuditEvent"("actorId");

PRAGMA foreign_keys=ON;
