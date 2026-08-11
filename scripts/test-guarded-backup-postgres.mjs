import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import disposableRestoreGuard from "../lib/backups/disposable-restore-guard.ts";

const {assertDisposableRestoreTarget} = disposableRestoreGuard;

const {Client} = pg;
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const database = `backup_verify_test_${crypto.randomBytes(6).toString("hex")}`;
const password = crypto.randomBytes(24).toString("base64url");
const targetUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
const productionUrl = "postgresql://prod-user:secret@production.example.test:5432/postgres";
const targetIdentity = assertDisposableRestoreTarget({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [productionUrl], targetUrl});
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-guarded-restore-test-"));
const embedded = new EmbeddedPostgres({databaseDir: tempDirectory, user: "postgres", password, port, persistent: false, createPostgresUser: process.getuid?.() === 0, onLog: () => {}, onError: () => {}});

try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(database);
  const before = new Client({connectionString: targetUrl});
  await before.connect();
  assert.equal((await before.query(`SELECT count(*)::int count FROM pg_tables WHERE schemaname='public'`)).rows[0].count, 0);
  await before.end();

  const env = {...process.env, DATABASE_URL: targetUrl, DIRECT_URL: targetUrl, POSTGRES_PRISMA_URL: targetUrl, POSTGRES_URL: targetUrl, POSTGRES_URL_NON_POOLING: targetUrl};
  const push = spawnSync(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], {cwd: process.cwd(), env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024});
  assert.equal(push.status, 0, "Disposable schema initialization failed.");
  const imported = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], {cwd: process.cwd(), env: {...env, DB_SNAPSHOT_STDIN: "1", IMPORT_AUTH: "0"}, input: Buffer.from("{}"), encoding: "buffer", maxBuffer: 32 * 1024 * 1024});
  assert.equal(imported.status, 0, "In-memory disposable restore failed.");

  const after = new Client({connectionString: targetUrl});
  await after.connect();
  assert.equal((await after.query(`SELECT count(*)::int count FROM "AdImportBatch"`)).rows[0].count, 0);
  assert.equal((await after.query(`SELECT count(*)::int count FROM "AnalyticsImport"`)).rows[0].count, 0);
  await after.end();
  console.log(JSON.stringify({suite: "guarded-backup-postgres", target: targetIdentity, restoredFromMemory: true, productionConnections: 0, productionWrites: 0}));
} finally {
  await embedded.stop().catch(() => {});
  await fs.rm(tempDirectory, {recursive: true, force: true});
  assert.equal(await fs.stat(tempDirectory).then(() => true).catch(() => false), false);
}
