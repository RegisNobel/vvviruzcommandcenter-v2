ALTER TABLE "AdImportBatch" ADD COLUMN "coreTimingEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdImportBatch" ADD COLUMN "coreTimingEligibilityReason" TEXT NOT NULL DEFAULT 'LEGACY_AGGREGATE_SNAPSHOT';
ALTER TABLE "AdImportBatch" ADD COLUMN "enrichmentCompatibility" TEXT NOT NULL DEFAULT 'NOT_EVALUATED';
ALTER TABLE "AdImportBatch" ADD COLUMN "enrichmentWarnings" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AdImportBatch" ADD COLUMN "coreTimingStart" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "coreTimingEnd" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "commonCoverageStart" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "commonCoverageEnd" DATETIME;
ALTER TABLE "AdImportBatch" ADD COLUMN "commonCoverageDateCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "AdImportBatch_coreTimingEligible_importState_acceptedAt_idx" ON "AdImportBatch"("coreTimingEligible", "importState", "acceptedAt");

ALTER TABLE "MetaImportFile" ADD COLUMN "viewRole" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "MetaImportFile" ADD COLUMN "reportingStart" DATETIME;
ALTER TABLE "MetaImportFile" ADD COLUMN "reportingEnd" DATETIME;
ALTER TABLE "MetaImportFile" ADD COLUMN "observedDateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MetaImportFile" ADD COLUMN "expectedDateCount" INTEGER;
ALTER TABLE "MetaImportFile" ADD COLUMN "adCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MetaImportFile" ADD COLUMN "missingCoreDateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MetaImportFile" ADD COLUMN "coverageState" TEXT NOT NULL DEFAULT 'NO_DAILY_COVERAGE';
ALTER TABLE "MetaImportFile" ADD COLUMN "compatibilityState" TEXT NOT NULL DEFAULT 'NOT_EVALUATED';
ALTER TABLE "MetaImportFile" ADD COLUMN "compatibilityWarnings" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "MetaAccountTimezoneResolution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "ianaTimezone" TEXT NOT NULL,
  "sourceOrigin" TEXT NOT NULL,
  "resolutionState" TEXT NOT NULL DEFAULT 'CURRENT',
  "supersedesResolutionId" TEXT,
  "confirmedAt" DATETIME NOT NULL,
  "confirmedById" TEXT,
  "confirmedByUsername" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "MetaAccountTimezoneResolution_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MetaAccountTimezoneResolution_supersedesResolutionId_fkey" FOREIGN KEY ("supersedesResolutionId") REFERENCES "MetaAccountTimezoneResolution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MetaAccountTimezoneResolution_supersedesResolutionId_key" ON "MetaAccountTimezoneResolution"("supersedesResolutionId");
CREATE INDEX "MetaAccountTimezoneResolution_accountId_resolutionState_idx" ON "MetaAccountTimezoneResolution"("accountId", "resolutionState");
CREATE INDEX "MetaAccountTimezoneResolution_confirmedById_idx" ON "MetaAccountTimezoneResolution"("confirmedById");
