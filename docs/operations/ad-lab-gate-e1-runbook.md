# Ad Lab Gate E1 controlled production runbook

This runbook is frozen by Gate E0.8. It authorizes nothing by itself. Gate E1 must be separately approved, must use the exact reviewed application commit, and must stop at every checkpoint.

## Frozen inputs

- Game Over source-manifest fingerprint: `69a1b2f3321f65f5049cd27f131e2066adafa9c3f4793843d68ea2e064e505bf`
- Mahoraga source-manifest fingerprint: `1bfc3d1bae9e75815e59b5a987e6246fe39a4724533f239eb3a9dd5dfdc25b5a`
- Prisma production diff SHA-256: `c45bf56051f393983fb0897a6d4f4062c974ac7d91b378646c609d5ef8d99de0`
- Cumulative PostgreSQL companion SHA-256: `67701b1ec6f600c18a75dfffaa222eccef166e7a9589ec67015f9b4b45ac531d`
- Production ranking baseline: `docs/operations/manifests/ad-lab-production-readiness-baseline-2026-08-10.json`
- Account timezone to register only after schema/security deployment: account `367019114407672`, `America/Los_Angeles`, `USER_CONFIRMED`.
- The frozen DAILY bundles are distinct release evidence beneath external campaign `120243311904960172`: Game Over uses Ad Set `120247925536670172`; Mahoraga uses Ad Set `120245448816970172`. Neither child scope may leak into or duplicate the other.

The reviewed Prisma diff contains 9 new tables, 41 additive columns, 20 foreign keys, and 40 indexes. The companion contains 37 checks, 9 RLS enables, and 9 direct-role revocations. Both contain zero table/column drops, deletes, truncations, destructive rewrites, or unexpected operations.

## Checkpoint A — backup

Create a fresh encrypted production backup and restore it into an isolated database. Compare table counts and protected Ad Lab/Spotify fingerprints with the production baseline.

- STOP: backup creation, encryption, restore, identity guard, count, or fingerprint verification fails.
- Forward repair: correct the backup/restore tooling and repeat A from the beginning.
- Rollback: none is needed because production has not changed.
- Last resort: not applicable at this checkpoint.

## Checkpoint B — guarded inventory

Run the read-only inventory immediately before mutation. Require 17 AdImportBatch rows, 150 AdCreativeReport rows, 109 Copy Lab links, 17 aggregate snapshots, zero DAILY batches, 5 Mahoraga batches, 50 Mahoraga reports, 18 Mahoraga Copy Lab links, zero campaigns, zero aliases, and exact Spotify fingerprints from the frozen baseline.

- STOP: any count or fingerprint differs, or the database identity/read-only guard fails.
- Forward repair: investigate the new production state and regenerate/reapprove the baseline and migration review.
- Rollback: none is needed because inventory is read-only.
- Last resort: not applicable at this checkpoint.

## Checkpoint C — final diff

Regenerate the production-to-reviewed-schema Prisma diff. Compare its SHA-256 and classified operations with the frozen diff. Separately verify the cumulative companion hash.

- STOP: a hash changes; any drop, delete, truncate, type rewrite, destructive operation, or unexpected operation appears; or a required additive operation disappears.
- Forward repair: reconcile production/schema drift in a new non-production review.
- Rollback: none is needed because diff generation is read-only.
- Last resort: not applicable at this checkpoint.

## Checkpoint D — Prisma schema application

Apply only the reviewed additive `prisma db push` using the established production workflow. Immediately introspect and verify all expected tables, columns, indexes, defaults, and foreign keys. Re-run legacy counts before continuing.

- STOP: partial application, unexpected SQL, schema mismatch, connectivity issue, or legacy count change.
- Forward repair: prefer completing or correcting the additive schema in place after a reviewed diff.
- Rollback: additive tables/columns should remain unused while application deployment is blocked; do not improvise destructive rollback.
- Last resort: restore the verified backup only if forward repair is unsafe and restoration is explicitly approved.

