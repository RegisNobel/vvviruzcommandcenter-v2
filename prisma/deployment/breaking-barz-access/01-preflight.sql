-- READ ONLY. Capture this output with the change record before hardening.
BEGIN TRANSACTION READ ONLY;

WITH targets(table_name) AS (
  VALUES
    ('BreakingBarzEntry'),
    ('BreakingBarzVersion'),
    ('BreakingBarzVersionSource'),
    ('BreakingBarzCategory'),
    ('BreakingBarzEntryCategory'),
    ('BreakingBarzSubmission')
)
SELECT
  t.table_name,
  c.oid IS NOT NULL AS exists,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  c.relacl::text AS acl,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.table_name) AS policy_count
FROM targets t
LEFT JOIN pg_class c
  ON c.relname = t.table_name
 AND c.relnamespace = 'public'::regnamespace
 AND c.relkind = 'r'
ORDER BY t.table_name;

SELECT 'BreakingBarzEntry' AS table_name, count(*) AS row_count FROM public."BreakingBarzEntry"
UNION ALL SELECT 'BreakingBarzVersion', count(*) FROM public."BreakingBarzVersion"
UNION ALL SELECT 'BreakingBarzVersionSource', count(*) FROM public."BreakingBarzVersionSource"
UNION ALL SELECT 'BreakingBarzCategory', count(*) FROM public."BreakingBarzCategory"
UNION ALL SELECT 'BreakingBarzEntryCategory', count(*) FROM public."BreakingBarzEntryCategory"
UNION ALL SELECT 'BreakingBarzSubmission', count(*) FROM public."BreakingBarzSubmission"
ORDER BY table_name;

SELECT 'entry_status' AS category, status AS value, count(*) AS row_count
FROM public."BreakingBarzEntry" GROUP BY status
UNION ALL
SELECT 'version_status', "editorialStatus", count(*)
FROM public."BreakingBarzVersion" GROUP BY "editorialStatus"
UNION ALL
SELECT 'submission_status', status, count(*)
FROM public."BreakingBarzSubmission" GROUP BY status
ORDER BY category, value;

SELECT
  count(*) FILTER (WHERE btrim("submitterEmail") <> '') AS submission_email_nonempty,
  count(*) FILTER (WHERE btrim("submitterName") <> '') AS submission_name_nonempty,
  count(*) FILTER (WHERE btrim("reviewNote") <> '') AS submission_review_note_nonempty
FROM public."BreakingBarzSubmission";

SELECT
  count(*) FILTER (WHERE "editorialStatus" <> 'published') AS unpublished_versions,
  count(*) FILTER (WHERE btrim("verificationNote") <> '') AS private_verification_note_nonempty
FROM public."BreakingBarzVersion";

WITH target_oids AS (
  SELECT c.oid
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (
      'BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource',
      'BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'
    )
), candidate_functions AS (
  SELECT p.oid, p.proname, p.proowner, p.prosecdef, n.nspname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
)
SELECT 'view' AS object_type, nv.nspname AS schema_name, v.relname AS object_name,
       pg_get_userbyid(v.relowner) AS owner, false AS security_definer
FROM target_oids t
JOIN pg_depend d ON d.refobjid = t.oid
JOIN pg_rewrite rw ON rw.oid = d.objid
JOIN pg_class v ON v.oid = rw.ev_class AND v.relkind IN ('v', 'm')
JOIN pg_namespace nv ON nv.oid = v.relnamespace
UNION
SELECT 'function', f.nspname, f.proname, pg_get_userbyid(f.proowner), f.prosecdef
FROM candidate_functions f
WHERE pg_get_functiondef(f.oid) ILIKE ANY (ARRAY[
  '%BreakingBarzEntry%','%BreakingBarzVersion%','%BreakingBarzSubmission%','%BreakingBarzCategory%'
])
ORDER BY object_type, schema_name, object_name;

ROLLBACK;
