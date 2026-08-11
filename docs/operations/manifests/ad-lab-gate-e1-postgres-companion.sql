-- Gate E1 cumulative PostgreSQL companion for the Ad Lab Campaign Evidence Foundation.
-- Reviewed against production on 2026-08-10. Run only after the separately reviewed
-- additive `prisma db push` and only under an explicitly approved Gate E1.
-- This consolidates the three development companions into their final state so the
-- production execution contains no intermediate constraint drop/replacement.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AdImportBatch"
    WHERE "parserVersion" = 'legacy-v1'
      AND (
        "sourceGranularity" <> 'AGGREGATE_SNAPSHOT'
        OR "campaignIntervalEligible"
        OR "coreTimingEligible"
      )
  ) THEN
    RAISE EXCEPTION 'Legacy AdImportBatch classification is not conservative';
  END IF;
END $$;

ALTER TABLE "AdImportBatch"
  ADD CONSTRAINT "AdImportBatch_sourceGranularity_check" CHECK ("sourceGranularity" IN ('DAILY','AGGREGATE_SNAPSHOT')),
  ADD CONSTRAINT "AdImportBatch_importState_check" CHECK ("importState" IN ('ACCEPTED','WITHDRAWN','REPLACED')),
  ADD CONSTRAINT "AdImportBatch_timezoneSource_check" CHECK ("timezoneSource" IN ('META_SOURCE','USER_CONFIRMED','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_sourceAsOfOrigin_check" CHECK ("sourceAsOfOrigin" IN ('META_EXPORT','USER_CONFIRMED','IMPORT_ACCEPTED_FALLBACK','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_interval_eligibility_check" CHECK (NOT "campaignIntervalEligible" OR ("sourceGranularity" = 'DAILY' AND length(btrim("accountId")) > 0 AND length(btrim("normalizedTimezone")) > 0)),
  ADD CONSTRAINT "AdImportBatch_coreTimingEligibility_check" CHECK (NOT "coreTimingEligible" OR ("sourceGranularity" = 'DAILY' AND length(btrim("accountId")) > 0 AND length(btrim("normalizedTimezone")) > 0)),
  ADD CONSTRAINT "AdImportBatch_enrichmentCompatibility_check" CHECK ("enrichmentCompatibility" IN ('COMPATIBLE','COMPATIBLE_WITH_GAPS','DEGRADED','INCOMPATIBLE','NOT_PRESENT','NOT_EVALUATED')),
  ADD CONSTRAINT "AdImportBatch_commonCoverageDateCount_check" CHECK ("commonCoverageDateCount" >= 0);

ALTER TABLE "MetaImportFile"
  ADD CONSTRAINT "MetaImportFile_sha256_check" CHECK (length("sha256") = 64),
  ADD CONSTRAINT "MetaImportFile_rawSha256_check" CHECK ("rawStorageSha256" IS NULL OR length("rawStorageSha256") = 64),
  ADD CONSTRAINT "MetaImportFile_size_check" CHECK ("rowCount" >= 0 AND ("rawSizeBytes" IS NULL OR "rawSizeBytes" >= 0)),
  ADD CONSTRAINT "MetaImportFile_viewRole_check" CHECK ("viewRole" IN ('CORE_TIMING','VIDEO_ENRICHMENT','ENGAGEMENT_ENRICHMENT','REACH_ENRICHMENT','UNKNOWN')),
  ADD CONSTRAINT "MetaImportFile_coverageState_check" CHECK ("coverageState" IN ('COMPLETE','GAPPED','NO_DAILY_COVERAGE')),
  ADD CONSTRAINT "MetaImportFile_compatibilityState_check" CHECK ("compatibilityState" IN ('COMPATIBLE','COMPATIBLE_WITH_GAPS','DEGRADED','INCOMPATIBLE','NOT_PRESENT','NOT_EVALUATED')),
  ADD CONSTRAINT "MetaImportFile_coverageCounts_check" CHECK ("observedDateCount" >= 0 AND ("expectedDateCount" IS NULL OR "expectedDateCount" >= 0) AND "adCount" >= 0 AND "missingCoreDateCount" >= 0);

ALTER TABLE "MetaImportFileRow"
  ADD CONSTRAINT "MetaImportFileRow_number_check" CHECK ("sourceRowNumber" >= 2),
  ADD CONSTRAINT "MetaImportFileRow_view_check" CHECK ("sourceView" IN ('delivery','engagement','video','reach','unknown'));

ALTER TABLE "MetaDailySourceObservation"
  ADD CONSTRAINT "MetaDailySourceObservation_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("campaignId")) > 0 AND length(btrim("adSetId")) > 0 AND length(btrim("adId")) > 0),
  ADD CONSTRAINT "MetaDailySourceObservation_timezoneSource_check" CHECK ("timezoneSource" IN ('META_SOURCE','USER_CONFIRMED')),
  ADD CONSTRAINT "MetaDailySourceObservation_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN')),
  ADD CONSTRAINT "MetaDailySourceObservation_metricFamily_check" CHECK ("metricFamily" IN ('SPEND','ATTRIBUTION_RESULT')),
  ADD CONSTRAINT "MetaDailySourceObservation_sourceAsOfOrigin_check" CHECK ("sourceAsOfOrigin" IN ('META_EXPORT','USER_CONFIRMED','IMPORT_ACCEPTED_FALLBACK','UNKNOWN')),
  ADD CONSTRAINT "MetaDailySourceObservation_metric_check" CHECK (("spend" IS NULL OR "spend" >= 0) AND ("impressions" IS NULL OR "impressions" >= 0) AND ("reach" IS NULL OR "reach" >= 0));

ALTER TABLE "MetaDailyResolution"
  ADD CONSTRAINT "MetaDailyResolution_version_check" CHECK ("resolutionVersion" >= 1),
  ADD CONSTRAINT "MetaDailyResolution_metricFamily_check" CHECK ("metricFamily" IN ('SPEND','ATTRIBUTION_RESULT')),
  ADD CONSTRAINT "MetaDailyResolution_currencyOrigin_check" CHECK ("currencyOrigin" IN ('SOURCE_COLUMN','METRIC_HEADER','USER_CONFIRMED','UNKNOWN'));

ALTER TABLE "CampaignEvidence"
  ADD CONSTRAINT "CampaignEvidence_suggestionState_check" CHECK ("suggestionState" IN ('LEGACY','CURRENT','SUPERSEDED')),
  ADD CONSTRAINT "CampaignEvidence_generationVersion_check" CHECK ("generationVersion" >= 1);

ALTER TABLE "MetaPromotionLink"
  ADD CONSTRAINT "MetaPromotionLink_status_check" CHECK ("status" IN ('SUGGESTED','CONFIRMED','REJECTED','REVOKED')),
  ADD CONSTRAINT "MetaPromotionLink_scopeType_check" CHECK ("scopeType" IN ('CAMPAIGN','AD_SET','AD')),
  ADD CONSTRAINT "MetaPromotionLink_associationMode_check" CHECK ("associationMode" IN ('EXCLUSIVE','SHARED_EXTERNAL_CAMPAIGN','SHARED_EXTERNAL_SCOPE')),
  ADD CONSTRAINT "MetaPromotionLink_monetaryAttribution_check" CHECK ("monetaryAttribution" IN ('UNALLOCATED','EXTERNAL_SCOPE_ONLY','UNALLOCATED_SHARED')),
  ADD CONSTRAINT "MetaPromotionLink_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("externalCampaignId")) > 0 AND length(btrim("scopeIdentityKey")) > 0 AND (("scopeType" = 'CAMPAIGN' AND "externalAdSetId" = '' AND "externalAdId" = '') OR ("scopeType" = 'AD_SET' AND length(btrim("externalAdSetId")) > 0 AND "externalAdId" = '') OR ("scopeType" = 'AD' AND length(btrim("externalAdSetId")) > 0 AND length(btrim("externalAdId")) > 0)));

ALTER TABLE "MetaAccountTimezoneResolution"
  ADD CONSTRAINT "MetaAccountTimezoneResolution_sourceOrigin_check" CHECK ("sourceOrigin" IN ('META_SOURCE','USER_CONFIRMED')),
  ADD CONSTRAINT "MetaAccountTimezoneResolution_state_check" CHECK ("resolutionState" IN ('CURRENT','SUPERSEDED')),
  ADD CONSTRAINT "MetaAccountTimezoneResolution_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("ianaTimezone")) > 0);

ALTER TABLE "MetaImportFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaImportFileRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailySourceObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailyResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailyResolutionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaImportAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaPromotionLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaPromotionLinkAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaAccountTimezoneResolution" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "MetaImportFile" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaImportFileRow" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailySourceObservation" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailyResolution" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailyResolutionEvent" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaImportAuditEvent" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaPromotionLink" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaPromotionLinkAuditEvent" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaAccountTimezoneResolution" FROM PUBLIC, anon, authenticated, service_role;

-- No browser-facing RLS policies are created. Trusted server-side Prisma retains
-- access through the database-owner connection only.
