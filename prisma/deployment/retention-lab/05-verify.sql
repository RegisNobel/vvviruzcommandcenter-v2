-- Every diagnostic result except the final canonical row must be empty.
WITH expected(name) AS (VALUES
 ('AnalyticsImport'),('ArtistMetricObservation'),('TrackMetricObservation'),('SongPeriodSnapshot'),('PlaylistPeriodSnapshot'),
 ('ReleaseImportAlias'),('AnalyticsImportRow'),('MappingAuditEvent'),('PromotionCampaign'),('CampaignEvidence'),
 ('CampaignActiveInterval'),('CampaignTimelineEvent'),('CampaignAuditEvent')
)
SELECT name AS missing_table FROM expected WHERE to_regclass(format('public.%I',name)) IS NULL;

WITH expected(name) AS (VALUES
 ('AnalyticsImport_status_check'),('AnalyticsImport_fileHash_check'),('AnalyticsImport_counts_check'),('AnalyticsImport_normalizationVersion_check'),('AnalyticsImport_rawFileSizeBytes_check'),('AnalyticsImport_detectedPeriod_check'),('AnalyticsImport_confirmedPeriod_check'),
 ('ArtistMetricObservation_metrics_check'),('TrackMetricObservation_metrics_check'),('SongPeriodSnapshot_period_check'),('SongPeriodSnapshot_metrics_check'),('PlaylistPeriodSnapshot_period_check'),('PlaylistPeriodSnapshot_metrics_check'),
 ('PromotionCampaign_platform_check'),('PromotionCampaign_objective_check'),('PromotionCampaign_status_check'),('PromotionCampaign_name_check'),
 ('CampaignEvidence_sourceType_check'),('CampaignEvidence_confidence_check'),('CampaignEvidence_imported_dates_check'),('CampaignEvidence_spend_dates_check'),('CampaignEvidence_suggested_dates_check'),
 ('CampaignActiveInterval_sourceType_check'),('CampaignActiveInterval_confirmationStatus_check'),('CampaignActiveInterval_dates_check'),('CampaignActiveInterval_timezone_check'),
 ('CampaignTimelineEvent_eventType_check'),('CampaignTimelineEvent_source_check'),('CampaignTimelineEvent_confirmationStatus_check'),('CampaignTimelineEvent_timezone_check')
)
SELECT name AS missing_check_constraint FROM expected WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=expected.name AND contype='c');

SELECT c.relname AS table_without_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname=ANY(ARRAY['AnalyticsImport','ArtistMetricObservation','TrackMetricObservation','SongPeriodSnapshot','PlaylistPeriodSnapshot','ReleaseImportAlias','AnalyticsImportRow','MappingAuditEvent','PromotionCampaign','CampaignEvidence','CampaignActiveInterval','CampaignTimelineEvent','CampaignAuditEvent']) AND NOT c.relrowsecurity;

SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name=ANY(ARRAY['AnalyticsImport','ArtistMetricObservation','TrackMetricObservation','SongPeriodSnapshot','PlaylistPeriodSnapshot','ReleaseImportAlias','AnalyticsImportRow','MappingAuditEvent','PromotionCampaign','CampaignEvidence','CampaignActiveInterval','CampaignTimelineEvent','CampaignAuditEvent']) AND grantee IN ('PUBLIC','anon','authenticated','service_role');

SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname='public' AND tablename=ANY(ARRAY['AnalyticsImport','ArtistMetricObservation','TrackMetricObservation','SongPeriodSnapshot','PlaylistPeriodSnapshot','ReleaseImportAlias','AnalyticsImportRow','MappingAuditEvent','PromotionCampaign','CampaignEvidence','CampaignActiveInterval','CampaignTimelineEvent','CampaignAuditEvent']);

SELECT "id","slug","displayName","workflowStatus","publishedAt","publishedVersionId" FROM "ArtistProfile" WHERE "id"='artist-profile-vvviruz';
