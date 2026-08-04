-- BEHAVIOR CHANGING. REVIEW AND EXECUTE ONLY IN AN APPROVED MAINTENANCE WINDOW.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  missing_tables integer;
  unexpected_owners integer;
  unexpected_policies integer;
BEGIN
  SELECT count(*) INTO missing_tables
  FROM (VALUES
    ('BreakingBarzEntry'),
    ('BreakingBarzVersion'),
    ('BreakingBarzVersionSource'),
    ('BreakingBarzCategory'),
    ('BreakingBarzEntryCategory'),
    ('BreakingBarzSubmission')
  ) AS expected(table_name)
  WHERE to_regclass(format('public.%I', table_name)) IS NULL;

  IF missing_tables <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz hardening stopped: % required tables are missing.', missing_tables;
  END IF;

  SELECT count(*) INTO unexpected_owners
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (
      'BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource',
      'BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'
    )
    AND pg_get_userbyid(c.relowner) <> 'postgres';

  IF unexpected_owners <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz hardening stopped: an unexpected table owner requires review.';
  END IF;

  SELECT count(*) INTO unexpected_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource',
      'BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'
    );

  IF unexpected_policies <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz hardening stopped: % existing policies require review.', unexpected_policies;
  END IF;
END $$;

LOCK TABLE
  public."BreakingBarzEntry",
  public."BreakingBarzVersion",
  public."BreakingBarzVersionSource",
  public."BreakingBarzCategory",
  public."BreakingBarzEntryCategory",
  public."BreakingBarzSubmission"
IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public."BreakingBarzEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzVersionSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzEntryCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzSubmission" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public."BreakingBarzEntry",
  public."BreakingBarzVersion",
  public."BreakingBarzVersionSource",
  public."BreakingBarzCategory",
  public."BreakingBarzEntryCategory",
  public."BreakingBarzSubmission"
FROM PUBLIC, anon, authenticated, service_role;

-- Deliberately create no policies. These tables are server-only. The postgres
-- owner/bypass role used by Prisma retains access; browser/Data API roles do not.
NOTIFY pgrst, 'reload schema';
COMMIT;
