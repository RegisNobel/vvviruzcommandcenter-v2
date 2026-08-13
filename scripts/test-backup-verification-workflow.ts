import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/verify-production-backup.yml", "utf8");
const verifier = fs.readFileSync("scripts/verify-production-backup-ci.mjs", "utf8");

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
  'assert.equal(state.gameOverSpotify.import_type, "TRACK_STREAM_TIMELINE")',
  'assert.equal(state.gameOverSpotify.import_state, "IMPORTED")',
  'assert.equal(state.gameOverSpotify.isrc, "QT6ED2602112")',
  'assert.equal(state.gameOverSpotify.observation_count, 952)',
  'assert.equal(state.gameOverSpotify.earliest_date, "2024-01-01")',
  'assert.equal(state.gameOverSpotify.latest_date, "2026-08-09")',
  '91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de',
  'mahoragaTrackTimeline: {count: 944'
]) assert.ok(verifier.includes(expected), `Missing restored-baseline assertion: ${expected}`);

console.log(JSON.stringify({suite: "backup-verification-workflow", manualOnly: true, pinnedActions: true, randomEntropyBytes: 48, githubTokenReused: false, loopbackOnly: true, teardownAlways: true, restoredBaselineContract: true}));
