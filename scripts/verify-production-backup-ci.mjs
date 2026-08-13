import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

import backupVerificationIntegrity from "../lib/backups/backup-verification-integrity.ts";
import gameOverDateCoverage from "../lib/backups/game-over-date-coverage.ts";
import googleDriveRetrieval from "../lib/backups/google-drive-retrieval.ts";
import restoreImportContract from "../lib/backups/restore-import-contract.ts";

process.env.TZ = "America/New_York";

const {verifyAndDecodeBackup} = backupVerificationIntegrity;
const {readTrackDateCoverage} = gameOverDateCoverage;
const {
  requireZeroRestoreProvenanceWarnings,
  RestoreImportInvariantError,
  runSanitizedSubprocess
} = restoreImportContract;
const {
  readNormalizedGoogleDriveOAuthCredentials,
  retrievePinnedEncryptedGoogleDriveBackup,
  sanitizedBackupRetrievalFailure
} = googleDriveRetrieval;
const {Client} = pg;
const APPROVED = Object.freeze({
  repository: "RegisNobel/vvviruzcommandcenter-v2",
  branch: "refs/heads/main",
  backupRunId: "f048a6db-fe5a-4d6a-9462-0701a69849cb",
  encryptedSha256: "ea28eedcb1ed9f15b8e38098406bdff5f35900d4fdeeb33a56ac4eaa7fcb73db",
  sizeBytes: 6_621_090,
  gameOverMetaImportId: "e2a5a408-02ea-426b-910a-2015124877ad",
  gameOverSpotifyImportId: "a060e608-24f4-4f79-8a3b-fceface408c9",
  gameOverReleaseId: "7814c0e7-b8b1-44d7-ad44-4d0197c5330f",
  mahoragaMetaImportId: "0ce03ec0-4f46-4857-af66-7ab2f8a106bd",
  mahoragaReleaseId: "66122bdb-95f2-432b-84a3-c97ff38d01cd",
  gameOverTimeline: Object.freeze({
    observationCount: 952,
    distinctDateCount: 952,
    earliestDate: "2024-01-01",
    latestDate: "2026-08-09"
  })
});
const EXPECTED_SPOTIFY = Object.freeze({
  analyticsImports: {count: 5, sha256: "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f"},
  artistTimeline: {count: 944, sha256: "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923"},
  mahoragaTrackTimeline: {count: 944, sha256: "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea"},
  songsPeriod: {count: 27, sha256: "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2"},
  playlistsPeriod: {count: 8, sha256: "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6"},
  gameOverTrackTimeline: {count: 952, sha256: "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"}
});
const EXPECTED_MAHORAGA_RECOVERY = Object.freeze({
  importIdentityAcceptance: "21c237b9db3a8d79a307317b8f96f25508497953a41c8ede5308ce209b56a55a",
  fileAndRawReferenceMetadata: "14e0d658369774667efb447cf6e2f542038ef70b06420c3d055ca48f923aa6a0",
  normalizedSourceRows: "bcc843e06dcca671c314fefe5fb79b33b2de9933b7b3b20be992ab798cd7410c",
  sourceObservations: "989c5f7c8f8018e015887fcd259ba3d2da057a814d055919cb74c272c7ffa5e3",
  currentResolutions: "1fc580eee99f029e7a2fe369522c0e444cc3fdae0a2527ce9cd1ca7475ce0b9b",
  resolutionEventHistory: "24ef8079921d8fd884674b15dec4001e3054194eca8e8737fa5cb93ede20157b",
  compatibilityReports: "11ab6b6bee8d574631735e87a87bd89c1b853d042f1dc447e9fa5c806abc9e62"
});
const FORBIDDEN_ENV = [
  "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "VERCEL", "VERCEL_ENV",
  "BLOB_READ_WRITE_TOKEN", "AUTH_SECRET", "ADMIN_TOTP_SECRET", "SUPABASE_SERVICE_ROLE_KEY"
];
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
let phase = "configuration";
let encrypted;
let snapshot;
let client;
let credentialNormalization;

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

