import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import adImportBatchRecovery from "../lib/backups/ad-import-batch-recovery-fingerprint.ts";
import backupVerifierPgClient from "../lib/backups/backup-verifier-pg-client.ts";
import gameOverRecovery from "../lib/backups/game-over-recovery-fingerprints.ts";
import metaRecoveryCollections from "../lib/backups/meta-recovery-collection-fingerprints.ts";
import spotifyRecovery from "../lib/backups/spotify-recovery-fingerprints.ts";

const {
  AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_FIELDS,
  canonicalAdImportBatchRecoveryRecord,
  fingerprintAdImportBatchRecovery
} = adImportBatchRecovery;
const {backupVerifierPgTypes, createBackupVerifierPgClient} = backupVerifierPgClient;
const {
  GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS, GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS,
  GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS, GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS,
  GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS, GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS,
  fingerprintGameOverAnalyticsImportRecovery, fingerprintGameOverProvenanceRecovery
} = gameOverRecovery;
const {
  AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS, AD_CREATIVE_REPORT_RECOVERY_FIELDS,
  META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS, META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS,
  META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS, META_DAILY_RESOLUTION_RECOVERY_FIELDS,
  META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS, META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS,
  META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS, META_IMPORT_FILE_ROW_RECOVERY_FIELDS,
  fingerprintAdCreativeReportRecovery, fingerprintMetaDailyResolutionEventRecovery,
  fingerprintMetaDailyResolutionRecovery, fingerprintMetaDailySourceObservationRecovery,
  fingerprintMetaImportFileRowRecovery
} = metaRecoveryCollections;
const {
  ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS, ANALYTICS_IMPORT_RECOVERY_FIELDS,
  ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS,
  PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
  SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
  TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS,
  fingerprintAnalyticsImportRecovery, fingerprintArtistMetricObservationRecovery,
  fingerprintPlaylistPeriodSnapshotRecovery, fingerprintSongPeriodSnapshotRecovery,
  fingerprintTrackMetricObservationRecovery
} = spotifyRecovery;
const {Client, types: defaultTypes} = pg;
const PROBE_TIMESTAMP = "2026-01-15 12:34:56.789";
const PROBE_ISO = "2026-01-15T12:34:56.789Z";

function recoveryFixture() {
  const dateFields = new Set(AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS);
  const booleanFields = new Set(["campaignIntervalEligible", "coreTimingEligible"]);
  const nullableStrings = new Set(["releaseId", "idempotencyKey", "acceptedById", "withdrawnById", "replacesBatchId"]);
  const fixture = Object.fromEntries(AD_IMPORT_BATCH_RECOVERY_FIELDS.map((field) => {
    if (dateFields.has(field)) return [field, PROBE_ISO];
    if (booleanFields.has(field)) return [field, true];
    if (field === "commonCoverageDateCount") return [field, 71];
    if (nullableStrings.has(field)) return [field, null];
    return [field, `${field}-fixture`];
  }));
  fixture.id = "timestamp-read-path-fixture";
  fixture.releaseId = "fixture-release";
  fixture.acceptedById = "fixture-actor";
  fixture.importState = "ACCEPTED";
  fixture.sourceAsOfOrigin = "IMPORT_ACCEPTED_FALLBACK";
  return fixture;
}

function collectionFixture(fields, dateFields, timestamp, integerFields = [], numberFields = [], nullableStrings = []) {
  const dates = new Set(dateFields);
  const integers = new Set(integerFields);
  const numbers = new Set(numberFields);
  const nullable = new Set(nullableStrings);
  return Object.fromEntries(fields.map((field, index) => {
    if (dates.has(field)) return [field, timestamp];
    if (integers.has(field)) return [field, index + 1];
    if (numbers.has(field)) return [field, index + 0.25];
    if (nullable.has(field)) return [field, null];
    return [field, `${field}-fixture`];
  }));
}

