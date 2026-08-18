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

const {
  AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_FIELDS,
  canonicalAdImportBatchRecoveryRecord,
  fingerprintAdImportBatchRecovery
} = adImportBatchRecovery;
const {backupVerifierPgTypes, createBackupVerifierPgClient} = backupVerifierPgClient;
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
      pgTimestampReadPathTzInvariant: true,
      adImportBatchDateCanonicalizationTzInvariant: true,
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
