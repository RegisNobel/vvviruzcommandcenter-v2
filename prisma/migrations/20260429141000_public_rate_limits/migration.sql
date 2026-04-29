CREATE TABLE "PublicRateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" DATETIME NOT NULL,
  "blockedUntil" DATETIME,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PublicRateLimit_bucket_key_key" ON "PublicRateLimit"("bucket", "key");
CREATE INDEX "PublicRateLimit_bucket_updatedAt_idx" ON "PublicRateLimit"("bucket", "updatedAt");
CREATE INDEX "PublicRateLimit_blockedUntil_idx" ON "PublicRateLimit"("blockedUntil");