function collectionFingerprintProof(timestamp) {
  const rows = [
    {
      dateFields: META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintMetaImportFileRowRecovery,
      record: collectionFixture(META_IMPORT_FILE_ROW_RECOVERY_FIELDS, META_IMPORT_FILE_ROW_RECOVERY_DATE_FIELDS, timestamp, ["sourceRowNumber"])
    },
    {
      dateFields: META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintMetaDailySourceObservationRecovery,
      record: collectionFixture(META_DAILY_SOURCE_OBSERVATION_RECOVERY_FIELDS, META_DAILY_SOURCE_OBSERVATION_RECOVERY_DATE_FIELDS, timestamp, ["impressions", "reach"], ["spend", "results"])
    },
    {
      dateFields: META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintMetaDailyResolutionRecovery,
      record: collectionFixture(META_DAILY_RESOLUTION_RECOVERY_FIELDS, META_DAILY_RESOLUTION_RECOVERY_DATE_FIELDS, timestamp, ["resolutionVersion"])
    },
    {
      dateFields: META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintMetaDailyResolutionEventRecovery,
      record: collectionFixture(META_DAILY_RESOLUTION_EVENT_RECOVERY_FIELDS, META_DAILY_RESOLUTION_EVENT_RECOVERY_DATE_FIELDS, timestamp, [], [], ["previousObservationId"])
    },
    {
      dateFields: AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintAdCreativeReportRecovery,
      record: collectionFixture(
        AD_CREATIVE_REPORT_RECOVERY_FIELDS, AD_CREATIVE_REPORT_RECOVERY_DATE_FIELDS, timestamp,
        ["impressions", "reach", "linkClicks", "clicksAll", "landingPageViews", "shopClicks", "pageEngagement", "postReactions", "postComments", "postSaves", "postShares", "facebookLikes", "instagramFollows", "videoPlays", "twoSecondContinuousPlays", "threeSecondPlays", "thruPlays", "video25", "video50", "video75", "video95", "video100"],
        ["spend", "frequency", "costPerThousandAccountsReached", "cpm", "results", "costPerResult", "cpc", "ctr", "ctrAll", "cpcAll", "costPerLandingPageView", "costPerTwoSecondContinuousPlay", "costPerThreeSecondPlay", "costPerThruPlay"],
        ["releaseId", "campaignName", "adSetName", "adDelivery", "resultIndicator", "qualityRanking", "engagementRateRanking", "conversionRateRanking", "utmSource", "utmCampaign", "utmContent"]
      )
    }
  ];
  return {
    dateFields: rows.reduce((sum, row) => sum + row.dateFields.length, 0),
    fingerprints: rows.map(({fingerprint, record}) => fingerprint([record]))
  };
}

function spotifyFingerprintProof(timestamp) {
  const rows = [
    {
      dateFields: ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintAnalyticsImportRecovery,
      record: collectionFixture(ANALYTICS_IMPORT_RECOVERY_FIELDS, ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS, timestamp, ["rowCount", "acceptedRowCount", "rejectedRowCount", "unmatchedRowCount", "warningCount"], [], ["replacedByImportId"])
    },
    {
      dateFields: ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintArtistMetricObservationRecovery,
      record: collectionFixture(ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS, ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, timestamp, ["listeners", "monthlyListeners", "monthlyActiveListeners", "streams", "playlistAdds", "saves", "followers"])
    },
    {
      dateFields: TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintTrackMetricObservationRecovery,
      record: collectionFixture(TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS, TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, timestamp, ["streams", "listeners", "saves", "playlistAdds"], [], ["spotifyTrackId"])
    },
    {
      dateFields: SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintSongPeriodSnapshotRecovery,
      record: collectionFixture(SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS, SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, timestamp, ["listeners", "streams", "saves"], [], ["mappingRowId"])
    },
    {
      dateFields: PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
      fingerprint: fingerprintPlaylistPeriodSnapshotRecovery,
      record: collectionFixture(PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS, PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, timestamp, ["listeners", "streams"], [], ["playlistSpotifyId"])
    }
  ];
  return {dateFields: rows.reduce((sum, row) => sum + row.dateFields.length, 0), fingerprints: rows.map(({fingerprint, record}) => fingerprint([record]))};
}

