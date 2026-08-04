-- Run only after the reviewed Prisma db push. Idempotent by constraint name.
DO $stage10$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_status_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_status_check" CHECK ("status" IN ('PENDING','PREVIEWED','IMPORTED','FAILED','WITHDRAWN','REPLACED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_fileHash_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_fileHash_check" CHECK (length("fileHash")=64); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_counts_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_counts_check" CHECK ("rowCount">=0 AND "acceptedRowCount">=0 AND "rejectedRowCount">=0 AND "unmatchedRowCount">=0 AND "warningCount">=0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_normalizationVersion_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_normalizationVersion_check" CHECK ("normalizationVersion">0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_rawFileSizeBytes_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_rawFileSizeBytes_check" CHECK ("rawFileSizeBytes" IS NULL OR "rawFileSizeBytes">=0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_detectedPeriod_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_detectedPeriod_check" CHECK ("detectedPeriodStart" IS NULL OR "detectedPeriodEnd" IS NULL OR "detectedPeriodEnd">="detectedPeriodStart"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='AnalyticsImport_confirmedPeriod_check') THEN ALTER TABLE "AnalyticsImport" ADD CONSTRAINT "AnalyticsImport_confirmedPeriod_check" CHECK ("userConfirmedPeriodStart" IS NULL OR "userConfirmedPeriodEnd" IS NULL OR "userConfirmedPeriodEnd">="userConfirmedPeriodStart"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ArtistMetricObservation_metrics_check') THEN ALTER TABLE "ArtistMetricObservation" ADD CONSTRAINT "ArtistMetricObservation_metrics_check" CHECK ("listeners">=0 AND "monthlyListeners">=0 AND "monthlyActiveListeners">=0 AND "streams">=0 AND "playlistAdds">=0 AND "saves">=0 AND "followers">=0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TrackMetricObservation_metrics_check') THEN ALTER TABLE "TrackMetricObservation" ADD CONSTRAINT "TrackMetricObservation_metrics_check" CHECK ("streams">=0 AND ("listeners" IS NULL OR "listeners">=0) AND ("saves" IS NULL OR "saves">=0) AND ("playlistAdds" IS NULL OR "playlistAdds">=0)); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SongPeriodSnapshot_period_check') THEN ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_period_check" CHECK ("periodEnd">="periodStart"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SongPeriodSnapshot_metrics_check') THEN ALTER TABLE "SongPeriodSnapshot" ADD CONSTRAINT "SongPeriodSnapshot_metrics_check" CHECK ("listeners">=0 AND "streams">=0 AND "saves">=0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PlaylistPeriodSnapshot_period_check') THEN ALTER TABLE "PlaylistPeriodSnapshot" ADD CONSTRAINT "PlaylistPeriodSnapshot_period_check" CHECK ("periodEnd">="periodStart"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PlaylistPeriodSnapshot_metrics_check') THEN ALTER TABLE "PlaylistPeriodSnapshot" ADD CONSTRAINT "PlaylistPeriodSnapshot_metrics_check" CHECK ("listeners">=0 AND "streams">=0); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PromotionCampaign_platform_check') THEN ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_platform_check" CHECK ("platform" IN ('META','INSTAGRAM','TIKTOK','YOUTUBE','EMAIL','OTHER')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PromotionCampaign_objective_check') THEN ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_objective_check" CHECK ("objective" IN ('AWARENESS','TRAFFIC','ENGAGEMENT','CONVERSIONS','STREAMS','PRESAVE','RETARGETING','OTHER')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PromotionCampaign_status_check') THEN ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_status_check" CHECK ("status" IN ('DRAFT','ACTIVE','PAUSED','ENDED','ARCHIVED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PromotionCampaign_name_check') THEN ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_name_check" CHECK (length(btrim("name"))>0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignEvidence_sourceType_check') THEN ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_sourceType_check" CHECK ("sourceType" IN ('META_IMPORT_BATCH','META_REPORT_ROW','MANUAL_REFERENCE','EXISTING_CAMPAIGN_RECORD')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignEvidence_confidence_check') THEN ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_confidence_check" CHECK ("confidence" IN ('LOW','MEDIUM','HIGH')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignEvidence_imported_dates_check') THEN ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_imported_dates_check" CHECK ("importedEndDate" IS NULL OR "importedStartDate" IS NULL OR "importedStartDate"<="importedEndDate"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignEvidence_spend_dates_check') THEN ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_spend_dates_check" CHECK ("spendEndDate" IS NULL OR "spendStartDate" IS NULL OR "spendStartDate"<="spendEndDate"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignEvidence_suggested_dates_check') THEN ALTER TABLE "CampaignEvidence" ADD CONSTRAINT "CampaignEvidence_suggested_dates_check" CHECK ("suggestedEndDate" IS NULL OR "suggestedStartDate" IS NULL OR "suggestedStartDate"<="suggestedEndDate"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignActiveInterval_sourceType_check') THEN ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_sourceType_check" CHECK ("sourceType" IN ('MANUAL','META_REPORT_SUGGESTION','EXISTING_CAMPAIGN_RECORD','IMPORTED_EVIDENCE','SYSTEM_INFERRED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignActiveInterval_confirmationStatus_check') THEN ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_confirmationStatus_check" CHECK ("confirmationStatus" IN ('SUGGESTED','CONFIRMED','REJECTED','SUPERSEDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignActiveInterval_dates_check') THEN ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_dates_check" CHECK ("activeEndDate" IS NULL OR "activeStartDate"<="activeEndDate"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignActiveInterval_timezone_check') THEN ALTER TABLE "CampaignActiveInterval" ADD CONSTRAINT "CampaignActiveInterval_timezone_check" CHECK (length(btrim("timezone"))>0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignTimelineEvent_eventType_check') THEN ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_eventType_check" CHECK ("eventType" IN ('RELEASE_PUBLISHED','CAMPAIGN_STARTED','CAMPAIGN_PAUSED','CAMPAIGN_RESUMED','CAMPAIGN_ENDED','BUDGET_CHANGED','CREATIVE_CHANGED','AUDIENCE_CHANGED','ORGANIC_CONTENT_POSTED','PRESAVE_STARTED','MAJOR_PLAYLIST_PLACEMENT','OTHER_RELEASE_PUBLISHED','MANUAL_NOTE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignTimelineEvent_source_check') THEN ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_source_check" CHECK ("source" IN ('SYSTEM_INTERVAL_SYNC','USER_ENTERED','IMPORTED_EVIDENCE','RELEASE_RECORD')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignTimelineEvent_confirmationStatus_check') THEN ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_confirmationStatus_check" CHECK ("confirmationStatus" IN ('SUGGESTED','CONFIRMED','REJECTED','SUPERSEDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CampaignTimelineEvent_timezone_check') THEN ALTER TABLE "CampaignTimelineEvent" ADD CONSTRAINT "CampaignTimelineEvent_timezone_check" CHECK (length(btrim("timezone"))>0); END IF;
END $stage10$;

-- Server-only Supabase posture: direct trusted PostgreSQL connections remain the application path.
ALTER TABLE "AnalyticsImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtistMetricObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackMetricObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SongPeriodSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaylistPeriodSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReleaseImportAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsImportRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MappingAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromotionCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignActiveInterval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignTimelineEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignAuditEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "AnalyticsImport","ArtistMetricObservation","TrackMetricObservation","SongPeriodSnapshot","PlaylistPeriodSnapshot","ReleaseImportAlias","AnalyticsImportRow","MappingAuditEvent","PromotionCampaign","CampaignEvidence","CampaignActiveInterval","CampaignTimelineEvent","CampaignAuditEvent" FROM PUBLIC, anon, authenticated, service_role;
