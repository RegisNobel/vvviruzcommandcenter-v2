import assert from "node:assert/strict";
import crypto from "node:crypto";

import pg from "pg";

import googleDriveRetrieval from "../lib/backups/google-drive-retrieval.ts";

process.env.TZ = "America/New_York";

const DIAGNOSTIC_GATE = "E2.1G";
const APPROVED = Object.freeze({
  backupRunId: "70e04de9-3ab8-459c-971b-c23cd404a04e",
  encryptedSha256: "efb7561a0f0279692b873fa178801432668dfe8e1ba8c31461d891b1de7d32a0",
  sizeBytes: 5_975_016,
  gameOverMetaImportId: "e2a5a408-02ea-426b-910a-2015124877ad"
});
const EXPECTED_SPOTIFY = Object.freeze({
  analyticsImports: {count: 5, sha256: "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f"},
  artistTimeline: {count: 944, sha256: "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923"},
  mahoragaTrackTimeline: {count: 944, sha256: "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea"},
  songsPeriod: {count: 27, sha256: "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2"},
  playlistsPeriod: {count: 8, sha256: "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6"},
  gameOverTrackTimeline: {count: 952, sha256: "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"}
});
const {Client} = pg;
const {
  readNormalizedGoogleDriveOAuthCredentials,
  sanitizedBackupRetrievalFailure,
  verifyPinnedGoogleDriveBackupMetadata
} = googleDriveRetrieval;
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
let phase = "disabled";
let client;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required trusted runtime configuration ${name} is absent.`);
  return value;
}

function productionConnectionOptions(value) {
  const parsed = new URL(value);
  assert.ok(parsed.hostname.endsWith("pooler.supabase.com"), "Production identity hostname guard failed.");
  assert.equal(parsed.port, "5432", "Production identity port guard failed.");
  assert.ok(decodeURIComponent(parsed.username).includes("qkwifxvfrotmmnjluhbt"), "Production identity project guard failed.");
  parsed.searchParams.delete("sslmode");
  return {connectionString: parsed.toString(), ssl: {rejectUnauthorized: false}};
}

async function spotifyFingerprint(db) {
  const queries = {
    analyticsImports: `SELECT id,"fileHash","importType",status,"rowCount","acceptedRowCount","rejectedRowCount","unmatchedRowCount","warningCount","acceptedAt","withdrawnAt","replacedByImportId" FROM "AnalyticsImport" ORDER BY id`,
    artistTimeline: `SELECT o.* FROM "ArtistMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" WHERE i.status='IMPORTED' ORDER BY o.id`,
    mahoragaTrackTimeline: `SELECT o.* FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title ILIKE '%mahoraga%' ORDER BY o.id`,
    songsPeriod: `SELECT s.* FROM "SongPeriodSnapshot" s JOIN "AnalyticsImport" i ON i.id=s."importId" WHERE i.status='IMPORTED' ORDER BY s.id`,
    playlistsPeriod: `SELECT p.* FROM "PlaylistPeriodSnapshot" p JOIN "AnalyticsImport" i ON i.id=p."importId" WHERE i.status='IMPORTED' ORDER BY p.id`,
    gameOverTrackTimeline: `SELECT o.* FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title='Game Over' ORDER BY o.id`
  };
  const result = {};
  for (const [key, sql] of Object.entries(queries)) {
    const rows = (await db.query(sql)).rows;
    result[key] = {count: rows.length, sha256: digest(rows)};
  }
  return result;
}

async function readProductionBaseline(db) {
  const counts = (await db.query(`SELECT
    (SELECT count(*)::int FROM "AdImportBatch") batches,
    (SELECT count(*)::int FROM "AdCreativeReport") reports,
    (SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links,
    (SELECT count(*)::int FROM "MetaPromotionLink") meta_links,
    (SELECT count(*)::int FROM "PromotionCampaign") campaigns,
    (SELECT count(*)::int FROM "CampaignActiveInterval" WHERE "confirmationStatus"='CONFIRMED') confirmed_intervals,
    (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT') current_timezones`)).rows[0];
  const gameOver = (await db.query(`SELECT count(*)::int facts,round(sum(o.spend)::numeric,2)::text spend
    FROM "MetaDailySourceObservation" o JOIN "MetaDailyResolution" r ON r."currentObservationId"=o.id
    WHERE o."importBatchId"=$1 AND o."metricKey"='SPEND'`, [APPROVED.gameOverMetaImportId])).rows[0];
  const mahoragaFacts = (await db.query(`SELECT count(*)::int count FROM "MetaDailyResolution" r
    JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId"
    JOIN "AdImportBatch" b ON b.id=o."importBatchId"
    WHERE b."releaseId"=(SELECT id FROM "Release" WHERE title ILIKE '%mahoraga%' ORDER BY id LIMIT 1)
      AND b."sourceGranularity"='DAILY'`)).rows[0].count;
  const spotify = await spotifyFingerprint(db);
  return {counts, gameOver, mahoragaFacts, spotify};
}

function assertProductionBaseline(baseline) {
  assert.deepEqual(baseline.counts, {batches: 18, reports: 360, copy_links: 109, meta_links: 0, campaigns: 0, confirmed_intervals: 0, current_timezones: 1});
  assert.deepEqual(baseline.gameOver, {facts: 210, spend: "283.48"});
  assert.equal(baseline.mahoragaFacts, 0);
  for (const key of Object.keys(EXPECTED_SPOTIFY)) assert.deepEqual(baseline.spotify[key], EXPECTED_SPOTIFY[key]);
}

if (process.env.BACKUP_OAUTH_PROVENANCE_DIAGNOSTIC !== DIAGNOSTIC_GATE) {
  console.log(JSON.stringify({gate: "BACKUP_OAUTH_PROVENANCE_DIAGNOSTIC", status: "disabled"}));
  process.exit(0);
}

try {
  phase = "production-baseline";
  client = new Client(productionConnectionOptions(required("POSTGRES_URL_NON_POOLING")));
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const baseline = await readProductionBaseline(client);
  assertProductionBaseline(baseline);
  const backup = (await client.query(`SELECT id,status,"googleDriveFileId","sizeBytes","checksumSha256" FROM "BackupRun" WHERE id=$1`, [APPROVED.backupRunId])).rows[0];
  assert.equal(backup?.id, APPROVED.backupRunId);
  assert.equal(backup.status, "success");
  assert.equal(Number(backup.sizeBytes), APPROVED.sizeBytes);
  assert.equal(backup.checksumSha256, APPROVED.encryptedSha256);
  assert.ok(typeof backup.googleDriveFileId === "string" && backup.googleDriveFileId.length > 0);
  await client.query("COMMIT");
  await client.end(); client = undefined;

  const credentialState = readNormalizedGoogleDriveOAuthCredentials();
  const clientIdStructurallyValid = /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(credentialState.credentials.clientId);
  assert.equal(clientIdStructurallyValid, true, "Google OAuth client ID structure is invalid.");
  phase = "oauth-refresh";
  const trusted = await verifyPinnedGoogleDriveBackupMetadata({
    credentials: credentialState.credentials,
    expectedFileId: backup.googleDriveFileId,
    expectedSize: APPROVED.sizeBytes,
    onPhase: (nextPhase) => { phase = nextPhase; }
  });
  assert.equal(trusted.metadata.sizeBytes, APPROVED.sizeBytes, "Pinned Drive object size is unavailable or mismatched.");
  console.log(JSON.stringify({
    gate: "BACKUP_OAUTH_PROVENANCE_DIAGNOSTIC",
    status: "success",
    classification: "TRUSTED_RUNTIME_OAUTH_VALID",
    production: {identityVerified: true, transaction: "READ ONLY", writes: 0, baseline},
    oauth: {success: true, httpStatus: trusted.oauthHttpStatus, identifier: "TOKEN_REFRESH_SUCCEEDED", retryable: false},
    drive: {success: true, fileIdMatched: trusted.metadata.fileIdMatched, notTrashed: !trusted.metadata.trashed, objectTypeValid: true, sizeBytes: trusted.metadata.sizeBytes, httpStatus: trusted.metadata.httpStatus},
    credentialStructure: {variablesPresent: true, clientIdStructurallyValid, normalization: credentialState.normalization},
    security: {credentialsPrinted: false, credentialsMoved: false, fileDownloaded: false, encryptedIntegrityChecked: false, decrypted: false, restored: false}
  }));
} catch (error) {
  try { await client?.query("ROLLBACK"); } catch {}
  const retrieval = sanitizedBackupRetrievalFailure(error);
  console.error(JSON.stringify({
    gate: "BACKUP_OAUTH_PROVENANCE_DIAGNOSTIC",
    status: "failed-safe",
    phase: retrieval?.phase ?? phase,
    classification: "TRUSTED_RUNTIME_DIAGNOSTIC_FAILED",
    retrievalCode: retrieval?.code,
    httpStatus: retrieval?.httpStatus,
    oauthError: retrieval?.oauthError,
    retryable: retrieval?.retryable,
    security: {credentialsPrinted: false, credentialsMoved: false, fileDownloaded: false, decrypted: false, restored: false}
  }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