function run(command, args, env, input) {
  return runSanitizedSubprocess(command, args, env, input);
}

function invariant(code, actual, expected) {
  phase = code;
  assert.deepEqual(actual, expected);
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
    (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId" IN ($1,$2)) dual_release_provenance_files,
    (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId" IN ($1,$2) AND "rawStorageKey"<>'' AND "rawStorageSha256"<>'') dual_release_raw_provenance_files,
    (SELECT count(*)::int FROM "MetaImportAuditEvent" WHERE "importBatchId"=$1 AND action='IMPORT_ACCEPTED') acceptance_audits,
    (SELECT count(*)::int FROM "MetaImportAuditEvent" WHERE "importBatchId"=$2 AND action='IMPORT_ACCEPTED') mahoraga_acceptance_audits,
    (SELECT count(*)::int FROM "MetaDailyResolution" r JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"=(SELECT id FROM "Release" WHERE title ILIKE '%mahoraga%' ORDER BY id LIMIT 1) AND b."sourceGranularity"='DAILY') mahoraga_facts,
    (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT' AND "accountId"='367019114407672' AND "ianaTimezone"='America/Los_Angeles') timezone_matches,
    (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT') current_timezones`, [APPROVED.gameOverMetaImportId, APPROVED.mahoragaMetaImportId])).rows[0];
  phase = "state-mahoraga-meta";
  const mahoragaMeta = (await db.query(`SELECT b.id,b."releaseId",b."importState",b."validationState",b."sourceAsOfOrigin",
    to_char(b."reportingStart",'YYYY-MM-DD') "reportingStart",to_char(b."reportingEnd",'YYYY-MM-DD') "reportingEnd",
    count(*)::int facts,count(*) FILTER (WHERE o.spend>0)::int positive,count(*) FILTER (WHERE o.spend=0)::int explicit_zero,
    count(*) FILTER (WHERE o.spend IS NULL)::int missing,round(sum(o.spend)::numeric,2)::text spend,
    count(DISTINCT o."adId")::int ad_count,min(o."sourceReportingDate") start_date,max(o."sourceReportingDate") end_date,
    count(*) FILTER (WHERE o."adName"='mahoraga_cover_verse1_rev1' AND o."metricDate"='2026-08-10'::date AND o.spend=3.84)::int corrected_aug_10,
    count(*) FILTER (WHERE o."adName"='mahoraga_cover_verse1_rev1' AND o."metricDate"='2026-08-10'::date AND o.spend=2.71)::int stale_aug_10
    FROM "AdImportBatch" b JOIN "MetaDailySourceObservation" o ON o."importBatchId"=b.id AND o."metricKey"='SPEND'
    JOIN "MetaDailyResolution" r ON r."currentObservationId"=o.id WHERE b.id=$1 GROUP BY b.id`, [APPROVED.mahoragaMetaImportId])).rows[0];
  const mahoragaImport = (await db.query(`SELECT * FROM "AdImportBatch" WHERE id=$1 ORDER BY id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaFiles = (await db.query(`SELECT * FROM "MetaImportFile" WHERE "importBatchId"=$1 ORDER BY id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaSourceRows = (await db.query(`SELECT r.* FROM "MetaImportFileRow" r JOIN "MetaImportFile" f ON f.id=r."importFileId" WHERE f."importBatchId"=$1 ORDER BY r."importFileId",r."sourceRowNumber",r.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaObservations = (await db.query(`SELECT * FROM "MetaDailySourceObservation" WHERE "importBatchId"=$1 ORDER BY "identityKey",id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaResolutions = (await db.query(`SELECT r.* FROM "MetaDailyResolution" r JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY r."identityKey",r.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaEvents = (await db.query(`SELECT e.* FROM "MetaDailyResolutionEvent" e JOIN "MetaDailyResolution" r ON r.id=e."resolutionId" JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY e."resolutionId",e."createdAt",e.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaReports = (await db.query(`SELECT * FROM "AdCreativeReport" WHERE "importBatchId"=$1 ORDER BY id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaRecovery = {
    importIdentityAcceptance: digest(mahoragaImport),
    fileAndRawReferenceMetadata: digest(mahoragaFiles),
    normalizedSourceRows: digest(mahoragaSourceRows),
    sourceObservations: digest(mahoragaObservations),
    currentResolutions: digest(mahoragaResolutions),
    resolutionEventHistory: digest(mahoragaEvents),
    compatibilityReports: digest(mahoragaReports)
  };
  const mahoragaRecoveryCounts = {files:mahoragaFiles.length,sourceRows:mahoragaSourceRows.length,observations:mahoragaObservations.length,resolutions:mahoragaResolutions.length,events:mahoragaEvents.length,reports:mahoragaReports.length};
  phase = "state-game-over-spotify";
  const gameOverSpotify = (await db.query(`SELECT i.id import_id,i."importType" import_type,i.status import_state,i."fileHash" file_hash,r.id release_id,r.title,r.isrc
    FROM "AnalyticsImport" i JOIN "TrackMetricObservation" o ON o."importId"=i.id
    JOIN "Release" r ON r.id=o."releaseId" WHERE i.id=$1 GROUP BY i.id,r.id`, [APPROVED.gameOverSpotifyImportId])).rows[0];
  Object.assign(gameOverSpotify, await readTrackDateCoverage(
    db,
    APPROVED.gameOverSpotifyImportId,
    APPROVED.gameOverTimeline.earliestDate,
    APPROVED.gameOverTimeline.latestDate
  ));
  const fullImport = (await db.query(`SELECT * FROM "AnalyticsImport" WHERE id=$1`, [APPROVED.gameOverSpotifyImportId])).rows[0];
  const releases = (await db.query(`SELECT DISTINCT r.id,r.title,r.slug,r.isrc,r."spotifyUrl",r."primaryArtistProfileId" FROM "TrackMetricObservation" o JOIN "Release" r ON r.id=o."releaseId" WHERE o."importId"=$1 ORDER BY r.id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const auditEvents = (await db.query(`SELECT * FROM "MappingAuditEvent" WHERE "importId"=$1 ORDER BY "createdAt",id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const mappingRows = (await db.query(`SELECT * FROM "AnalyticsImportRow" WHERE "importId"=$1 ORDER BY "sourceRowNumber",id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const metadata = JSON.parse(fullImport.metadata || "{}");
  gameOverSpotify.import_fingerprint = digest(fullImport);
  gameOverSpotify.audit_provenance_fingerprint = digest({importId:fullImport.id,importType:fullImport.importType,fileHash:fullImport.fileHash,actorId:fullImport.uploadedById,actorUsername:fullImport.uploadedByUsername,releaseIds:releases.map((row)=>row.id),auditEvents,mappingRows,commitIdempotencyKey:fullImport.commitIdempotencyKey,confirmations:metadata.confirmations||null,previewResultChecksum:metadata.previewResultChecksum||null});
  gameOverSpotify.mapping_row_count = mappingRows.length;
  const spotify = await spotifyFingerprint(db);
  return {counts, gameOverMeta, mahoragaMeta, details, mahoragaRecovery, mahoragaRecoveryCounts, gameOverSpotify, spotify, fingerprint: digest({counts, gameOverMeta, mahoragaMeta, details, mahoragaRecovery, mahoragaRecoveryCounts, gameOverSpotify, spotify})};
}

function assertExpected(state) {
  invariant("FOUNDATION_COUNT_MISMATCH", state.counts, {batches:19,legacy_batches:17,daily_imports:2,reports:1212,copy_links:109,source_observations:1188,resolutions:1188,meta_links:0,campaigns:0,confirmed_intervals:0});
  invariant("GAME_OVER_META_CONTRACT_MISMATCH", state.gameOverMeta, {id:APPROVED.gameOverMetaImportId,importState:"ACCEPTED",validationState:"ACCEPTED",sourceAsOfOrigin:"IMPORT_ACCEPTED_FALLBACK",reportingStart:"2026-07-11",reportingEnd:"2026-08-09",facts:210,positive:60,explicit_zero:150,missing:0,spend:"283.48",ad_set_count:1,ad_set_id:"120247925536670172",start_date:"2026-07-11",end_date:"2026-08-09"});
  invariant("MAHORAGA_META_CONTRACT_MISMATCH", state.mahoragaMeta, {id:APPROVED.mahoragaMetaImportId,releaseId:APPROVED.mahoragaReleaseId,importState:"ACCEPTED",validationState:"ACCEPTED",sourceAsOfOrigin:"IMPORT_ACCEPTED_FALLBACK",reportingStart:"2026-06-01",reportingEnd:"2026-08-10",facts:852,positive:110,explicit_zero:742,missing:0,spend:"827.18",ad_count:12,start_date:"2026-06-01",end_date:"2026-08-10",corrected_aug_10:1,stale_aug_10:0});
  invariant("META_PROVENANCE_CONTRACT_MISMATCH", state.details, {provenance_files:4,raw_provenance_files:4,dual_release_provenance_files:8,dual_release_raw_provenance_files:8,acceptance_audits:1,mahoraga_acceptance_audits:1,mahoraga_facts:933,timezone_matches:1,current_timezones:1});
  invariant("MAHORAGA_RECOVERY_COUNT_MISMATCH", state.mahoragaRecoveryCounts, {files:4,sourceRows:1215,observations:933,resolutions:933,events:933,reports:852});
  for (const key of Object.keys(EXPECTED_MAHORAGA_RECOVERY)) invariant(`MAHORAGA_${key.toUpperCase()}_FINGERPRINT_MISMATCH`, state.mahoragaRecovery[key], EXPECTED_MAHORAGA_RECOVERY[key]);
  invariant("DUAL_RELEASE_SPEND_MISMATCH", (Number(state.gameOverMeta.spend)+Number(state.mahoragaMeta.spend)).toFixed(2), "1110.66");
  invariant("GAME_OVER_SPOTIFY_IMPORT_ID_MISMATCH", state.gameOverSpotify.import_id, APPROVED.gameOverSpotifyImportId);
  invariant("GAME_OVER_SPOTIFY_RELEASE_ID_MISMATCH", state.gameOverSpotify.release_id, APPROVED.gameOverReleaseId);
  invariant("GAME_OVER_SPOTIFY_TITLE_MISMATCH", state.gameOverSpotify.title, "Game Over");
  invariant("GAME_OVER_SPOTIFY_IMPORT_TYPE_MISMATCH", state.gameOverSpotify.import_type, "TRACK_STREAM_TIMELINE");
  invariant("GAME_OVER_SPOTIFY_IMPORT_STATE_MISMATCH", state.gameOverSpotify.import_state, "IMPORTED");
  invariant("GAME_OVER_SPOTIFY_ISRC_MISMATCH", state.gameOverSpotify.isrc, "QT6ED2602112");
  invariant("GAME_OVER_SPOTIFY_FILE_HASH_MISMATCH", state.gameOverSpotify.file_hash, "15a4bedaea68451030ede560ec8e648f925ea9349ff1973bd1aaf0cfaf3b3f16");
  invariant("GAME_OVER_SPOTIFY_OBSERVATION_COUNT_MISMATCH", state.gameOverSpotify.observation_count, APPROVED.gameOverTimeline.observationCount);
  invariant("GAME_OVER_SPOTIFY_DISTINCT_DATE_COUNT_MISMATCH", state.gameOverSpotify.distinct_date_count, APPROVED.gameOverTimeline.distinctDateCount);
  invariant("GAME_OVER_SPOTIFY_EARLIEST_DATE_MISMATCH", state.gameOverSpotify.earliest_date, APPROVED.gameOverTimeline.earliestDate);
  invariant("GAME_OVER_SPOTIFY_LATEST_DATE_MISMATCH", state.gameOverSpotify.latest_date, APPROVED.gameOverTimeline.latestDate);
  invariant("GAME_OVER_SPOTIFY_DUPLICATE_DATE_MISMATCH", state.gameOverSpotify.duplicate_date_count, 0);
  invariant("GAME_OVER_SPOTIFY_MISSING_DATE_MISMATCH", state.gameOverSpotify.missing_date_count, 0);
  invariant("GAME_OVER_SPOTIFY_MAPPING_ROW_COUNT_MISMATCH", state.gameOverSpotify.mapping_row_count, 0);
  invariant("GAME_OVER_IMPORT_FINGERPRINT_MISMATCH", state.gameOverSpotify.import_fingerprint, "136b64539363c48dfcc1fb2f2554980c78fdea258660c299db1d42bc418e663b");
  invariant("GAME_OVER_PROVENANCE_FINGERPRINT_MISMATCH", state.gameOverSpotify.audit_provenance_fingerprint, "6fd1a9d27d68c4ccf69156cedcc82fb9fd4efeb1d5a9bc67a7bbe34e63676277");
  for (const key of Object.keys(EXPECTED_SPOTIFY)) {
    const code = key === "gameOverTrackTimeline" ? "GAME_OVER_TIMELINE_FINGERPRINT_MISMATCH" : `SPOTIFY_${key.toUpperCase()}_FINGERPRINT_MISMATCH`;
    invariant(code, state.spotify[key], EXPECTED_SPOTIFY[key]);
  }
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

  const credentialState = readNormalizedGoogleDriveOAuthCredentials();
  credentialNormalization = credentialState.normalization;
  encrypted = await retrievePinnedEncryptedGoogleDriveBackup({
    credentials: credentialState.credentials,
    expectedFileId: required("APPROVED_GOOGLE_DRIVE_FILE_ID"),
    expectedSize: APPROVED.sizeBytes,
    expectedSha256: APPROVED.encryptedSha256,
    onPhase: (nextPhase) => { phase = nextPhase; }
  });
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
  const importResult = run(process.execPath, ["--conditions=react-server","--import","tsx","scripts/import-db-snapshot.ts"], {...targetEnv,DB_SNAPSHOT_STDIN:"1",IMPORT_AUTH:"1"}, snapshot);
  try {
    requireZeroRestoreProvenanceWarnings(importResult);
  } catch (error) {
    if (error instanceof RestoreImportInvariantError) phase = error.invariantCode;
    throw error;
  }

  phase = "restored-verification";
  client = new Client({connectionString: targetUrl}); await client.connect();
  const restored = await restoredState(client);
  assertExpected(restored);
  const tableCount = (await client.query("SELECT count(*)::int count FROM pg_tables WHERE schemaname='public'")).rows[0].count;
  await client.end(); client = undefined;
  const finishedAt = new Date();
  console.log(JSON.stringify({gate:"BACKUP_RESTORE_VERIFICATION",status:"success",backup:{runId:APPROVED.backupRunId,sizeBytes:APPROVED.sizeBytes,encryptedSha256:APPROVED.encryptedSha256},target:{hostClass:"job-local-postgresql",majorVersion:17,tableCount,prefixVerified:true},restored,credentialNormalization,security:{productionCredentialsAvailable:false,productionWrites:0,plaintextFilesCreated:0,artifactsUploaded:0,credentialsPrinted:false},timing:{startedAt:startedAt.toISOString(),finishedAt:finishedAt.toISOString(),durationMs:finishedAt-startedAt}},null,2));
} catch (error) {
  const retrieval = sanitizedBackupRetrievalFailure(error);
  const classification = error instanceof assert.AssertionError ? "INVARIANT_MISMATCH" : error instanceof SyntaxError ? "INVALID_BACKUP_PAYLOAD" : "VERIFICATION_OPERATION_FAILED";
  const databaseCode = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : undefined;
  console.error(JSON.stringify({gate:"BACKUP_RESTORE_VERIFICATION",status:"failed-safe",phase:retrieval?.phase??phase,classification,retrievalCode:retrieval?.code,httpStatus:retrieval?.httpStatus,oauthError:retrieval?.oauthError,retryable:retrieval?.retryable,credentialNormalization,databaseCode}));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
  snapshot?.fill(0);
  encrypted?.fill(0);
}
