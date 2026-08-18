import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/verify-production-backup.yml", "utf8");
const verifier = fs.readFileSync("scripts/verify-production-backup-ci.mjs", "utf8");
const dateCoverage = fs.readFileSync("lib/backups/game-over-date-coverage.ts", "utf8");
const gameOverRecovery = fs.readFileSync("lib/backups/game-over-recovery-fingerprints.ts", "utf8");
const adImportRecovery = fs.readFileSync("lib/backups/ad-import-batch-recovery-fingerprint.ts", "utf8");
const metaImportFileRecovery = fs.readFileSync("lib/backups/meta-import-file-recovery-fingerprint.ts", "utf8");
const metaRecoveryCollections = fs.readFileSync("lib/backups/meta-recovery-collection-fingerprints.ts", "utf8");
const spotifyRecovery = fs.readFileSync("lib/backups/spotify-recovery-fingerprints.ts", "utf8");
const timestampReadPath = fs.readFileSync("lib/backups/backup-verifier-pg-client.ts", "utf8");
assert.match(verifier, /gate:\s*"BACKUP_RESTORE_VERIFICATION"/);
assert.ok(!verifier.includes('process.env.TZ'), "Production verification must not depend on process timezone.");
assert.match(verifier, /createBackupVerifierPgClient/);
assert.match(timestampReadPath, /defaultTypes\.builtins\.TIMESTAMP/);
assert.ok(!timestampReadPath.includes("builtins.TIMESTAMPTZ &&"), "TIMESTAMPTZ must not be reinterpreted.");
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
assert.match(verifier, /fingerprintMetaImportFileRecovery\(mahoragaFiles\)/);
assert.match(verifier, /fingerprintMetaImportFileRowRecovery\(mahoragaSourceRows\)/);
assert.match(verifier, /fingerprintMetaDailySourceObservationRecovery\(mahoragaObservations\)/);
assert.match(verifier, /fingerprintMetaDailyResolutionRecovery\(mahoragaResolutions\)/);
assert.match(verifier, /fingerprintMetaDailyResolutionEventRecovery\(mahoragaEvents\)/);
assert.match(verifier, /fingerprintAdCreativeReportRecovery\(mahoragaReports\)/);
assert.match(verifier, /MAHORAGA_IMPORT_ROW_COUNT_MISMATCH/);
assert.ok(!verifier.includes('SELECT * FROM "AdImportBatch"'), "AdImportBatch recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT * FROM "MetaImportFile"'), "MetaImportFile recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT r.* FROM "MetaImportFileRow"'), "MetaImportFileRow recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT * FROM "MetaDailySourceObservation" WHERE "importBatchId"'), "MetaDailySourceObservation recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT r.* FROM "MetaDailyResolution"'), "MetaDailyResolution recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT e.* FROM "MetaDailyResolutionEvent"'), "MetaDailyResolutionEvent recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT * FROM "AdCreativeReport" WHERE "importBatchId"'), "AdCreativeReport recovery must not depend on PostgreSQL column order.");
assert.match(adImportRecovery, /AD_IMPORT_BATCH_RECOVERY_FIELDS/);
assert.match(adImportRecovery, /toISOString\(\)/);
assert.match(adImportRecovery, /JSON\.stringify\(canonical\)/);
assert.match(metaImportFileRecovery, /META_IMPORT_FILE_RECOVERY_FIELDS/);
assert.match(metaImportFileRecovery, /toISOString\(\)/);
assert.match(metaImportFileRecovery, /JSON\.stringify\(canonical\)/);
for (const contractName of [
  "META_IMPORT_FILE_ROW_RECOVERY_FIELDS", "META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS",
  "META_DAILY_RESOLUTION_RECOVERY_FIELDS", "META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS",
  "AD_CREATIVE_REPORT_RECOVERY_FIELDS"
]) assert.ok(metaRecoveryCollections.includes(contractName), `Missing canonical recovery contract: ${contractName}`);
assert.match(metaRecoveryCollections, /toISOString\(\)/);
assert.match(metaRecoveryCollections, /JSON\.stringify\(canonicalCollection/);
for (const contractName of [
  "GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS", "GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS",
  "GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS"
]) assert.ok(gameOverRecovery.includes(contractName), `Missing canonical Game Over recovery contract: ${contractName}`);
assert.match(gameOverRecovery, /fingerprintGameOverAnalyticsImportRecovery/);
assert.match(gameOverRecovery, /fingerprintGameOverProvenanceRecovery/);
assert.match(gameOverRecovery, /toISOString\(\)/);
assert.match(verifier, /fingerprintGameOverAnalyticsImportRecovery\(fullImport\)/);
assert.match(verifier, /fingerprintGameOverProvenanceRecovery\(\{analyticsImport:fullImport,auditEvents,mappingRows,releaseIds\}\)/);
assert.ok(!verifier.includes('SELECT * FROM "AnalyticsImport" WHERE id=$1'), "Game Over import recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT * FROM "MappingAuditEvent"'), "Game Over audit recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT * FROM "AnalyticsImportRow"'), "Game Over mapping-row recovery must not depend on PostgreSQL column order.");
for (const contractName of [
  "ANALYTICS_IMPORT_RECOVERY_FIELDS", "ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS",
  "TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS", "SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS",
  "PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS"
]) assert.ok(spotifyRecovery.includes(contractName), `Missing canonical Spotify recovery contract: ${contractName}`);
for (const functionName of [
  "fingerprintAnalyticsImportRecovery", "fingerprintArtistMetricObservationRecovery",
  "fingerprintTrackMetricObservationRecovery", "fingerprintSongPeriodSnapshotRecovery",
  "fingerprintPlaylistPeriodSnapshotRecovery"
]) assert.ok(verifier.includes(functionName), `Verifier is not using canonical Spotify recovery function: ${functionName}`);
assert.match(spotifyRecovery, /toISOString\(\)/);
assert.match(spotifyRecovery, /JSON\.stringify\(canonicalCollection/);
assert.ok(!verifier.includes('SELECT o.* FROM "ArtistMetricObservation"'), "Artist timeline recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT o.* FROM "TrackMetricObservation"'), "Track timeline recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT s.* FROM "SongPeriodSnapshot"'), "Song period recovery must not depend on PostgreSQL column order.");
assert.ok(!verifier.includes('SELECT p.* FROM "PlaylistPeriodSnapshot"'), "Playlist period recovery must not depend on PostgreSQL column order.");

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
  "bc8b7290a42997ddb209e4a48572d439bcfcd9f42df0f6b8852fba35d94f1815",
  "6d77a7ab382e9d116612528803459d163cbac50842cf4f65dab52c46a0916109",
  "54e2f9b95069eafae35f44bd6994c1ee3b0fc2941bf00ee469e248b7d580c445",
  "27232cb3b7352a2cec5ab0e5a2d3df3cf5f87f1822eed37ac15be8f5cb11f691",
  "ba4aae91a172ca1255557331576986111a1b392b2697ad55f39b701f98fba1e3",
  "2d3fb14a9d86f50273a48f62f6ab9490429b4301b90fcda12b756e603ad15200"
]) assert.ok(verifier.includes(recoveryHash), `Missing frozen Mahoraga recovery hash: ${recoveryHash}`);
assert.ok(verifier.includes("21c237b9db3a8d79a307317b8f96f25508497953a41c8ede5308ce209b56a55a"), "Legacy production-order fingerprint provenance must remain documented.");
assert.ok(verifier.includes("14e0d658369774667efb447cf6e2f542038ef70b06420c3d055ca48f923aa6a0"), "Legacy MetaImportFile local-time fingerprint provenance must remain documented.");
for (const legacyHash of [
  "bcc843e06dcca671c314fefe5fb79b33b2de9933b7b3b20be992ab798cd7410c",
  "989c5f7c8f8018e015887fcd259ba3d2da057a814d055919cb74c272c7ffa5e3",
  "1fc580eee99f029e7a2fe369522c0e444cc3fdae0a2527ce9cd1ca7475ce0b9b",
  "24ef8079921d8fd884674b15dec4001e3054194eca8e8737fa5cb93ede20157b",
  "11ab6b6bee8d574631735e87a87bd89c1b853d042f1dc447e9fa5c806abc9e62"
]) assert.ok(verifier.includes(legacyHash), `Legacy representation-dependent fingerprint provenance missing: ${legacyHash}`);
for (const canonicalHash of [
  "7e0b12f145e2d528f985067bfb8c370b551bab2b4b330d1db072c1155d548530",
  "c4240fd0b977d84f48ca895bb5cfa468c294c4d1b12244abcebbb5f410d9cce3",
  "a32fa8d15ffac1a213cce6ae0c51e9c6c5b9137357cb0e73ad3d887d5d17921d",
  "c24faf9bc5be7cb3c1f4a811e51b4fb9e0624d61668b232266fb4d271548ab37",
  "173c1447c53e73ad0dc1e3f6b0f50d879fc1794c15c43d7b4b6450b61d7cdfb7",
  "7671a87dd100a484de988a61d8512201208ca5809cada4e491f8837c3fa3684c"
]) assert.ok(verifier.includes(canonicalHash), `Missing canonical Spotify recovery hash: ${canonicalHash}`);
for (const legacyHash of [
  "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f",
  "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923",
  "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea",
  "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2",
  "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6",
  "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"
]) assert.ok(verifier.includes(legacyHash), `Legacy Spotify representation-dependent fingerprint provenance missing: ${legacyHash}`);
for (const canonicalHash of [
  "6558d5d13cb45b7a5e6e0764433bf772e8e8773e983cd6d346aed32c69dbf376",
  "2cbb81da19b71064e24bb34a0be86fbe9f7d5e0819ee86e217002983c0e7754b"
]) assert.ok(verifier.includes(canonicalHash), `Missing canonical Game Over recovery hash: ${canonicalHash}`);
for (const legacyHash of [
  "136b64539363c48dfcc1fb2f2554980c78fdea258660c299db1d42bc418e663b",
  "6fd1a9d27d68c4ccf69156cedcc82fb9fd4efeb1d5a9bc67a7bbe34e63676277"
]) assert.ok(verifier.includes(legacyHash), `Legacy Game Over representation-dependent fingerprint provenance missing: ${legacyHash}`);

console.log(JSON.stringify({suite: "backup-verification-workflow", manualOnly: true, pinnedActions: true, randomEntropyBytes: 48, githubTokenReused: false, loopbackOnly: true, teardownAlways: true, restoredBaselineContract: true}));
