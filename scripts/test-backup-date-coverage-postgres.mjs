import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import gameOverDateCoverage from "../lib/backups/game-over-date-coverage.ts";

const {Client} = pg;
const {readTrackDateCoverage} = gameOverDateCoverage;

async function availablePort() {
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

const port = await availablePort();
const database = `backup_date_coverage_${crypto.randomBytes(6).toString("hex")}`;
const password = crypto.randomBytes(24).toString("base64url");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-backup-date-coverage-"));
const embedded = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port,
  persistent: false,
  createPostgresUser: process.getuid?.() === 0,
  onLog: () => {},
  onError: () => {},
});

async function replaceDates(client, dates) {
  await client.query(`TRUNCATE "TrackMetricObservation"`);
  await client.query(
    `INSERT INTO "TrackMetricObservation" ("importId","metricDate")
     SELECT 'fixture-import', value::date FROM unnest($1::text[]) value`,
    [dates]
  );
  return readTrackDateCoverage(client, "fixture-import", "2026-08-01", "2026-08-03");
}

try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(database);
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`,
  });
  await client.connect();
  const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
  assert.ok(version >= 170000 && version < 180000);
  await client.query(`CREATE TABLE "TrackMetricObservation" (
    "importId" text NOT NULL,
    "metricDate" timestamp(3) NOT NULL
  )`);

  const perfect = await replaceDates(client, ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.deepEqual(perfect, {
    observation_count: 3,
    distinct_date_count: 3,
    duplicate_date_count: 0,
    missing_date_count: 0,
    earliest_date: "2026-08-01",
    latest_date: "2026-08-03",
  });
  for (const field of ["observation_count", "distinct_date_count", "duplicate_date_count", "missing_date_count"]) {
    assert.equal(typeof perfect[field], "number", `${field} must be a JavaScript number.`);
  }

  const duplicateOnly = await replaceDates(client, ["2026-08-01", "2026-08-02", "2026-08-02", "2026-08-03"]);
  assert.ok(duplicateOnly.duplicate_date_count > 0);
  assert.equal(duplicateOnly.missing_date_count, 0);

  const missingOnly = await replaceDates(client, ["2026-08-01", "2026-08-03"]);
  assert.equal(missingOnly.duplicate_date_count, 0);
  assert.ok(missingOnly.missing_date_count > 0);

  const duplicateReplacingMissing = await replaceDates(client, ["2026-08-01", "2026-08-01", "2026-08-03"]);
  assert.equal(duplicateReplacingMissing.observation_count, 3);
  assert.ok(duplicateReplacingMissing.duplicate_date_count > 0);
  assert.ok(duplicateReplacingMissing.missing_date_count > 0);

  await client.query(`TRUNCATE "TrackMetricObservation"`);
  await client.query(`INSERT INTO "TrackMetricObservation" ("importId","metricDate")
    SELECT 'full-scale-fixture', expected_date
    FROM generate_series('2024-01-01'::date,'2026-08-09'::date,interval '1 day') expected_date`);
  const fullScale = await readTrackDateCoverage(client, "full-scale-fixture", "2024-01-01", "2026-08-09");
  assert.deepEqual(fullScale, {
    observation_count: 952,
    distinct_date_count: 952,
    duplicate_date_count: 0,
    missing_date_count: 0,
    earliest_date: "2024-01-01",
    latest_date: "2026-08-09",
  });
  await client.end();

  console.log(JSON.stringify({
    suite: "backup-date-coverage-postgres",
    postgresMajor: 17,
    cases: ["perfect", "duplicate-only", "missing-only", "duplicate-replacing-missing", "numeric-types", "full-scale-952"],
    productionConnections: 0,
    productionWrites: 0,
  }));
} finally {
  await embedded.stop().catch(() => {});
  await fs.rm(directory, {recursive: true, force: true});
}
