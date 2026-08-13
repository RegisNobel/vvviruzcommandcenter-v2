import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import gameOverDateCoverage from "../lib/backups/game-over-date-coverage.ts";
import restoreImportContract from "../lib/backups/restore-import-contract.ts";

const {Client} = pg;
const {readTrackDateCoverage} = gameOverDateCoverage;
const {requireZeroRestoreProvenanceWarnings} = restoreImportContract;

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return {status: result.status, stdout: result.stdout, stderr: result.stderr};
}

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
const suffix = crypto.randomBytes(6).toString("hex");
const sourceDatabase = `backup_verify_source_${suffix}`;
const restoredDatabase = `backup_verify_restored_${suffix}`;
const password = crypto.randomBytes(24).toString("base64url");
const postgresDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-backup-shaped-pg-"));
const artifactsDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-backup-shaped-artifacts-"));
const snapshotPath = path.join(artifactsDirectory, "snapshot.json");
const fingerprintPath = path.join(artifactsDirectory, "fingerprint.json");
const embedded = new EmbeddedPostgres({
  databaseDir: postgresDirectory,
  user: "postgres",
  password,
  port,
  persistent: false,
  createPostgresUser: process.getuid?.() === 0,
  onLog: () => {},
  onError: () => {},
});
const databaseUrl = (database) => `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
const baseEnv = {...process.env, ALLOW_DATABASE_URL_OVERRIDE: "1"};

try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(sourceDatabase);
  await embedded.createDatabase(restoredDatabase);

  const generateUrl = databaseUrl(sourceDatabase);
  run(process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], {...baseEnv, DATABASE_URL: generateUrl, DIRECT_URL: generateUrl});
  for (const database of [sourceDatabase, restoredDatabase]) {
    const url = databaseUrl(database);
    run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], {...baseEnv, DATABASE_URL: url, DIRECT_URL: url});
  }

  const sourceUrl = databaseUrl(sourceDatabase);
  const sourceEnv = {...baseEnv, DATABASE_URL: sourceUrl, DIRECT_URL: sourceUrl, DB_SNAPSHOT_PATH: snapshotPath, STAGE10_FINGERPRINT_PATH: fingerprintPath};
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "seed"], sourceEnv);
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "fingerprint"], sourceEnv);
  run(process.execPath, ["--import", "tsx", "scripts/export-db-snapshot.ts"], sourceEnv);

  const restoredUrl = databaseUrl(restoredDatabase);
  const restoredEnv = {...baseEnv, DATABASE_URL: restoredUrl, DIRECT_URL: restoredUrl, DB_SNAPSHOT_PATH: snapshotPath, STAGE10_FINGERPRINT_PATH: fingerprintPath, IMPORT_AUTH: "1"};
  const importResult = run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], restoredEnv);
  assert.equal(requireZeroRestoreProvenanceWarnings(importResult).counts.restoreProvenanceWarnings, 0);
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "verify"], restoredEnv);

  const client = new Client({connectionString: restoredUrl});
  await client.connect();
  const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
  assert.ok(version >= 170000 && version < 180000);
  const coverage = await readTrackDateCoverage(client, "a060e608-24f4-4f79-8a3b-fceface408c9", "2024-01-01", "2026-08-09");
  assert.deepEqual(coverage, {
    observation_count: 952,
    distinct_date_count: 952,
    duplicate_date_count: 0,
    missing_date_count: 0,
    earliest_date: "2024-01-01",
    latest_date: "2026-08-09",
  });
  const meta = (await client.query(`SELECT count(*)::int facts,
    count(*) FILTER (WHERE spend>0)::int positive,
    count(*) FILTER (WHERE spend=0)::int explicit_zero,
    round(sum(spend)::numeric,2)::text spend
    FROM "MetaDailySourceObservation"
    WHERE "importBatchId"='e2a5a408-02ea-426b-910a-2015124877ad'`)).rows[0];
  assert.deepEqual(meta, {facts: 210, positive: 60, explicit_zero: 150, spend: "283.48"});
  const actor = (await client.query(`SELECT i."uploadedById" import_actor,a."actorId" audit_actor
    FROM "AnalyticsImport" i CROSS JOIN "MetaImportAuditEvent" a
    WHERE i.id='a060e608-24f4-4f79-8a3b-fceface408c9' AND a.id='game-over-meta-acceptance-audit'`)).rows[0];
  assert.deepEqual(actor, {import_actor: "stage10-restore-admin", audit_actor: "stage10-restore-admin"});
  await client.end();

  console.log(JSON.stringify({
    suite: "backup-production-shaped-postgres",
    postgresMajor: 17,
    restoreProvenanceWarnings: 0,
    gameOver: {observations: 952, distinctDates: 952, duplicateDates: 0, missingDates: 0},
    meta: {facts: 210, spend: "283.48"},
    fingerprints: "source-restored-exact",
    actorProvenance: "exact",
    productionConnections: 0,
    productionWrites: 0,
  }));
} finally {
  const sqliteGenerateEnv = {...baseEnv, DATABASE_URL: "file:../storage/vvviruz-command-center.db", DIRECT_URL: "file:../storage/vvviruz-command-center.db"};
  run(process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.prisma"], sqliteGenerateEnv);
  await embedded.stop().catch(() => {});
  await fs.rm(postgresDirectory, {recursive: true, force: true});
  await fs.rm(artifactsDirectory, {recursive: true, force: true});
}
