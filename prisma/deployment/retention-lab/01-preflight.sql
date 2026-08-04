-- READ ONLY. Run before db push and stop on any failed expectation.
BEGIN TRANSACTION READ ONLY;

DO $preflight$
DECLARE
  missing_required integer;
  unexpected_analytics integer;
  populated_artist_links integer;
  ambiguous_artists integer;
  breaking_barz_mismatch integer;
BEGIN
  SELECT count(*) INTO missing_required
  FROM (VALUES
    ('ArtistProfile'),('ArtistLink'),('AppearsOnArtistCredit'),
    ('BreakingBarzEntry'),('BreakingBarzVersion'),('BreakingBarzVersionSource'),
    ('BreakingBarzCategory'),('BreakingBarzEntryCategory'),('BreakingBarzSubmission')
  ) AS expected(name)
  WHERE to_regclass(format('public.%I', name)) IS NULL;
  IF missing_required <> 0 THEN
    RAISE EXCEPTION 'Retention Lab preflight stopped: % required starting tables are missing.', missing_required;
  END IF;

  SELECT count(*) INTO populated_artist_links
  FROM "AppearsOnArtistCredit" WHERE "artistLinkId" IS NOT NULL;
  IF populated_artist_links <> 0 THEN
    RAISE EXCEPTION 'Retention Lab preflight stopped: AppearsOnArtistCredit.artistLinkId contains % populated rows.', populated_artist_links;
  END IF;

  SELECT count(*) INTO ambiguous_artists
  FROM "ArtistProfile"
  WHERE ("slug"='vvviruz' OR lower("displayName")='vvviruz')
    AND "id"<>'artist-profile-vvviruz';
  IF ambiguous_artists <> 0 THEN
    RAISE EXCEPTION 'Retention Lab preflight stopped: % ambiguous vvviruz artist records require review.', ambiguous_artists;
  END IF;

  SELECT count(*) INTO unexpected_analytics
  FROM unnest(ARRAY[
    'AnalyticsImport','ArtistMetricObservation','TrackMetricObservation','SongPeriodSnapshot','PlaylistPeriodSnapshot',
    'ReleaseImportAlias','AnalyticsImportRow','MappingAuditEvent','PromotionCampaign','CampaignEvidence',
    'CampaignActiveInterval','CampaignTimelineEvent','CampaignAuditEvent'
  ]) AS name
  WHERE to_regclass(format('public.%I', name)) IS NOT NULL;
  IF unexpected_analytics <> 0 THEN
    RAISE EXCEPTION 'Retention Lab preflight stopped: % Retention Lab tables already exist.', unexpected_analytics;
  END IF;

  SELECT count(*) INTO breaking_barz_mismatch
  FROM pg_class c
  WHERE c.relnamespace='public'::regnamespace
    AND c.relname=ANY(ARRAY['BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource','BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'])
    AND (
      pg_get_userbyid(c.relowner)<>'postgres'
      OR NOT c.relrowsecurity
      OR c.relforcerowsecurity
      OR EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
      OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    );
  IF breaking_barz_mismatch <> 0 THEN
    RAISE EXCEPTION 'Retention Lab preflight stopped: % Breaking Barz tables are not in the approved hardened state.', breaking_barz_mismatch;
  END IF;
END $preflight$;

SELECT count(*) AS appears_on_artist_credit_rows,
       count("artistLinkId") AS non_null_artist_link_ids,
       count(DISTINCT "artistLinkId") AS distinct_referenced_artist_links
FROM "AppearsOnArtistCredit";

SELECT aac."id", aac."artistLinkId", al."artistProfileId", al."platform"
FROM "AppearsOnArtistCredit" aac
LEFT JOIN "ArtistLink" al ON al."id" = aac."artistLinkId"
WHERE aac."artistLinkId" IS NOT NULL;

-- Must return no rows. Any row is an artist identity ambiguity and blocks the seed.
SELECT "id", "slug", "displayName", "workflowStatus", "publishedAt", "publishedVersionId"
FROM "ArtistProfile"
WHERE ("slug" = 'vvviruz' OR lower("displayName") = 'vvviruz')
  AND "id" <> 'artist-profile-vvviruz';

-- Existing canonical row, if present, must already match the private DRAFT designation.
SELECT "id", "slug", "displayName", "workflowStatus", "publishedAt", "publishedVersionId"
FROM "ArtistProfile"
WHERE "id" = 'artist-profile-vvviruz';

-- All should be null before the first Retention Lab deployment.
SELECT name, to_regclass(format('public.%I', name)) AS existing_relation
FROM unnest(ARRAY[
  'AnalyticsImport','ArtistMetricObservation','TrackMetricObservation','SongPeriodSnapshot','PlaylistPeriodSnapshot',
  'ReleaseImportAlias','AnalyticsImportRow','MappingAuditEvent','PromotionCampaign','CampaignEvidence',
  'CampaignActiveInterval','CampaignTimelineEvent','CampaignAuditEvent'
]) AS name;

COMMIT;
