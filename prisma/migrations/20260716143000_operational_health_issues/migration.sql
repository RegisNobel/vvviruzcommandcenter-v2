CREATE TABLE "OperationalHealthIssue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checkKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionPath" TEXT NOT NULL DEFAULT '',
  "entityType" TEXT NOT NULL DEFAULT '',
  "entityId" TEXT NOT NULL DEFAULT '',
  "detectedAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "OperationalHealthIssue_checkKey_key"
  ON "OperationalHealthIssue"("checkKey");
CREATE INDEX "OperationalHealthIssue_severity_updatedAt_idx"
  ON "OperationalHealthIssue"("severity", "updatedAt");
CREATE INDEX "OperationalHealthIssue_category_updatedAt_idx"
  ON "OperationalHealthIssue"("category", "updatedAt");
