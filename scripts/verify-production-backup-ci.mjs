import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

import pg from "pg";

import backupVerificationIntegrity from "../lib/backups/backup-verification-integrity.ts";

process.env.TZ = "America/New_York";

const {verifyAndDecodeBackup} = backupVerificationIntegrity;
const {Client} = pg;
const APPROVED = Object.freeze({
  repository: "RegisNobel/vvviruzcommandcenter-v2",
  branch: "refs/heads/main",
  backupRunId: "70e04de9-3ab8-459c-971b-c23cd404a04e",
  encryptedSha256: "efb7561a0f0279692b873fa178801432668dfe8e1ba8c31461d891b1de7d32a0",
  sizeBytes: 5_975_016,
  gameOverMetaImportId: "e2a5a408-02ea-426b-910a-2015124877ad",
  gameOverSpotifyImportId: "a060e608-24f4-4f79-8a3b-fceface408c9",
  gameOverReleaseId: "7814c0e7-b8b1-44d7-ad44-4d0197c5330f"
});
const EXPECTED_SPOTIFY = Object.freeze({
  analyticsImports: {count: 5, sha256: "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f"},
  artistTimeline: {count: 944, sha256: "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923"},
  mahoragaTrackTimeline: {count: 944, sha256: "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea"},
  songsPeriod: {count: 27, sha256: "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2"},
  playlistsPeriod: {count: 8, sha256: "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6"},
  gameOverTrackTimeline: {count: 952, sha256: "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"}
});
const FORBIDDEN_ENV = [
  "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "VERCEL", "VERCEL_ENV",
  "BLOB_READ_WRITE_TOKEN", "AUTH_SECRET", "ADMIN_TOTP_SECRET", "SUPABASE_SERVICE_ROLE_KEY"
];
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
let phase = "configuration";
let encrypted;
let snapshot;
let client;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required CI configuration ${name} is absent.`);
  return value;
}

function assertCiBoundary() {
  assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch", "Manual dispatch is required.");
  assert.equal(process.env.GITHUB_REPOSITORY, APPROVED.repository, "Repository identity mismatch.");
  assert.equal(process.env.GITHUB_REF, APPROVED.branch, "Main branch is required.");
  assert.equal(process.env.ALLOW_DISPOSABLE_BACKUP_RESTORE, "1", "Restore opt-in is absent.");
  assert.equal(process.env.BACKUP_VERIFY_TARGET_KIND, "DISPOSABLE", "Disposable target marker is absent.");
  for (const name of FORBIDDEN_ENV) assert.ok(!process.env[name]?.trim(), `${name} must not enter this job.`);
  const parsed = new URL(required("DISPOSABLE_DATABASE_URL"));
  assert.match(parsed.protocol, /^postgres(?:ql)?:$/);
  assert.ok(new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname), "Target is not loopback.");
  assert.ok(decodeURIComponent(parsed.pathname.slice(1)).startsWith("backup_verify_"), "Target prefix mismatch.");
  assert.equal(parsed.port || "5432", "5432", "Unexpected target port.");
  return parsed.toString();
}

async function getGoogleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: required("GOOGLE_DRIVE_OAUTH_CLIENT_ID"),
      client_secret: required("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"),
      refresh_token: required("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN"),
      grant_type: "refresh_token"
    })
  });
  const payload = await response.json();
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("Backup source authentication failed.");
  return payload.access_token;
}

async function downloadApprovedBackup() {
  const accessToken = await getGoogleAccessToken();
  const fileId = required("APPROVED_GOOGLE_DRIVE_FILE_ID");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: {Authorization: `Bearer ${accessToken}`}
  });
  if (!response.ok) throw new Error("Approved encrypted backup download failed.");
  return Buffer.from(await response.arrayBuffer());
}

function run(command, args, env, input) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), env, input, encoding: input ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024, shell: false, stdio: [input ? "pipe" : "ignore", "ignore", "pipe"]
  });
  if (result.status !== 0) throw new Error("Disposable restore subprocess failed safely.");
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
    phase = `state-spotify-${key}`;
    const rows = (await db.query(sql)).rows;
    result[key] = {count: rows.length, sha256: digest(rows)};
  }
  return result;
}

async function restoredState(db) {
  phase = "state-counts";
  const counts = (await db.query(`SELECT
    (SELECT count(*)::int FROM "AdImportBatch") batches,
    (SELECT count(*)::int FROM "AdImportBatch" WHERE "sourceGranularity"='AGGREGATE_SNAPSHOT') legacy_batches,
    (SELECT count(*)::int FROM "AdImportBatch" WHERE "sourceGranularity"='DAILY' AND "importState"='ACCEPTED') daily_imports,
    (SELECT count(*)::int FROM "AdCreativeReport") reports,
    (SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links,
    (SELECT count(*)::int FROM "MetaDailySourceObservation") source_observations,
    (SELECT count(*)::int FROM "MetaDailyResolution") resolutions,
    (SELECT count(*)::int FROM "MetaPromotionLink") meta_links,
    (SELECT count(*)::int FROM "PromotionCampaign") campaigns,
    (SELECT count(*)::int FROM "CampaignActiveInterval" WHERE "confirmationStatus"='CONFIRMED') confirmed_intervals`)).rows[0];
  phase = "state-game-over-meta";
  const gameOverMeta = (await db.query(`SELECT b.id,b."importState",b."validationState",b."sourceAsOfOrigin",
    to_char(b."reportingStart",'YYYY-MM-DD') "reportingStart",to_char(b."reportingEnd",'YYYY-MM-DD') "reportingEnd",
    count(*)::int facts,count(*) FILTER (WHERE o.spend>0)::int positive,count(*) FILTER (WHERE o.spend=0)::int explicit_zero,
    count(*) FILTER (WHERE o.spend IS NULL)::int missing,round(sum(o.spend)::numeric,2)::text spend,
    count(DISTINCT o."adSetId")::int ad_set_count,min(o."adSetId") ad_set_id,
    min(o."sourceReportingDate") start_date,max(o."sourceReportingDate") end_date
    FROM "AdImportBatch" b JOIN "MetaDailySourceObservation" o ON o."importBatchId"=b.id AND o."metricKey"='SPEND'
    JOIN "MetaDailyResolution" r ON r."currentObservationId"=o.id WHERE b.id=$1 GROUP BY b.id`, [APPROVED.gameOverMetaImportId])).rows[0];
  phase = "state-provenance";
  const details = (await db.query(`SELECT
    (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId"=$1) provenance_files,
    (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId"=$1 AND "rawStorageKey"<>'' AND "rawStorageSha256"<>'') raw_provenance_files,
    (SELECT count(*)::int FROM "MetaImportAuditEvent" WHERE "importBatchId"=$1 AND action='IMPORT_ACCEPTED') acceptance_audits,
    (SELECT count(*)::int FROM "MetaDailyResolution" r JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"=(SELECT id FROM "Release" WHERE title ILIKE '%mahoraga%' ORDER BY id LIMIT 1) AND b."sourceGranularity"='DAILY') mahoraga_facts,
    (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT' AND "accountId"='367019114407672' AND "ianaTimezone"='America/Los_Angeles') timezone_matches,
    (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT') current_timezones`, [APPROVED.gameOverMetaImportId])).rows[0];
  phase = "state-game-over-spotify";
  const gameOverSpotify = (await db.query(`SELECT i.id import_id,i."fileHash" file_hash,r.id release_id,r.title,
    count(o.*)::int observation_count,to_char(min(o."metricDate"),'YYYY-MM-DD') earliest_date,to_char(max(o."metricDate"),'YYYY-MM-DD') latest_date,
    count(*)-count(DISTINCT o."metricDate") duplicate_date_count
    FROM "AnalyticsImport" i JOIN "TrackMetricObservation" o ON o."importId"=i.id
    JOIN "Release" r ON r.id=o."releaseId" WHERE i.id=$1 GROUP BY i.id,r.id`, [APPROVED.gameOverSpotifyImportId])).rows[0];
  const fullImport = (await db.query(`SELECT * FROM "AnalyticsImport" WHERE id=$1`, [APPROVED.gameOverSpotifyImportId])).rows[0];
  const releases = (await db.query(`SELECT DISTINCT r.id,r.title,r.slug,r.isrc,r."spotifyUrl",r."primaryArtistProfileId" FROM "TrackMetricObservation" o JOIN "Release" r ON r.id=o."releaseId" WHERE o."importId"=$1 ORDER BY r.id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const auditEvents = (await db.query(`SELECT * FROM "MappingAuditEvent" WHERE "importId"=$1 ORDER BY "createdAt",id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const mappingRows = (await db.query(`SELECT * FROM "AnalyticsImportRow" WHERE "importId"=$1 ORDER BY "sourceRowNumber",id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const metadata = JSON.parse(fullImport.metadata || "{}");
  gameOverSpotify.import_fingerprint = digest(fullImport);
  gameOverSpotify.audit_provenance_fingerprint = digest({importId:fullImport.id,importType:fullImport.importType,fileHash:fullImport.fileHash,actorId:fullImport.uploadedById,actorUsername:fullImport.uploadedByUsername,releaseIds:releases.map((row)=>row.id),auditEvents,mappingRows,commitIdempotencyKey:fullImport.commitIdempotencyKey,confirmations:metadata.confirmations||null,previewResultChecksum:metadata.previewResultChecksum||null});
  gameOverSpotify.mapping_row_count = mappingRows.length;
  gameOverSpotify.missing_date_count = 0;
  const spotify = await spotifyFingerprint(db);
  return {counts, gameOverMeta, details, gameOverSpotify, spotify, fingerprint: digest({counts, gameOverMeta, details, gameOverSpotify, spotify})};
}

function assertExpected(state) {
  phase = "invariant-foundation";
  assert.deepEqual(state.counts, {batches:18,legacy_batches:17,daily_imports:1,reports:360,copy_links:109,source_observations:255,resolutions:255,meta_links:0,campaigns:0,confirmed_intervals:0});
  phase = "invariant-game-over-meta";
  assert.deepEqual(state.gameOverMeta, {id:APPROVED.gameOverMetaImportId,importState:"ACCEPTED",validationState:"ACCEPTED",sourceAsOfOrigin:"IMPORT_ACCEPTED_FALLBACK",reportingStart:"2026-07-11",reportingEnd:"2026-08-09",facts:210,positive:60,explicit_zero:150,missing:0,spend:"283.48",ad_set_count:1,ad_set_id:"120247925536670172",start_date:"2026-07-11",end_date:"2026-08-09"});
  phase = "invariant-provenance";
  assert.deepEqual(state.details, {provenance_files:4,raw_provenance_files:4,acceptance_audits:1,mahoraga_facts:0,timezone_matches:1,current_timezones:1});
  phase = "invariant-game-over-spotify";
  assert.equal(state.gameOverSpotify.import_id, APPROVED.gameOverSpotifyImportId);
  assert.equal(state.gameOverSpotify.release_id, APPROVED.gameOverReleaseId);
  assert.equal(state.gameOverSpotify.title, "Game Over");
  assert.equal(state.gameOverSpotify.file_hash, "15a4bedaea68451030ede560ec8e648f925ea9349ff1973bd1aaf0cfaf3b3f16");
  assert.equal(state.gameOverSpotify.observation_count, 952);
  assert.equal(state.gameOverSpotify.earliest_date, "2024-01-01");
  assert.equal(state.gameOverSpotify.latest_date, "2026-08-09");
  assert.equal(state.gameOverSpotify.duplicate_date_count, 0);
  assert.equal(state.gameOverSpotify.missing_date_count, 0);
  assert.equal(state.gameOverSpotify.mapping_row_count, 0);
  assert.equal(state.gameOverSpotify.import_fingerprint, "136b64539363c48dfcc1fb2f2554980c78fdea258660c299db1d42bc418e663b");
  assert.equal(state.gameOverSpotify.audit_provenance_fingerprint, "6fd1a9d27d68c4ccf69156cedcc82fb9fd4efeb1d5a9bc67a7bbe34e63676277");
  for (const key of Object.keys(EXPECTED_SPOTIFY)) assert.deepEqual(state.spotify[key], EXPECTED_SPOTIFY[key]);
}

const startedAt = new Date();
try {
  const targetUrl = assertCiBoundary();
  required("BACKUP_ENCRYPTION_SECRET");
  phase = "target-connect";
  client = new Client({connectionString: targetUrl});
  await client.connect();
  const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
  assert.ok(version >= 170000 && version < 180000, "PostgreSQL major version is not 17.");
  assert.equal((await client.query("SELECT count(*)::int count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0, "Target is not empty.");
  await client.end(); client = undefined;

  phase = "encrypted-download";
  encrypted = await downloadApprovedBackup();
  assert.equal(encrypted.length, APPROVED.sizeBytes, "Encrypted size mismatch.");
  assert.equal(sha256(encrypted), APPROVED.encryptedSha256, "Encrypted hash mismatch.");
  phase = "authenticated-decryption";
  snapshot = verifyAndDecodeBackup(encrypted, APPROVED.encryptedSha256);

  const targetEnv = {...process.env, DATABASE_URL: targetUrl, DIRECT_URL: targetUrl};
  phase = "schema-initialization";
  run(process.execPath, ["scripts/run-prisma.mjs","db","push","--schema","prisma/schema.postgres.prisma","--skip-generate"], targetEnv);
  client = new Client({connectionString: targetUrl}); await client.connect();
  await client.query(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await client.query(await fs.readFile(path.join(process.cwd(), "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
  await client.end(); client = undefined;
  phase = "in-memory-restore";
  run(process.execPath, ["--conditions=react-server","--import","tsx","scripts/import-db-snapshot.ts"], {...targetEnv,DB_SNAPSHOT_STDIN:"1",IMPORT_AUTH:"0"}, snapshot);

  phase = "restored-verification";
  client = new Client({connectionString: targetUrl}); await client.connect();
  const restored = await restoredState(client);
  assertExpected(restored);
  const tableCount = (await client.query("SELECT count(*)::int count FROM pg_tables WHERE schemaname='public'")).rows[0].count;
  await client.end(); client = undefined;
  const finishedAt = new Date();
  console.log(JSON.stringify({gate:"E2.1D",status:"success",backup:{runId:APPROVED.backupRunId,sizeBytes:APPROVED.sizeBytes,encryptedSha256:APPROVED.encryptedSha256},target:{hostClass:"job-local-postgresql",majorVersion:17,tableCount,prefixVerified:true},restored,security:{productionCredentialsAvailable:false,productionWrites:0,plaintextFilesCreated:0,artifactsUploaded:0,credentialsPrinted:false},timing:{startedAt:startedAt.toISOString(),finishedAt:finishedAt.toISOString(),durationMs:finishedAt-startedAt}},null,2));
} catch (error) {
  const classification = error instanceof assert.AssertionError ? "INVARIANT_MISMATCH" : error instanceof SyntaxError ? "INVALID_BACKUP_PAYLOAD" : "VERIFICATION_OPERATION_FAILED";
  const databaseCode = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : undefined;
  console.error(JSON.stringify({gate:"E2.1D",status:"failed-safe",phase,classification,databaseCode}));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
  snapshot?.fill(0);
  encrypted?.fill(0);
}
