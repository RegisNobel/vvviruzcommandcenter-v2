-- EMERGENCY ONLY. This restores the insecure privilege posture observed on
-- 2026-08-04 and must not be treated as an acceptable completed deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE
  public."BreakingBarzEntry",
  public."BreakingBarzVersion",
  public."BreakingBarzVersionSource",
  public."BreakingBarzCategory",
  public."BreakingBarzEntryCategory",
  public."BreakingBarzSubmission"
IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public."BreakingBarzEntry" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzVersion" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzVersionSource" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzCategory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzEntryCategory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."BreakingBarzSubmission" DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE
  public."BreakingBarzEntry",
  public."BreakingBarzVersion",
  public."BreakingBarzVersionSource",
  public."BreakingBarzCategory",
  public."BreakingBarzEntryCategory",
  public."BreakingBarzSubmission"
TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
