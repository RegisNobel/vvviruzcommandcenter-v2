# Audience Retention Lab operations

## Production boundary

Retention Lab routes are private admin routes and require an authenticated, TOTP-complete session. Raw and preview CSV objects use the private `analytics-raw` and `analytics-preview` namespaces. Browser payloads never receive storage keys or raw CSV rows. Prisma uses the trusted server PostgreSQL connection; the 13 Retention Lab tables are intended to have RLS enabled, no browser policies, and all table privileges revoked from `PUBLIC`, `anon`, and `authenticated`.

The current production Supabase project was inspected read-only on 2026-08-03. The Retention Lab tables do not exist yet. `pg_graphql` is not installed. Existing public-schema grants follow the project's older defaults, so the explicit revoke in the deployment companion is mandatory. Gate A2 separately enabled RLS and revoked direct API-role access for the six `BreakingBarz*` tables; Retention Lab deployment must preserve that hardened posture.

Required deployment configuration is validated by `npm run deployment:check-env`. The preview token derives its encryption key from `AUTH_SECRET`. PostgreSQL needs a runtime/pool URL and a distinct direct schema-operation URL. Private analytics and backup storage use `PRIVATE_STORAGE_DRIVER=vercel-blob` with a server-only `PRIVATE_BLOB_READ_WRITE_TOKEN`; public media continues to use the separate public Blob credential. Operational defaults are 30 raw-file days, 24 preview hours, 7 orphan days, a 100-object cleanup batch, and a 2,000 ms dashboard slow threshold.

The original production Blob store remains public and unsuitable for Retention Lab bytes. Gate B provisioned separate IAD1 private production and non-production stores and verified authenticated upload/retrieval, anonymous denial, cleanup, and disposable restore. The 2026-08-04 metadata-only inventory found 213 historical encrypted-name backup objects totaling 149,757,887 bytes in the old public store. They were not copied, reclassified, downloaded, or deleted; migration and retention still require explicit approval.

## Daily cleanup

Vercel calls `/api/cron/analytics-maintenance` at 09:30 UTC with `Authorization: Bearer $CRON_SECRET`. The job is bounded, idempotent, and continues after per-object failures. It removes expired token-only previews, deletes expired accepted-import raw objects before setting `rawFileDeletedAt`, and removes only raw objects that have no import reference and are older than the conservative orphan threshold. Hashes, validation metadata, mappings, imports, audits, and normalized observations are never deleted.

Run `npm run analytics:cleanup:dry-run` before a manual cleanup. Apply manually only with `node --conditions=react-server --import tsx scripts/run-retention-cleanup.ts --apply` from a correctly configured server environment. A storage failure leaves the deletion timestamp null so the next run retries. A missing object is an idempotent success.

## Operational checks

The existing admin operational-health refresh now reports no current audience import, a stale artist timeline, open campaigns, unconfirmed suggestions, mapping conflicts, unconfirmed report periods, high reconciliation variance, expired raw files, orphan scan failures/orphans, and failed imports. Run the existing operational health refresh from the admin surface. Run `npm run analytics:profile-dashboard` for comparison-query slowdown; there is no composite score.

Structured operational events cover import preview/commit/withdraw/reprocess, retention calculation, dashboard assembly, and cleanup. Mapping and campaign mutations retain their durable database audit events with actor usernames and immutable history. Logs include safe IDs, types, counts, statuses, confidence, reason codes, durations, payload bytes, and query estimates. They exclude preview tokens, storage keys, CSV content, raw metric values, and imported row bodies.

## Import failure

1. Open `/admin/retention-lab/imports` and the affected import.
2. Read the sanitized validation summary, parser/normalization version, status, and raw-file availability.
3. If retained raw data is available, reprocess to a new private preview. Reconfirm every required warning, period, artist, release, and mapping decision.
4. If the import is logically wrong, withdraw it with a reason. Withdrawal preserves observations and audit history but removes the import from current resolution.
5. Never delete normalized observations to repair an import. Use replacement or withdrawal semantics.

