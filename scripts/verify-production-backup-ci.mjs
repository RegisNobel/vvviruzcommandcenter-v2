import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import adImportBatchRecovery from "../lib/backups/ad-import-batch-recovery-fingerprint.ts";
import backupVerifierPgClient from "../lib/backups/backup-verifier-pg-client.ts";
import backupVerificationIntegrity from "../lib/backups/backup-verification-integrity.ts";
import gameOverDateCoverage from "../lib/backups/game-over-date-coverage.ts";
import gameOverRecovery from "../lib/backups/game-over-recovery-fingerprints.ts";
import googleDriveRetrieval from "../lib/backups/google-drive-retrieval.ts";
import metaImportFileRecovery from "../lib/backups/meta-import-file-recovery-fingerprint.ts";
import metaRecoveryCollections from "../lib/backups/meta-recovery-collection-fingerprints.ts";
import restoreImportContract from "../lib/backups/restore-import-contract.ts";
import spotifyRecovery from "../lib/backups/spotify-recovery-fingerprints.ts";

const {verifyAndDecodeBackup} = backupVerificationIntegrity;
const {AD_IMPORT_BATCH_RECOVERY_SELECT, fingerprintAdImportBatchRecovery} = adImportBatchRecovery;
const {createBackupVerifierPgClient} = backupVerifierPgClient;
const {readTrackDateCoverage} = gameOverDateCoverage;
const {
  GAME_OVER_ANALYTICS_IMPORT_RECOVERY_SELECT,
  GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_SELECT,
  GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_SELECT,
  fingerprintGameOverAnalyticsImportRecovery,
  fingerprintGameOverProvenanceRecovery
} = gameOverRecovery;
const {META_IMPORT_FILE_RECOVERY_SELECT, fingerprintMetaImportFileRecovery} = metaImportFileRecovery;
const {
  AD_CREATIVE_REPORT_RECOVERY_SELECT,
  META_DAILY_RESOLUTION_EVENT_RECOVERY_SELECT,
  META_DAILY_RESOLUTION_RECOVERY_SELECT,
  META_DAILY_SOURCE_OBSERVATION_RECOVERY_SELECT,
  META_IMPORT_FILE_ROW_RECOVERY_SELECT,
  fingerprintAdCreativeReportRecovery,
  fingerprintMetaDailyResolutionEventRecovery,
  fingerprintMetaDailyResolutionRecovery,
  fingerprintMetaDailySourceObservationRecovery,
  fingerprintMetaImportFileRowRecovery
} = metaRecoveryCollections;
const {
  ANALYTICS_IMPORT_RECOVERY_SELECT,
  ARTIST_METRIC_OBSERVATION_RECOVERY_SELECT,
  PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_SELECT,
  SONG_PERIOD_SNAPSHOT_RECOVERY_SELECT,
  TRACK_METRIC_OBSERVATION_RECOVERY_SELECT,
  fingerprintAnalyticsImportRecovery,
  fingerprintArtistMetricObservationRecovery,
  fingerprintPlaylistPeriodSnapshotRecovery,
  fingerprintSongPeriodSnapshotRecovery,
  fingerprintTrackMetricObservationRecovery
} = spotifyRecovery;
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
  analyticsImports: {count: 5, sha256: "7e0b12f145e2d528f985067bfb8c370b551bab2b4b330d1db072c1155d548530"},
  artistTimeline: {count: 944, sha256: "c4240fd0b977d84f48ca895bb5cfa468c294c4d1b12244abcebbb5f410d9cce3"},
  mahoragaTrackTimeline: {count: 944, sha256: "a32fa8d15ffac1a213cce6ae0c51e9c6c5b9137357cb0e73ad3d887d5d17921d"},
  songsPeriod: {count: 27, sha256: "c24faf9bc5be7cb3c1f4a811e51b4fb9e0624d61668b232266fb4d271548ab37"},
  playlistsPeriod: {count: 8, sha256: "173c1447c53e73ad0dc1e3f6b0f50d879fc1794c15c43d7b4b6450b61d7cdfb7"},
  gameOverTrackTimeline: {count: 952, sha256: "7671a87dd100a484de988a61d8512201208ca5809cada4e491f8837c3fa3684c"}
});
const LEGACY_SPOTIFY_FINGERPRINTS = Object.freeze({
  analyticsImports: "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f",
  artistTimeline: "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923",
  mahoragaTrackTimeline: "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea",
  songsPeriod: "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2",
  playlistsPeriod: "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6",
  gameOverTrackTimeline: "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"
});
for (const key of Object.keys(EXPECTED_SPOTIFY)) assert.notEqual(EXPECTED_SPOTIFY[key].sha256, LEGACY_SPOTIFY_FINGERPRINTS[key]);
const EXPECTED_GAME_OVER_IMPORT_FINGERPRINT = "6558d5d13cb45b7a5e6e0764433bf772e8e8773e983cd6d346aed32c69dbf376";
const EXPECTED_GAME_OVER_PROVENANCE_FINGERPRINT = "2cbb81da19b71064e24bb34a0be86fbe9f7d5e0819ee86e217002983c0e7754b";
const LEGACY_GAME_OVER_IMPORT_FINGERPRINT = "136b64539363c48dfcc1fb2f2554980c78fdea258660c299db1d42bc418e663b";
const LEGACY_GAME_OVER_PROVENANCE_FINGERPRINT = "6fd1a9d27d68c4ccf69156cedcc82fb9fd4efeb1d5a9bc67a7bbe34e63676277";
assert.notEqual(EXPECTED_GAME_OVER_IMPORT_FINGERPRINT, LEGACY_GAME_OVER_IMPORT_FINGERPRINT);
assert.notEqual(EXPECTED_GAME_OVER_PROVENANCE_FINGERPRINT, LEGACY_GAME_OVER_PROVENANCE_FINGERPRINT);
const EXPECTED_MAHORAGA_RECOVERY = Object.freeze({
  importIdentityAcceptance: "c63235a35c7817a3c08659c48489496b78b0b922083f1a44edb1fc9ab8efc747",
  fileAndRawReferenceMetadata: "bc8b7290a42997ddb209e4a48572d439bcfcd9f42df0f6b8852fba35d94f1815",
  normalizedSourceRows: "6d77a7ab382e9d116612528803459d163cbac50842cf4f65dab52c46a0916109",
  sourceObservations: "54e2f9b95069eafae35f44bd6994c1ee3b0fc2941bf00ee469e248b7d580c445",
  currentResolutions: "27232cb3b7352a2cec5ab0e5a2d3df3cf5f87f1822eed37ac15be8f5cb11f691",
  resolutionEventHistory: "ba4aae91a172ca1255557331576986111a1b392b2697ad55f39b701f98fba1e3",
  compatibilityReports: "2d3fb14a9d86f50273a48f62f6ab9490429b4301b90fcda12b756e603ad15200"
});
const LEGACY_MAHORAGA_IMPORT_IDENTITY_ACCEPTANCE_FINGERPRINT = "21c237b9db3a8d79a307317b8f96f25508497953a41c8ede5308ce209b56a55a";
const LEGACY_MAHORAGA_FILE_AND_RAW_REFERENCE_METADATA_FINGERPRINT = "14e0d658369774667efb447cf6e2f542038ef70b06420c3d055ca48f923aa6a0";
const LEGACY_MAHORAGA_NORMALIZED_SOURCE_ROWS_FINGERPRINT = "bcc843e06dcca671c314fefe5fb79b33b2de9933b7b3b20be992ab798cd7410c";
const LEGACY_MAHORAGA_SOURCE_OBSERVATIONS_FINGERPRINT = "989c5f7c8f8018e015887fcd259ba3d2da057a814d055919cb74c272c7ffa5e3";
const LEGACY_MAHORAGA_CURRENT_RESOLUTIONS_FINGERPRINT = "1fc580eee99f029e7a2fe369522c0e444cc3fdae0a2527ce9cd1ca7475ce0b9b";
const LEGACY_MAHORAGA_RESOLUTION_EVENT_HISTORY_FINGERPRINT = "24ef8079921d8fd884674b15dec4001e3054194eca8e8737fa5cb93ede20157b";
const LEGACY_MAHORAGA_COMPATIBILITY_REPORTS_FINGERPRINT = "11ab6b6bee8d574631735e87a87bd89c1b853d042f1dc447e9fa5c806abc9e62";
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.importIdentityAcceptance, LEGACY_MAHORAGA_IMPORT_IDENTITY_ACCEPTANCE_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.fileAndRawReferenceMetadata, LEGACY_MAHORAGA_FILE_AND_RAW_REFERENCE_METADATA_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.normalizedSourceRows, LEGACY_MAHORAGA_NORMALIZED_SOURCE_ROWS_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.sourceObservations, LEGACY_MAHORAGA_SOURCE_OBSERVATIONS_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.currentResolutions, LEGACY_MAHORAGA_CURRENT_RESOLUTIONS_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.resolutionEventHistory, LEGACY_MAHORAGA_RESOLUTION_EVENT_HISTORY_FINGERPRINT);
assert.notEqual(EXPECTED_MAHORAGA_RECOVERY.compatibilityReports, LEGACY_MAHORAGA_COMPATIBILITY_REPORTS_FINGERPRINT);
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
    analyticsImports: {sql:`SELECT ${ANALYTICS_IMPORT_RECOVERY_SELECT} FROM "AnalyticsImport" i ORDER BY i.id`, fingerprint:fingerprintAnalyticsImportRecovery},
    artistTimeline: {sql:`SELECT ${ARTIST_METRIC_OBSERVATION_RECOVERY_SELECT} FROM "ArtistMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" WHERE i.status='IMPORTED' ORDER BY o.id`, fingerprint:fingerprintArtistMetricObservationRecovery},
    mahoragaTrackTimeline: {sql:`SELECT ${TRACK_METRIC_OBSERVATION_RECOVERY_SELECT} FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title ILIKE '%mahoraga%' ORDER BY o.id`, fingerprint:fingerprintTrackMetricObservationRecovery},
    songsPeriod: {sql:`SELECT ${SONG_PERIOD_SNAPSHOT_RECOVERY_SELECT} FROM "SongPeriodSnapshot" s JOIN "AnalyticsImport" i ON i.id=s."importId" WHERE i.status='IMPORTED' ORDER BY s.id`, fingerprint:fingerprintSongPeriodSnapshotRecovery},
    playlistsPeriod: {sql:`SELECT ${PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_SELECT} FROM "PlaylistPeriodSnapshot" p JOIN "AnalyticsImport" i ON i.id=p."importId" WHERE i.status='IMPORTED' ORDER BY p.id`, fingerprint:fingerprintPlaylistPeriodSnapshotRecovery},
    gameOverTrackTimeline: {sql:`SELECT ${TRACK_METRIC_OBSERVATION_RECOVERY_SELECT} FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title='Game Over' ORDER BY o.id`, fingerprint:fingerprintTrackMetricObservationRecovery}
  };
  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    phase = `state-spotify-${key}`;
    const rows = (await db.query(query.sql)).rows;
    result[key] = {count: rows.length, sha256: query.fingerprint(rows)};
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
  const mahoragaImport = (await db.query(`SELECT ${AD_IMPORT_BATCH_RECOVERY_SELECT} FROM "AdImportBatch" WHERE id=$1 ORDER BY id`, [APPROVED.mahoragaMetaImportId])).rows;
  invariant("MAHORAGA_IMPORT_ROW_COUNT_MISMATCH", mahoragaImport.length, 1);
  const mahoragaFiles = (await db.query(`SELECT ${META_IMPORT_FILE_RECOVERY_SELECT} FROM "MetaImportFile" WHERE "importBatchId"=$1 ORDER BY id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaSourceRows = (await db.query(`SELECT ${META_IMPORT_FILE_ROW_RECOVERY_SELECT} FROM "MetaImportFileRow" r JOIN "MetaImportFile" f ON f.id=r."importFileId" WHERE f."importBatchId"=$1 ORDER BY r."importFileId",r."sourceRowNumber",r.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaObservations = (await db.query(`SELECT ${META_DAILY_SOURCE_OBSERVATION_RECOVERY_SELECT} FROM "MetaDailySourceObservation" o WHERE o."importBatchId"=$1 ORDER BY o."identityKey",o.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaResolutions = (await db.query(`SELECT ${META_DAILY_RESOLUTION_RECOVERY_SELECT} FROM "MetaDailyResolution" r JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY r."identityKey",r.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaEvents = (await db.query(`SELECT ${META_DAILY_RESOLUTION_EVENT_RECOVERY_SELECT} FROM "MetaDailyResolutionEvent" e JOIN "MetaDailyResolution" r ON r.id=e."resolutionId" JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY e."resolutionId",e."createdAt",e.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaReports = (await db.query(`SELECT ${AD_CREATIVE_REPORT_RECOVERY_SELECT} FROM "AdCreativeReport" r WHERE r."importBatchId"=$1 ORDER BY r.id`, [APPROVED.mahoragaMetaImportId])).rows;
  const mahoragaRecovery = {
    importIdentityAcceptance: fingerprintAdImportBatchRecovery(mahoragaImport[0]),
    fileAndRawReferenceMetadata: fingerprintMetaImportFileRecovery(mahoragaFiles),
    normalizedSourceRows: fingerprintMetaImportFileRowRecovery(mahoragaSourceRows),
    sourceObservations: fingerprintMetaDailySourceObservationRecovery(mahoragaObservations),
    currentResolutions: fingerprintMetaDailyResolutionRecovery(mahoragaResolutions),
    resolutionEventHistory: fingerprintMetaDailyResolutionEventRecovery(mahoragaEvents),
    compatibilityReports: fingerprintAdCreativeReportRecovery(mahoragaReports)
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
  const fullImport = (await db.query(`SELECT ${GAME_OVER_ANALYTICS_IMPORT_RECOVERY_SELECT} FROM "AnalyticsImport" i WHERE i.id=$1`, [APPROVED.gameOverSpotifyImportId])).rows[0];
  const releaseIds = (await db.query(`SELECT DISTINCT r.id FROM "TrackMetricObservation" o JOIN "Release" r ON r.id=o."releaseId" WHERE o."importId"=$1 ORDER BY r.id`, [APPROVED.gameOverSpotifyImportId])).rows.map((row) => row.id);
  const auditEvents = (await db.query(`SELECT ${GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_SELECT} FROM "MappingAuditEvent" e WHERE e."importId"=$1 ORDER BY e."createdAt",e.id`, [APPROVED.gameOverSpotifyImportId])).rows;
  const mappingRows = (await db.query(`SELECT ${GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_SELECT} FROM "AnalyticsImportRow" r WHERE r."importId"=$1 ORDER BY r."sourceRowNumber",r.id`, [APPROVED.gameOverSpotifyImportId])).rows;
  gameOverSpotify.import_fingerprint = fingerprintGameOverAnalyticsImportRecovery(fullImport);
  gameOverSpotify.audit_provenance_fingerprint = fingerprintGameOverProvenanceRecovery({analyticsImport:fullImport,auditEvents,mappingRows,releaseIds});
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
  invariant("GAME_OVER_IMPORT_FINGERPRINT_MISMATCH", state.gameOverSpotify.import_fingerprint, EXPECTED_GAME_OVER_IMPORT_FINGERPRINT);
  invariant("GAME_OVER_PROVENANCE_FINGERPRINT_MISMATCH", state.gameOverSpotify.audit_provenance_fingerprint, EXPECTED_GAME_OVER_PROVENANCE_FINGERPRINT);
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
  client = createBackupVerifierPgClient({connectionString: targetUrl});
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
  client = createBackupVerifierPgClient({connectionString: targetUrl}); await client.connect();
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
  client = createBackupVerifierPgClient({connectionString: targetUrl}); await client.connect();
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
