-- Add campaign handoff context to Short Links.
ALTER TABLE "short_links" ADD COLUMN "release_id" TEXT;
ALTER TABLE "short_links" ADD COLUMN "campaign_label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "short_links" ADD COLUMN "content_label" TEXT NOT NULL DEFAULT '';

CREATE INDEX "short_links_release_id_idx" ON "short_links"("release_id");

