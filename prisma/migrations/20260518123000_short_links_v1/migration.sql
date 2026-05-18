-- CreateTable
CREATE TABLE "short_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "short_links_slug_key" ON "short_links"("slug");

-- CreateIndex
CREATE INDEX "short_links_created_at_idx" ON "short_links"("created_at");

-- CreateIndex
CREATE INDEX "short_links_deleted_at_idx" ON "short_links"("deleted_at");