## Checkpoint E — PostgreSQL companion

Execute exactly `docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql`. Verify every CHECK, RLS enable, and privilege revocation. Confirm `anon`, `authenticated`, and `service_role` cannot directly read every protected table while the trusted database-owner connection retains access.

- STOP: any statement fails, any expected constraint/RLS/revocation is absent, a direct role can read, or the owner cannot read.
- Forward repair: complete the missing additive hardening and repeat the complete denial/access verification.
- Rollback: application deployment remains blocked; retain additive schema while repairing security.
- Last resort: restore the verified backup only if the security state cannot be made exact and restoration is explicitly approved.

## Checkpoint F — application deployment

Deploy the exact reviewed commit. Confirm the deployment is READY, the production alias points to it, and the deployed commit equals the approved commit.

- STOP: build failure, commit mismatch, alias mismatch, health regression, runtime 5xx, Prisma error, or authentication regression.
- Forward repair: deploy a reviewed corrective commit only after its diff and tests pass.
- Rollback: move the alias to the last known-good deployment if its schema compatibility has been verified.
- Last resort: database restore only if separately approved and required by an unrecoverable database mutation.

## Checkpoint G — security, storage, and functional canaries

Before a real Meta DAILY import, run TOTP login/repeat login, import preview/final review/idempotency without committing real data, the private-storage canary below, cleanup dry-run, campaign-evidence read paths, existing Ad Lab read paths, and existing Retention Lab read paths. Compare all protected production fingerprints again.

- STOP: secret/key exposure, unauthorized storage access, duplicate mutation, cleanup mutation during dry-run, 5xx, data-fingerprint drift, legacy read regression, or any campaign/link/interval created.
- Forward repair: isolate and fix the failed subsystem; repeat G from the start after a reviewed deployment.
- Rollback: return the alias to the verified compatible deployment. Leave additive database objects unused unless an explicit rollback is approved.
- Last resort: restore the verified backup only for confirmed unrecoverable data mutation.

## Private `ads-preview` storage canary

1. Record a database/storage fingerprint and confirm no canary object exists.
2. Create one tiny uniquely named private `ads-preview` object containing non-sensitive synthetic bytes.
3. Retrieve it through the authenticated server path and verify the bytes/hash.
4. Inspect the browser response and client state; require that no raw storage key, provider token, or signed credential is exposed.
5. Exercise the reviewed preview-to-raw transition only if that path is part of the deployed canary; otherwise record it as not applicable.
6. Verify retention metadata and raw expiry are correct.
7. Run cleanup in dry-run mode and require zero database or object mutation.
8. Delete the canary through the reviewed server path.
9. Verify retrieval now fails and no object/orphan reference remains.
10. Recompute the database/storage fingerprint and require normalized/database state to equal the pre-canary baseline.

## First data boundary after Gate E1

Gate E1 itself must not import either real Meta DAILY bundle. A later, separately approved data-onboarding step must reference the applicable immutable manifest fingerprint, recheck all four file hashes, create or reuse the reviewed account-timezone registry record, and stop before any `MetaPromotionLink` or `PromotionCampaign` operation. A later link review must use stable `AD_SET` scope for these two releases; parent `CAMPAIGN` scope is not a safe default. The source-as-of origin remains `UNKNOWN` unless the product owner explicitly confirms a genuine export/session timestamp.

## Gate E0.8 recorded limitations

- The forward SQLite cleanup migrations preserve already-local campaign-link and evidence history and pass a fresh 50-migration chain. A pre-existing, unrelated `ArtistIntake` table redefinition remains in a fresh-chain schema diff; it is outside this gate and does not affect the established production PostgreSQL `db push` path.
- The private Vercel Blob backup integration test requires an isolated non-production Blob token. It was not run with production credentials because doing so would mutate production storage. Encrypted local backup/restore and the dual-release PostgreSQL scoped-link round trip both passed.
