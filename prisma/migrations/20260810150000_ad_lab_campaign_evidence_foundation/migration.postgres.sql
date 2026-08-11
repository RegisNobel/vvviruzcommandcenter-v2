-- Reviewed PostgreSQL post-`prisma db push` companion.
-- This file intentionally does not establish a second Prisma migration history.
-- Run only after a reviewed db-push diff creates the schema represented by
-- prisma/schema.postgres.prisma.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AdImportBatch" WHERE "sourceGranularity" <> 'AGGREGATE_SNAPSHOT' AND "parserVersion" = 'legacy-v1') THEN
    RAISE EXCEPTION 'Legacy AdImportBatch classification is not conservative';
  END IF;
  IF EXISTS (SELECT 1 FROM "AdImportBatch" WHERE "parserVersion" = 'legacy-v1' AND "campaignIntervalEligible") THEN
    RAISE EXCEPTION 'Legacy AdImportBatch unexpectedly became interval eligible';
  END IF;
END $$;

ALTER TABLE "AdImportBatch"
  ADD CONSTRAINT "AdImportBatch_sourceGranularity_check" CHECK ("sourceGranularity" IN ('DAILY','AGGREGATE_SNAPSHOT')),
  ADD CONSTRAINT "AdImportBatch_importState_check" CHECK ("importState" IN ('ACCEPTED','WITHDRAWN','REPLACED')),
  ADD CONSTRAINT "AdImportBatch_timezoneSource_check" CHECK ("timezoneSource" IN ('SOURCE','MANUAL_REVIEWED','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_sourceAsOfOrigin_check" CHECK ("sourceAsOfOrigin" IN ('META_EXPORT','USER_CONFIRMED','IMPORT_ACCEPTED_FALLBACK','UNKNOWN')),
  ADD CONSTRAINT "AdImportBatch_interval_eligibility_check" CHECK (NOT "campaignIntervalEligible" OR ("sourceGranularity" = 'DAILY' AND length(btrim("accountId")) > 0 AND length(btrim("normalizedTimezone")) > 0));

ALTER TABLE "MetaImportFile"
  ADD CONSTRAINT "MetaImportFile_sha256_check" CHECK (length("sha256") = 64),
  ADD CONSTRAINT "MetaImportFile_rawSha256_check" CHECK ("rawStorageSha256" IS NULL OR length("rawStorageSha256") = 64),
  ADD CONSTRAINT "MetaImportFile_size_check" CHECK ("rowCount" >= 0 AND ("rawSizeBytes" IS NULL OR "rawSizeBytes" >= 0));

ALTER TABLE "MetaImportFileRow"
  ADD CONSTRAINT "MetaImportFileRow_number_check" CHECK ("sourceRowNumber" >= 2),
  ADD CONSTRAINT "MetaImportFileRow_view_check" CHECK ("sourceView" IN ('delivery','engagement','video','reach','unknown'));

ALTER TABLE "MetaDailySourceObservation"
  ADD CONSTRAINT "MetaDailySourceObservation_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("campaignId")) > 0 AND length(btrim("adSetId")) > 0 AND length(btrim("adId")) > 0),
  ADD CONSTRAINT "MetaDailySourceObservation_timezoneSource_check" CHECK ("timezoneSource" IN ('SOURCE','MANUAL_REVIEWED')),
  ADD CONSTRAINT "MetaDailySourceObservation_metricFamily_check" CHECK ("metricFamily" IN ('SPEND','ATTRIBUTION_RESULT')),
  ADD CONSTRAINT "MetaDailySourceObservation_sourceAsOfOrigin_check" CHECK ("sourceAsOfOrigin" IN ('META_EXPORT','USER_CONFIRMED','IMPORT_ACCEPTED_FALLBACK','UNKNOWN')),
  ADD CONSTRAINT "MetaDailySourceObservation_metric_check" CHECK (("spend" IS NULL OR "spend" >= 0) AND ("impressions" IS NULL OR "impressions" >= 0) AND ("reach" IS NULL OR "reach" >= 0));

ALTER TABLE "MetaDailyResolution"
  ADD CONSTRAINT "MetaDailyResolution_version_check" CHECK ("resolutionVersion" >= 1),
  ADD CONSTRAINT "MetaDailyResolution_metricFamily_check" CHECK ("metricFamily" IN ('SPEND','ATTRIBUTION_RESULT'));

ALTER TABLE "CampaignEvidence"
  ADD CONSTRAINT "CampaignEvidence_suggestionState_check" CHECK ("suggestionState" IN ('LEGACY','CURRENT','SUPERSEDED')),
  ADD CONSTRAINT "CampaignEvidence_generationVersion_check" CHECK ("generationVersion" >= 1);

ALTER TABLE "MetaPromotionLink"
  ADD CONSTRAINT "MetaPromotionLink_status_check" CHECK ("status" IN ('SUGGESTED','CONFIRMED','REJECTED','REVOKED')),
  ADD CONSTRAINT "MetaPromotionLink_scopeType_check" CHECK ("scopeType" IN ('CAMPAIGN','AD_SET','AD')),
  ADD CONSTRAINT "MetaPromotionLink_associationMode_check" CHECK ("associationMode" IN ('EXCLUSIVE','SHARED_EXTERNAL_CAMPAIGN','SHARED_EXTERNAL_SCOPE')),
  ADD CONSTRAINT "MetaPromotionLink_monetaryAttribution_check" CHECK ("monetaryAttribution" IN ('UNALLOCATED','EXTERNAL_SCOPE_ONLY','UNALLOCATED_SHARED')),
  ADD CONSTRAINT "MetaPromotionLink_identity_check" CHECK (length(btrim("accountId")) > 0 AND length(btrim("externalCampaignId")) > 0 AND length(btrim("scopeIdentityKey")) > 0 AND (("scopeType" = 'CAMPAIGN' AND "externalAdSetId" = '' AND "externalAdId" = '') OR ("scopeType" = 'AD_SET' AND length(btrim("externalAdSetId")) > 0 AND "externalAdId" = '') OR ("scopeType" = 'AD' AND length(btrim("externalAdSetId")) > 0 AND length(btrim("externalAdId")) > 0)));

ALTER TABLE "MetaImportFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaImportFileRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailySourceObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailyResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaDailyResolutionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaImportAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaPromotionLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaPromotionLinkAuditEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "MetaImportFile" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaImportFileRow" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailySourceObservation" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailyResolution" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaDailyResolutionEvent" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaImportAuditEvent" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaPromotionLink" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE "MetaPromotionLinkAuditEvent" FROM PUBLIC, anon, authenticated, service_role;

-- No browser-facing RLS policies are created. Trusted server-side Prisma retains
-- access through the database owner connection only.
