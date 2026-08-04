# Breaking Barz access hardening package

This package is separate from the Audience Retention Lab deployment package. Gate A2 was approved and this package was executed against production on 2026-08-04 after PostgreSQL rehearsal and encrypted restore verification.

## Intended security model

- Public discovery, detail, release-annotation, and sitemap reads continue through server-only Prisma repositories.
- Public suggestions continue through `POST /api/breaking-barz/submissions`, which validates and rate-limits requests before server-side Prisma writes.
- Administrative reads and mutations continue through authenticated, TOTP-complete server routes/actions.
- Scheduled backups, restores, inventory, and backfill continue through the trusted PostgreSQL connection.
- `PUBLIC`, `anon`, `authenticated`, and `service_role` receive no direct privileges on the six tables.
- RLS is enabled with no policies. For non-owner, non-bypass roles this is intentional default-deny defense in depth.
- The existing `postgres` owner is retained because the deployed Prisma connection resolves to that trusted role. RLS is not forced on the owner.

## Controlled order

1. Confirm no untracked external consumer depends on direct Data API or `service_role` access.
2. Capture and review `01-preflight.sql` output. Stop on missing tables, unexpected policies, owners, views, functions, triggers, or row-state changes.
3. Take and restore-verify an encrypted backup containing all six tables.
4. Exercise the compatibility test plan in a production-like PostgreSQL environment.
5. Schedule a short maintenance window and pause Breaking Barz administrative writes and submissions.
6. Execute `02-enable-rls-and-revoke.sql` in one transaction.
7. Execute `03-verify.sql`; any assertion failure blocks reopening.
8. Issue zero-row REST checks with the publishable key and confirm all six tables now return authorization failures.
9. Smoke-test published feed/detail, public submission, release annotations, sitemap, admin draft/publish/archive/withdraw, submission review, category assignment, backup, and restore.
10. Reopen traffic only after the smoke tests pass.

`04-rollback.sql` restores the exact insecure API-role privilege posture observed on 2026-08-04. It is an emergency compatibility rollback, not an acceptable steady state. Prefer application rollback or correction of a missed dependency before using it.

## Known prerequisites and limitations

- Production's `postgres` default privileges still grant broad access on newly created public tables. Changing that default affects more than Breaking Barz and requires separate review. Any future Breaking Barz table must ship with explicit RLS and revocations until the default is remediated.
- The legacy `db:export:supabase-rest` script does not include these six tables. The scheduled encrypted Prisma snapshot does include and restore them. Do not treat the legacy REST export as a complete Breaking Barz backup.
- `01-preflight.sql`, `02-enable-rls-and-revoke.sql`, and `03-verify.sql` were executed in production during Gate A2. `04-rollback.sql` was rehearsed only on disposable PostgreSQL and was not executed in production.
- Production authenticated admin verification remains blocked by the pre-existing undersized `AUTH_SECRET`; this did not justify restoring insecure direct table access.
