CREATE TABLE "BreakingBarzEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "releaseId" TEXT,
    "releaseAnnotationId" TEXT,
    "songTitle" TEXT NOT NULL,
    "artistNames" TEXT NOT NULL DEFAULT '[]',
    "spotifyUrl" TEXT NOT NULL DEFAULT '',
    "appleMusicUrl" TEXT NOT NULL DEFAULT '',
    "youtubeUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentPublishedVersionId" TEXT,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BreakingBarzEntry_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BreakingBarzEntry_releaseAnnotationId_fkey" FOREIGN KEY ("releaseAnnotationId") REFERENCES "ReleaseAnnotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BreakingBarzEntry_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "BreakingBarzVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BreakingBarzVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "lyricExcerpt" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'interpretation',
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "editorialStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "BreakingBarzVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BreakingBarzEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BreakingBarzVersionSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BreakingBarzVersionSource_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BreakingBarzVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BreakingBarzCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BreakingBarzEntryCategory" (
    "entryId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    PRIMARY KEY ("entryId", "categoryId"),
    CONSTRAINT "BreakingBarzEntryCategory_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BreakingBarzEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BreakingBarzEntryCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BreakingBarzCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BreakingBarzSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songTitle" TEXT NOT NULL,
    "artistNames" TEXT NOT NULL DEFAULT '[]',
    "lyricExcerpt" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "breakdown" TEXT NOT NULL DEFAULT '',
    "songUrl" TEXT NOT NULL DEFAULT '',
    "submitterName" TEXT NOT NULL DEFAULT '',
    "submitterEmail" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "promotedEntryId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "BreakingBarzSubmission_promotedEntryId_fkey" FOREIGN KEY ("promotedEntryId") REFERENCES "BreakingBarzEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BreakingBarzEntry_slug_key" ON "BreakingBarzEntry"("slug");
CREATE UNIQUE INDEX "BreakingBarzEntry_releaseAnnotationId_key" ON "BreakingBarzEntry"("releaseAnnotationId");
CREATE UNIQUE INDEX "BreakingBarzEntry_currentPublishedVersionId_key" ON "BreakingBarzEntry"("currentPublishedVersionId");
CREATE INDEX "BreakingBarzEntry_status_publishedAt_id_idx" ON "BreakingBarzEntry"("status", "publishedAt", "id");
CREATE INDEX "BreakingBarzEntry_releaseId_status_publishedAt_idx" ON "BreakingBarzEntry"("releaseId", "status", "publishedAt");
CREATE INDEX "BreakingBarzEntry_songTitle_status_idx" ON "BreakingBarzEntry"("songTitle", "status");
CREATE UNIQUE INDEX "BreakingBarzVersion_entryId_version_key" ON "BreakingBarzVersion"("entryId", "version");
CREATE INDEX "BreakingBarzVersion_entryId_editorialStatus_createdAt_idx" ON "BreakingBarzVersion"("entryId", "editorialStatus", "createdAt");
CREATE INDEX "BreakingBarzVersion_publishedAt_idx" ON "BreakingBarzVersion"("publishedAt");
CREATE INDEX "BreakingBarzVersionSource_versionId_sortOrder_idx" ON "BreakingBarzVersionSource"("versionId", "sortOrder");
CREATE UNIQUE INDEX "BreakingBarzCategory_slug_key" ON "BreakingBarzCategory"("slug");
CREATE INDEX "BreakingBarzCategory_isActive_sortOrder_name_idx" ON "BreakingBarzCategory"("isActive", "sortOrder", "name");
CREATE INDEX "BreakingBarzEntryCategory_categoryId_entryId_idx" ON "BreakingBarzEntryCategory"("categoryId", "entryId");
CREATE INDEX "BreakingBarzSubmission_status_submittedAt_idx" ON "BreakingBarzSubmission"("status", "submittedAt");
CREATE INDEX "BreakingBarzSubmission_promotedEntryId_idx" ON "BreakingBarzSubmission"("promotedEntryId");

INSERT INTO "BreakingBarzCategory" ("id", "name", "slug", "description", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
('bb-category-punchline', 'Punchline', 'punchline', '', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-metaphor', 'Metaphor', 'metaphor', '', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-double-meaning', 'Double Meaning', 'double-meaning', '', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-lore-reference', 'Lore Reference', 'lore-reference', '', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-wordplay', 'Wordplay', 'wordplay', '', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-anime-reference', 'Anime Reference', 'anime-reference', '', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-gaming-reference', 'Gaming Reference', 'gaming-reference', '', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-storytelling', 'Storytelling', 'storytelling', '', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bb-category-other', 'Other', 'other', '', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
