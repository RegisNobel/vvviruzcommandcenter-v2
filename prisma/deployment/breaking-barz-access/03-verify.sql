-- Run immediately after 02-enable-rls-and-revoke.sql and before reopening traffic.
DO $$
DECLARE
  failed_tables integer;
  unexpected_policies integer;
  leaked_privileges integer;
BEGIN
  SELECT count(*) INTO failed_tables
  FROM (VALUES
    ('BreakingBarzEntry'),('BreakingBarzVersion'),('BreakingBarzVersionSource'),
    ('BreakingBarzCategory'),('BreakingBarzEntryCategory'),('BreakingBarzSubmission')
  ) AS expected(table_name)
  LEFT JOIN pg_class c
    ON c.relnamespace = 'public'::regnamespace
   AND c.relname = expected.table_name
   AND c.relkind = 'r'
  WHERE c.oid IS NULL
     OR NOT c.relrowsecurity
     OR c.relforcerowsecurity
     OR pg_get_userbyid(c.relowner) <> 'postgres';

  IF failed_tables <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz verification failed: RLS/owner state is unexpected on % tables.', failed_tables;
  END IF;

  SELECT count(*) INTO unexpected_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource',
      'BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'
    );

  IF unexpected_policies <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz verification failed: unexpected policies exist.';
  END IF;

  SELECT count(*) INTO leaked_privileges
  FROM (VALUES
    ('BreakingBarzEntry'),('BreakingBarzVersion'),('BreakingBarzVersionSource'),
    ('BreakingBarzCategory'),('BreakingBarzEntryCategory'),('BreakingBarzSubmission')
  ) AS tables(table_name)
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
  CROSS JOIN (VALUES
    ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
  ) AS privileges(privilege_name)
  WHERE has_table_privilege(
    roles.role_name,
    format('public.%I', tables.table_name),
    privileges.privilege_name
  );

  IF leaked_privileges <> 0 THEN
    RAISE EXCEPTION 'Breaking Barz verification failed: % API-role privileges remain.', leaked_privileges;
  END IF;
END $$;

SELECT
  c.relname AS table_name,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  c.relacl::text AS acl,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'BreakingBarzEntry','BreakingBarzVersion','BreakingBarzVersionSource',
    'BreakingBarzCategory','BreakingBarzEntryCategory','BreakingBarzSubmission'
  )
ORDER BY c.relname;

SELECT 'BreakingBarzEntry' AS table_name, count(*) AS row_count FROM public."BreakingBarzEntry"
UNION ALL SELECT 'BreakingBarzVersion', count(*) FROM public."BreakingBarzVersion"
UNION ALL SELECT 'BreakingBarzVersionSource', count(*) FROM public."BreakingBarzVersionSource"
UNION ALL SELECT 'BreakingBarzCategory', count(*) FROM public."BreakingBarzCategory"
UNION ALL SELECT 'BreakingBarzEntryCategory', count(*) FROM public."BreakingBarzEntryCategory"
UNION ALL SELECT 'BreakingBarzSubmission', count(*) FROM public."BreakingBarzSubmission"
ORDER BY table_name;
