-- Reviewed PostgreSQL companion for Gate E0.6 after `prisma db push` creates the new columns and table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AdImportBatch" WHERE "parserVersion" = 'legacy-v1' AND "coreTimingEligible") THEN
    RAISE EXCEPTION 'Legacy aggregate batches unexpectedly became core-timing eligible';
  END IF;
END $$;

ALTER TABLE "AdImportBatch" DROP CONSTRAINT IF EXISTS "AdImportBatch_timezoneSource_check";
ALTER TABLE "AdImportBatch"
  ADD CONSTRAINT "AdImportBatch_timezoneSource_check" CHECK ("timezoneSource" IN ('META_SOURCE','USER_CONFIRMED','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_coreTimingEligibility_check" CHECK (NOT "coreTimingEligible" OR ("sourceGranularity" = 'DAILY' AND length(btrim("accountId")) > 0 AND length(btrim("normalizedTimezone")) > 0)),
  ADD CONSTRAINT "AdImportBatch_enrichmentCompatibility_check" CHECK ("enrichmentCompatibility" IN ('COMPATIBLE','COMPATIBLE_WITH_GAPS','DEGRADED','INCOMPATIBLE','NOT_PRESENT','NOT_EVALUATED')),
  ADD CONSTRAINT "AdImportBatch_commonCoverageDateCount_check" CHECK ("commonCoverageDateCount" >= 0);

ALTER TABLE "MetaImportFile"
  ADD CONSTRAINT "MetaImportFile_viewRole_check" CHECK ("viewRole" IN ('CORE_TIMING','VIDEO_ENRICHMENT','ENGAGEMENT_ENRICHMENT','REACH_ENRICHMENT','UNKNOWN')),
  ADD CONSTRAINT "MetaImportFile_coverageState_check" CHECK ("coverageState" IN ('COMPLETE','GAPPED','NO_DAILY_COVERAGE')),
  ADD CONSTRAINT "MetaImportFile_compatibilityState_check" CHECK ("compatibilityState" IN ('COMPATIBLE','COMPATIBLE_WITH_GAPS','DEGRADED','INCOMPATIBLE','NOT_PRESENT','NOT_EVALUATED')),
  ADD CONSTRAINT "MetaImportFile_coverageCounts_check" CHECK ("observedDateCount" >= 0 AND ("expectedDateCount" IS NULL OR "expectedDateCount" >= 0) AND "adCount" >= 0 AND "missingCoreDateCount" >= 0);

ALTER TABLE "MetaDailySourceObservation" DROP CONSTRAINT IF EXISTS "MetaDailySourceObservation_timezoneSource_check";
ALTER TABLE "MetaDailySourceObservation"
  ADD CONSTRAINT "MetaDailySourceObservation_timezoneSource_check" CHECK ("timezoneSource" IN ('META_SOURCE','USER_CONFIRMED'));

ALTER TABLE "MetaAccountTimezoneResolution"
  ADD CONSTRAINT "MetaAccountTimezoneResolution_sourceOrigin_check" CHECK ("sourceOrigin" IN ('META_SOURCE','USER_CONFIRMED')),
  ADD CONSTRAINT "MetaAccountTimezoneResolution_state_check" CHECK ("resolutionState" IN ('CURRENT','SUPERSEDED')),
  ADD CONSTRAINT "MetaAccountTimezoneResolution_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("ianaTimezone")) > 0);

ALTER TABLE "MetaAccountTimezoneResolution" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MetaAccountTimezoneResolution" FROM PUBLIC, anon, authenticated, service_role;

-- No browser-facing policy is created. Only trusted server-side Prisma may access the registry.