function gameOverFingerprintProof(timestamp) {
  const analyticsImport = collectionFixture(
    GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS, GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS, timestamp,
    ["rowCount", "acceptedRowCount", "rejectedRowCount", "unmatchedRowCount", "warningCount", "normalizationVersion", "rawFileSizeBytes"], [],
    ["commitIdempotencyKey", "uploadedById", "rawFileStorageDriver", "rawFileStorageKey", "withdrawnById", "replacedByImportId"]
  );
  analyticsImport.id = "game-over-import";
  analyticsImport.periodDatesUserConfirmed = true;
  analyticsImport.metadata = JSON.stringify({confirmations:{period:true},previewResultChecksum:"checksum"});
  const auditEvent = collectionFixture(
    GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS, GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS, timestamp, [], [],
    ["rowId", "importId", "aliasId", "previousMappingStatus", "newMappingStatus", "previousReleaseId", "newReleaseId", "actorId"]
  );
  auditEvent.id = "audit-event";
  auditEvent.importId = analyticsImport.id;
  const mappingRow = collectionFixture(
    GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS, GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS, timestamp,
    ["sourceRowNumber", "mappingVersion"], [],
    ["suggestedReleaseId", "confirmedReleaseId", "confirmedScopeKey", "appliedAliasId", "confirmedById", "unmatchedReason", "unmatchedById"]
  );
  mappingRow.id = "mapping-row";
  mappingRow.importId = analyticsImport.id;
  return {
    dateFields: GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS.length + GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS.length + GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS.length,
    importFingerprint: fingerprintGameOverAnalyticsImportRecovery(analyticsImport),
    provenanceFingerprint: fingerprintGameOverProvenanceRecovery({analyticsImport,auditEvents:[auditEvent],mappingRows:[mappingRow],releaseIds:["release-id"]})
  };
}

async function childProbe() {
  const connectionString = process.env.TIMESTAMP_PROBE_DATABASE_URL;
  assert.ok(connectionString, "Disposable timestamp probe database is required.");
  const client = createBackupVerifierPgClient({connectionString});
  await client.connect();
  try {
    const rows = (await client.query(`SELECT * FROM verifier_timestamp_probe ORDER BY id`)).rows;
    assert.equal(rows.length, 2);
    const full = rows[0];
    const nullable = rows[1];

    for (const field of AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS) {
      assert.ok(full[field] instanceof Date, `${field} must hydrate as Date.`);
      assert.equal(full[field].toISOString(), PROBE_ISO, `${field} must use the UTC wall-clock contract.`);
    }
    for (const field of ["acceptedAt", "withdrawnAt", "coreTimingStart", "coreTimingEnd", "commonCoverageStart", "commonCoverageEnd"]) {
      assert.equal(nullable[field], null, `${field} must preserve null.`);
    }
    assert.equal(nullable.createdAt.toISOString(), PROBE_ISO);
    assert.equal(nullable.updatedAt.toISOString(), PROBE_ISO);

    const precision = (await client.query(`SELECT
      '2026-01-15 12:34:56'::timestamp(3) no_fraction,
      '2026-01-15 12:34:56.7'::timestamp(3) one_digit,
      '2026-01-15 12:34:56.78'::timestamp(3) two_digits,
      '2026-01-15 12:34:56.789'::timestamp(3) three_digits,
      '2026-01-15 12:34:56.789+00'::timestamptz aware`)).rows[0];
    assert.deepEqual(
      [precision.no_fraction, precision.one_digit, precision.two_digits, precision.three_digits].map((value) => value.toISOString()),
      ["2026-01-15T12:34:56.000Z", "2026-01-15T12:34:56.700Z", "2026-01-15T12:34:56.780Z", PROBE_ISO]
    );
    assert.equal(precision.aware.toISOString(), PROBE_ISO);

    const collectionIsoProof = collectionFingerprintProof(PROBE_ISO);
    const collectionPgProof = collectionFingerprintProof(full.reportingStart);
    assert.equal(collectionPgProof.dateFields, 12);
    assert.deepEqual(collectionPgProof, collectionIsoProof);
    const spotifyIsoProof = spotifyFingerprintProof(PROBE_ISO);
    const spotifyPgProof = spotifyFingerprintProof(full.reportingStart);
    assert.equal(spotifyPgProof.dateFields, 14);
    assert.deepEqual(spotifyPgProof, spotifyIsoProof);
    const gameOverIsoProof = gameOverFingerprintProof(PROBE_ISO);
    const gameOverPgProof = gameOverFingerprintProof(full.reportingStart);
    assert.equal(gameOverPgProof.dateFields, 16);
    assert.deepEqual(gameOverPgProof, gameOverIsoProof);

    const expectedFixture = recoveryFixture();
    const hydratedFixture = {...expectedFixture};
    for (const field of AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS) hydratedFixture[field] = full[field];
    const expectedFingerprint = fingerprintAdImportBatchRecovery(expectedFixture);
    assert.equal(fingerprintAdImportBatchRecovery(hydratedFixture), expectedFingerprint);
    assert.deepEqual(
      canonicalAdImportBatchRecoveryRecord(hydratedFixture),
      canonicalAdImportBatchRecoveryRecord(expectedFixture)
    );

    const timestamptzParserUnchanged =
      backupVerifierPgTypes.getTypeParser(defaultTypes.builtins.TIMESTAMPTZ, "text") ===
      defaultTypes.getTypeParser(defaultTypes.builtins.TIMESTAMPTZ, "text");
    assert.equal(timestamptzParserUnchanged, true);

    console.log(JSON.stringify({
      timezone: process.env.TZ,
      probeIso: full.reportingStart.toISOString(),
      allDateFieldsCanonical: true,
      nullableDatesPreserved: true,
      fixtureFingerprintMatched: true,
      millisecondPrecisionPreserved: true,
      metaRecoveryCollectionDateFields: collectionPgProof.dateFields,
      metaRecoveryCollectionsCanonical: true,
      spotifyRecoveryDateFields: spotifyPgProof.dateFields,
      spotifyRecoveryCollectionsCanonical: true,
      gameOverRecoveryDateFields: gameOverPgProof.dateFields,
      gameOverRecoveryCanonical: true,
      timestamptzParserUnchanged
    }));
  } finally {
    await client.end();
  }
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function runChildProbe(connectionString, timezone) {
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "scripts/test-backup-verifier-timestamp-read-path.mjs", "--probe"],
    {
      cwd: process.cwd(),
      env: {...process.env, TZ: timezone, TIMESTAMP_PROBE_DATABASE_URL: connectionString},
      encoding: "utf8",
      shell: false
    }
  );
  assert.equal(result.status, 0, `Timestamp probe failed under ${timezone}.`);
  return JSON.parse(result.stdout.trim());
}

