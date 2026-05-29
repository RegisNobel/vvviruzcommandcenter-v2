ALTER TABLE "short_links" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "short_links" ADD COLUMN "archived_at" DATETIME;
ALTER TABLE "short_links" ADD COLUMN "paused_at" DATETIME;
ALTER TABLE "short_links" ADD COLUMN "destination_updated_at" DATETIME;

CREATE INDEX "short_links_status_idx" ON "short_links"("status");
