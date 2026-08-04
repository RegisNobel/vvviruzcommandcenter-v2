-- AddColumn
ALTER TABLE "AnalyticsImport" ADD COLUMN "commitIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsImport_commitIdempotencyKey_key" ON "AnalyticsImport"("commitIdempotencyKey");
