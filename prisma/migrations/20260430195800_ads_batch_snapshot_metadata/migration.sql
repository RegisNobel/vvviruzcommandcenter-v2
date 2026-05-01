-- Add snapshot-aware batch metadata for rolling Meta exports.
ALTER TABLE "AdImportBatch" ADD COLUMN "exportedAt" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "attributionSetting" TEXT NOT NULL DEFAULT '7-day click, 1-day view, 1-day engagement';
ALTER TABLE "AdImportBatch" ADD COLUMN "batchType" TEXT NOT NULL DEFAULT 'Rolling Snapshot';

CREATE INDEX "AdImportBatch_exportedAt_idx" ON "AdImportBatch"("exportedAt");
CREATE INDEX "AdImportBatch_batchType_idx" ON "AdImportBatch"("batchType");
