# Audience Retention Lab production package

This package is prepared for review only. Stage 10 does not execute it.

Ordered controlled-deployment procedure:

1. Create and independently verify a restorable production backup.
2. Run `01-preflight.sql` read-only. Stop on any non-zero `artistLinkId`, artist ambiguity, or unexpected existing object.
3. Regenerate `02-prisma-db-push-preview.sql` against the then-current production database and compare it with this reviewed snapshot.
4. Confirm its only destructive operations are the `artistLinkId` foreign-key and column removal.
5. With an approved maintenance window, run the established `npm run db:push:postgres` workflow.
6. Run `03-post-push-constraints-and-access.sql` with a reviewed direct PostgreSQL connection.
7. Run `04-canonical-artist.sql`; it raises on ambiguity and never merges records.
8. Run `05-verify.sql`. Every result set must be empty except the final canonical-artist row.
9. Run authenticated import/analysis smoke tests before reopening the application.

`db push` has no PostgreSQL migration history and can propose new destructive work if production drifts after review. Therefore the preview must be regenerated immediately before execution, stored with the change record, and compared operation-by-operation. CHECK constraints and server-only grants remain companion SQL because Prisma does not model them.

Rollback is restore-based for the removed column: PostgreSQL cannot reconstruct it after removal. Additive tables can be left unused if application rollback is needed. Do not drop Retention Lab tables during an incident; restore the verified backup only when data or schema integrity requires it.
