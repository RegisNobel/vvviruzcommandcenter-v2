CREATE TABLE "ReleaseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReleaseCategoryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReleaseCategoryAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ReleaseCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReleaseCategoryAssignment_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReleaseCategory_slug_key" ON "ReleaseCategory"("slug");
CREATE INDEX "ReleaseCategory_sortOrder_name_idx" ON "ReleaseCategory"("sortOrder", "name");
CREATE UNIQUE INDEX "ReleaseCategoryAssignment_categoryId_releaseId_key" ON "ReleaseCategoryAssignment"("categoryId", "releaseId");
CREATE INDEX "ReleaseCategoryAssignment_releaseId_idx" ON "ReleaseCategoryAssignment"("releaseId");
CREATE INDEX "ReleaseCategoryAssignment_categoryId_sortOrder_idx" ON "ReleaseCategoryAssignment"("categoryId", "sortOrder");