## Mapping conflict

1. Open `/admin/retention-lab/mappings` and inspect safe evidence and competing releases.
2. Confirm, explicitly unmatch, or remap with the required reason. Create an alias only when its scope is unambiguous; acknowledge title-only risk explicitly.
3. Understand that the imported snapshot is immutable. Remapping changes resolution and reconciliation, not the original snapshot.
4. Revoke a bad alias so it cannot apply to future rows; prior decisions remain audited.
5. Reopen the import to verify recalculated reconciliation variance.

## Campaign date correction

1. Open the campaign timeline and correct the current interval with an audit reason.
2. Confirm inclusive dates and a real IANA timezone. Suggested intervals never feed calculations until confirmed.
3. Verify the superseded interval remains visible and lifecycle events were regenerated from the replacement.
4. Re-run release retention analysis and check overlap/exclusion reasons.

## Missing post window

1. Confirm the campaign has an inclusive end date. An open interval cannot have a post-campaign floor.
2. The exact floor needs days 14 through 28 after the final campaign day.
3. Compare that availability date with the latest current Spotify audience observation.
4. Import a newer Artist Audience Timeline after the required date; do not substitute zeroes or shorten the formula window.

## Cleanup failure

1. Inspect the structured cleanup category, opaque object ID, and error code.
2. Check private storage credentials and namespace access without printing tokens or object contents.
3. Re-run dry-run, then safely retry apply. Missing objects are accepted; failed deletes remain pending.
4. Do not set `rawFileDeletedAt` by hand unless storage absence is independently verified.
5. Never delete the import or normalized observations as a cleanup workaround.

## Controlled production deployment

1. Resolve the unrelated exposed `BreakingBarz*` tables or obtain explicit security ownership and approval.
2. Provision and verify a private Blob store/token; do not use the current public-only store for raw, preview, or new backup artifacts.
3. Confirm Vercel environment validation succeeds without printing values.
4. Create an encrypted production database snapshot and asset manifest; restore them in an isolated environment and compare results.
5. Run `prisma/deployment/retention-lab/01-preflight.sql`. Stop if `artistLinkId` has any non-null value/reference or the vvviruz identity is ambiguous.
6. Regenerate the production Prisma diff read-only. Review every operation. The only approved destructive work is the empty `artistLinkId` foreign-key and column removal.
7. Schedule a maintenance window and record the backup identifier, diff, reviewer, and rollback decision owner.
8. Run the established `npm run db:push:postgres` workflow with the direct URL. Do not introduce a second migration history.
9. Run `03-post-push-constraints-and-access.sql`, then the ambiguity-safe canonical artist script.
10. Run `05-verify.sql`; missing tables/constraints, browser grants, policies, or disabled RLS block reopening.
11. Run authenticated import, mapping, campaign, retention, dashboard, cleanup dry-run, and health smoke tests.

`db push` drift is the principal deployment risk: an old reviewed diff is not authority for a later production state. Roll back application code first if the additive schema is healthy. Do not drop analytics tables during an application rollback. The removed `artistLinkId` column can only be recovered from the verified backup; restoration has downtime and may overwrite newer writes, so the incident owner must make that decision explicitly.

## Backup and restore

Scheduled snapshots include imports, normalized observations, replacement and withdrawal state, mapping rows, aliases, mapping audits, campaigns, evidence, intervals, events, audit history, and supersession links. Raw CSV bytes are intentionally absent. Restore nulls missing admin foreign keys while preserving actor usernames. `npm run test:backup-restore-rehearsal` resets two disposable database copies, exports one, recreates the other, restores it, and verifies current resolution and Stage 7 calculation equivalence.

Encrypted Blob backup artifacts should remain private. Google Drive backup is optional and must use the existing scoped credentials. A successful upload is not restore proof; retain periodic rehearsal evidence with the deployment record.
