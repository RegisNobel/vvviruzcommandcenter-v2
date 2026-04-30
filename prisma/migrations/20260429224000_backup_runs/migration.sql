CREATE TABLE "BackupRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "destination" TEXT NOT NULL DEFAULT '',
  "blobPath" TEXT NOT NULL DEFAULT '',
  "googleDriveFileId" TEXT,
  "googleDriveFolderId" TEXT,
  "sizeBytes" INTEGER,
  "checksumSha256" TEXT,
  "recordCounts" TEXT NOT NULL DEFAULT '{}',
  "errorMessage" TEXT,
  "startedAt" DATETIME NOT NULL,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL
);

CREATE INDEX "BackupRun_type_startedAt_idx" ON "BackupRun"("type", "startedAt");
CREATE INDEX "BackupRun_status_startedAt_idx" ON "BackupRun"("status", "startedAt");
