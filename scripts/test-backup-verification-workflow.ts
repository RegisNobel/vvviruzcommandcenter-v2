import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/verify-production-backup.yml", "utf8");
const verifier = fs.readFileSync("scripts/verify-production-backup-ci.mjs", "utf8");
const dateCoverage = fs.readFileSync("lib/backups/game-over-date-coverage.ts", "utf8");
const adImportRecovery = fs.readFileSync("lib/backups/ad-import-batch-recovery-fingerprint.ts", "utf8");
assert.match(verifier, /gate:\s*"BACKUP_RESTORE_VERIFICATION"/);
assert.ok(!verifier.includes('gate:"E2.1E"'), "Reusable verifier must not retain a gate-specific label.");

assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:\s*$/m);
for (const forbiddenTrigger of ["push:", "pull_request:", "pull_request_target:", "schedule:", "workflow_run:", "repository_dispatch:"]) {
  assert.ok(!workflow.includes(forbiddenTrigger), `Forbidden trigger: ${forbiddenTrigger}`);
}
assert.match(workflow, /permissions:\s*\n\s+contents: read/);
assert.match(workflow, /environment: backup-restore-verification/);
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
assert.ok(!workflow.includes("github.token"), "GITHUB_TOKEN must not be reused as the database password.");
assert.match(workflow, /od -An -N48 -tx1 \/dev\/urandom/);
assert.match(workflow, /test "\$\{#password\}" -eq 96/);
assert.match(workflow, /echo "::add-mask::\$password"/);
assert.match(workflow, /DISPOSABLE_POSTGRES_PASSWORD=\$password/);
assert.match(workflow, /database="backup_verify_\$\{GITHUB_RUN_ID\}"/);
assert.match(workflow, /--publish 127\.0\.0\.1:5432:5432/);
assert.match(workflow, /postgres:17@sha256:[0-9a-f]{64}/);
assert.match(workflow, /\/proc\/1\/status\)" -ne 0/);
assert.match(workflow, /docker rm --force backup-verify-postgres/);
assert.match(workflow, /if: always\(\)/);
assert.match(workflow, /node-version: 24\.14\.1/);
assert.ok(!/uses:\s*[^\s]+@(?![0-9a-f]{40}\b)/.test(workflow), "Every Action must use a full SHA.");
assert.ok(!/upload-artifact|actions\/cache|cache:/.test(workflow), "Artifacts and caches are forbidden.");
for (const secret of ["POSTGRES_URL_NON_POOLING", "BLOB_READ_WRITE_TOKEN", "AUTH_SECRET", "ADMIN_TOTP_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
  assert.ok(!new RegExp(`${secret}:\\s*\\$\\{\\{\\s*secrets`).test(workflow), `Forbidden secret wiring: ${secret}`);
}

for (const expected of [
  'GAME_OVER_SPOTIFY_IMPORT_TYPE_MISMATCH',
  'GAME_OVER_SPOTIFY_IMPORT_STATE_MISMATCH',
  'GAME_OVER_SPOTIFY_ISRC_MISMATCH',
  'GAME_OVER_SPOTIFY_OBSERVATION_COUNT_MISMATCH',
  'GAME_OVER_SPOTIFY_DISTINCT_DATE_COUNT_MISMATCH',
  'GAME_OVER_SPOTIFY_EARLIEST_DATE_MISMATCH',
  'GAME_OVER_SPOTIFY_LATEST_DATE_MISMATCH',
  'GAME_OVER_SPOTIFY_DUPLICATE_DATE_MISMATCH',
  'GAME_OVER_SPOTIFY_MISSING_DATE_MISMATCH',
  'GAME_OVER_IMPORT_FINGERPRINT_MISMATCH',
  'GAME_OVER_PROVENANCE_FINGERPRINT_MISMATCH',
  'GAME_OVER_TIMELINE_FINGERPRINT_MISMATCH',
  'requireZeroRestoreProvenanceWarnings(importResult)',
  'RestoreImportInvariantError',
  '91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de',
  'mahoragaTrackTimeline: {count: 944',
  'MAHORAGA_META_CONTRACT_MISMATCH',
  'MAHORAGA_RECOVERY_COUNT_MISMATCH',
  'DUAL_RELEASE_SPEND_MISMATCH',
  'dual_release_raw_provenance_files:8',
  'corrected_aug_10:1',
  'stale_aug_10:0',
  'ea28eedcb1ed9f15b8e38098406bdff5f35900d4fdeeb33a56ac4eaa7fcb73db',
  'IMPORT_AUTH:"1"'
]) assert.ok(verifier.includes(expected), `Missing restored-baseline assertion: ${expected}`);

assert.match(verifier, /fingerprintAdImportBatchRecovery\(mahoragaImport\[0\]\)/);
assert.match(verifier, /MAHORAGA_IMPORT_ROW_COUNT_MISMATCH/);
assert.ok(!verifier.includes('SELECT * FROM "AdImportBatch"'), "AdImportBatch recovery must not depend on PostgreSQL column order.");
assert.match(adImportRecovery, /AD_IMPORT_BATCH_RECOVERY_FIELDS/);
assert.match(adImportRecovery, /toISOString\(\)/);
assert.match(adImportRecovery, /JSON\.stringify\(canonical\)/);

assert.ok(!verifier.includes("gameOverSpotify.missing_date_count = 0"), "Missing dates must be derived from restored rows.");
assert.match(dateCoverage, /count\(DISTINCT metric_date\)::int distinct_date_count/);
assert.match(dateCoverage, /\(count\(\*\)-count\(DISTINCT metric_date\)\)::int duplicate_date_count/);
assert.match(dateCoverage, /generate_series\(\$2::date,\$3::date,interval '1 day'\)/);
assert.match(dateCoverage, /NOT EXISTS/);
assert.match(dateCoverage, /\) missing_date_count/);
assert.match(verifier, /earliestDate: "2024-01-01"/);
assert.match(verifier, /latestDate: "2026-08-09"/);
assert.match(verifier, /observationCount: 952/);
assert.match(verifier, /distinctDateCount: 952/);
assert.match(verifier, /backupRunId: "f048a6db-fe5a-4d6a-9462-0701a69849cb"/);
assert.match(verifier, /sizeBytes: 6_621_090/);
assert.match(verifier, /facts:852,positive:110,explicit_zero:742,missing:0,spend:"827\.18"/);
assert.match(verifier, /files:4,sourceRows:1215,observations:933,resolutions:933,events:933,reports:852/);
assert.match(verifier, /o\.spend=3\.84/);
assert.match(verifier, /o\.spend=2\.71/);
for (const recoveryHash of [
  "c63235a35c7817a3c08659c48489496b78b0b922083f1a44edb1fc9ab8efc747",
  "14e0d658369774667efb447cf6e2f542038ef70b06420c3d055ca48f923aa6a0",
  "bcc843e06dcca671c314fefe5fb79b33b2de9933b7b3b20be992ab798cd7410c",
  "989c5f7c8f8018e015887fcd259ba3d2da057a814d055919cb74c272c7ffa5e3",
  "1fc580eee99f029e7a2fe369522c0e444cc3fdae0a2527ce9cd1ca7475ce0b9b",
  "24ef8079921d8fd884674b15dec4001e3054194eca8e8737fa5cb93ede20157b",
  "11ab6b6bee8d574631735e87a87bd89c1b853d042f1dc447e9fa5c806abc9e62"
]) assert.ok(verifier.includes(recoveryHash), `Missing frozen Mahoraga recovery hash: ${recoveryHash}`);
assert.ok(verifier.includes("21c237b9db3a8d79a307317b8f96f25508497953a41c8ede5308ce209b56a55a"), "Legacy production-order fingerprint provenance must remain documented.");

console.log(JSON.stringify({suite: "backup-verification-workflow", manualOnly: true, pinnedActions: true, randomEntropyBytes: 48, githubTokenReused: false, loopbackOnly: true, teardownAlways: true, restoredBaselineContract: true}));