async function parentSuite() {
  const port = await availablePort();
  const database = `backup_timestamp_probe_${crypto.randomBytes(6).toString("hex")}`;
  const password = crypto.randomBytes(24).toString("base64url");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-backup-timestamp-probe-"));
  const embedded = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password,
    port,
    persistent: false,
    createPostgresUser: process.getuid?.() === 0,
    onLog: () => {},
    onError: () => {}
  });
  try {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(database);
    const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
    const setup = new Client({connectionString});
    await setup.connect();
    const version = Number((await setup.query("SHOW server_version_num")).rows[0].server_version_num);
    assert.ok(version >= 170000 && version < 180000);
    const dateColumns = AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.map((field) => `"${field}" timestamp(3)`).join(",");
    await setup.query(`CREATE TABLE verifier_timestamp_probe (id text PRIMARY KEY,${dateColumns})`);
    const columns = AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.map((field) => `"${field}"`).join(",");
    const fullValues = AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.map(() => `'${PROBE_TIMESTAMP}'`).join(",");
    const nullableFields = new Set(["acceptedAt", "withdrawnAt", "coreTimingStart", "coreTimingEnd", "commonCoverageStart", "commonCoverageEnd"]);
    const nullableValues = AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.map((field) => nullableFields.has(field) ? "NULL" : `'${PROBE_TIMESTAMP}'`).join(",");
    await setup.query(`INSERT INTO verifier_timestamp_probe (id,${columns}) VALUES ('full',${fullValues}),('nullable',${nullableValues})`);
    await setup.end();

    const utc = runChildProbe(connectionString, "UTC");
    const newYork = runChildProbe(connectionString, "America/New_York");
    assert.equal(utc.probeIso, PROBE_ISO);
    assert.equal(newYork.probeIso, PROBE_ISO);
    assert.deepEqual({...utc, timezone: undefined}, {...newYork, timezone: undefined});

    console.log(JSON.stringify({
      suite: "backup-verifier-timestamp-read-path",
      postgresMajor: 17,
      timezones: ["UTC", "America/New_York"],
      probeIso: PROBE_ISO,
      dateFields: AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.length,
      metaRecoveryCollectionDateFields: 12,
      spotifyRecoveryDateFields: 14,
      gameOverRecoveryDateFields: 16,
      pgTimestampReadPathTzInvariant: true,
      adImportBatchDateCanonicalizationTzInvariant: true,
      metaRecoveryCollectionDateCanonicalizationTzInvariant: true,
      spotifyRecoveryDateCanonicalizationTzInvariant: true,
      gameOverRecoveryDateCanonicalizationTzInvariant: true,
      fixtureFingerprintTzInvariant: true,
      millisecondPrecisionPreserved: true,
      timestamptzParserUnchanged: true,
      productionConnections: 0,
      productionWrites: 0
    }));
  } finally {
    await embedded.stop().catch(() => {});
    await fs.rm(directory, {recursive: true, force: true});
  }
}

if (process.argv.includes("--probe")) await childProbe();
else await parentSuite();
