import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

process.env.TZ = "UTC";

const root = process.cwd();
const tempRoot = path.resolve(root, ".codex-temp");
const runtimeRoot = path.resolve(process.env.GATE_A2_POSTGRES_RUNTIME || path.join(tempRoot, "gate-a2-runtime"));
const backupDir = path.resolve(root, "storage", "production-backups");
const dataDir = path.resolve(tempRoot, `gate-a2-restore-${crypto.randomUUID()}`);
assert.ok(dataDir.startsWith(`${tempRoot}${path.sep}`));

const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const embeddedModule = runtimeRequire("embedded-postgres");
const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
const {Client} = runtimeRequire("pg");

async function loadEnvFile(fileName) {
  let raw;
  try { raw = await fs.readFile(path.resolve(root, fileName), "utf8"); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function runCommand(label, args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: {...process.env, ...env},
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.error?.message || `exit ${result.status}`}).\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function decrypt(encrypted) {
  const secret = process.env.BACKUP_ENCRYPTION_SECRET?.trim();
  assert.ok(secret && secret.length >= 32, "BACKUP_ENCRYPTION_SECRET is required.");
  const payload = JSON.parse(encrypted.toString("utf8"));
  assert.equal(payload.version, 1);
  assert.equal(payload.algorithm, "aes-256-gcm");
  const key = crypto.createHash("sha256").update(secret, "utf8").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64url")), decipher.final()]);
}

async function insertRow(client, table, row) {
  const keys = Object.keys(row);
  const columns = keys.map((key) => `"${key.replaceAll('"', '""')}"`).join(", ");
  const values = keys.map((_, index) => `$${index + 1}`).join(", ");
  await client.query(`INSERT INTO public."${table}" (${columns}) VALUES (${values})`, keys.map((key) => row[key]));
}

function normalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

function sortedRows(rows, keys) {
  return rows.map(normalize).sort((a, b) => keys.map((key) => String(a[key] ?? "")).join("|").localeCompare(keys.map((key) => String(b[key] ?? "")).join("|")));
}

async function latestBackup() {
  const explicit = process.env.GATE_A2_BACKUP_PATH?.trim();
  if (explicit) {
    const resolved = path.resolve(explicit);
    assert.ok(resolved.startsWith(`${backupDir}${path.sep}`), "Backup must be inside the production backup directory.");
    return resolved;
  }
  const names = (await fs.readdir(backupDir)).filter((name) => /^gate-a2-breaking-barz-.*\.json\.gz\.enc$/.test(name)).sort();
  assert.ok(names.length > 0, "No Gate A2 encrypted backup found.");
  return path.resolve(backupDir, names.at(-1));
}

async function main() {
  await loadEnvFile(".env.production.local");
  await loadEnvFile(".env.local");
  const backupPath = await latestBackup();
  const encrypted = await fs.readFile(backupPath);
  const snapshot = JSON.parse(zlib.gunzipSync(decrypt(encrypted)).toString("utf8"));
  assert.equal(snapshot.scope, "gate-a2-breaking-barz-recovery");

  const port = await availablePort();
  const password = crypto.randomBytes(24).toString("base64url");
  const databaseName = "gate_a2_restore";
  const connectionUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${databaseName}?schema=public`;
  const databaseEnv = {DATABASE_URL: connectionUrl, DIRECT_URL: connectionUrl};
  const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}});
  let client;
  let started = false;
  try {
    await embedded.initialise();
    await embedded.start();
    started = true;
    await embedded.createDatabase(databaseName);
    runCommand("Prisma PostgreSQL db push", ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], databaseEnv);
    client = new Client({connectionString: connectionUrl});
    await client.connect();

    const referencedReleaseIds = new Set(snapshot.releaseAnnotations.map((row) => row.releaseId));
    for (const row of snapshot.breakingBarzEntries) if (row.releaseId) referencedReleaseIds.add(row.releaseId);
    for (const row of snapshot.releases.filter((item) => referencedReleaseIds.has(item.id))) {
      await insertRow(client, "Release", {
        id: row.id,
        title: row.title,
        slug: row.slug,
        catalogScope: row.catalogScope,
        collaborator: row.collaborator,
        collaboratorName: row.collaboratorName,
        spotifyUrl: row.spotifyUrl,
        appleMusicUrl: row.appleMusicUrl,
        youtubeUrl: row.youtubeUrl,
        isPublished: row.isPublished,
        createdOn: row.createdOn,
        updatedOn: row.updatedOn
      });
    }
    for (const row of snapshot.releaseAnnotations) await insertRow(client, "ReleaseAnnotation", row);
    for (const row of snapshot.breakingBarzCategories) await insertRow(client, "BreakingBarzCategory", row);
    const publishedLinks = snapshot.breakingBarzEntries.map((row) => ({id: row.id, versionId: row.currentPublishedVersionId}));
    for (const row of snapshot.breakingBarzEntries) await insertRow(client, "BreakingBarzEntry", {...row, currentPublishedVersionId: null});
    for (const row of snapshot.breakingBarzVersions) await insertRow(client, "BreakingBarzVersion", row);
    for (const row of snapshot.breakingBarzVersionSources) await insertRow(client, "BreakingBarzVersionSource", row);
    for (const row of snapshot.breakingBarzEntryCategories) await insertRow(client, "BreakingBarzEntryCategory", row);
    for (const row of snapshot.breakingBarzSubmissions) await insertRow(client, "BreakingBarzSubmission", row);
    for (const link of publishedLinks) if (link.versionId) await client.query('UPDATE public."BreakingBarzEntry" SET "currentPublishedVersionId"=$1 WHERE id=$2', [link.versionId, link.id]);

    const tableSpecs = [
      ["BreakingBarzEntry", "breakingBarzEntries", ["id"]],
      ["BreakingBarzVersion", "breakingBarzVersions", ["id"]],
      ["BreakingBarzVersionSource", "breakingBarzVersionSources", ["id"]],
      ["BreakingBarzCategory", "breakingBarzCategories", ["id"]],
      ["BreakingBarzEntryCategory", "breakingBarzEntryCategories", ["entryId", "categoryId"]],
      ["BreakingBarzSubmission", "breakingBarzSubmissions", ["id"]]
    ];
    const restoredCounts = {};
    for (const [table, key, sortKeys] of tableSpecs) {
      const result = await client.query(`SELECT * FROM public."${table}"`);
      assert.deepEqual(sortedRows(result.rows, sortKeys), sortedRows(snapshot[key], sortKeys), `${table} restore mismatch`);
      restoredCounts[key] = result.rows.length;
    }
    const resolution = await client.query(`
      SELECT count(*)::int AS count
      FROM public."BreakingBarzEntry" e
      JOIN public."BreakingBarzVersion" v ON v.id=e."currentPublishedVersionId" AND v."entryId"=e.id
      LEFT JOIN public."ReleaseAnnotation" a ON a.id=e."releaseAnnotationId"
      LEFT JOIN public."Release" r ON r.id=e."releaseId"
      WHERE e.status='published'
    `);
    const expectedPublished = snapshot.breakingBarzEntries.filter((row) => row.status === "published" && row.currentPublishedVersionId).length;
    assert.equal(resolution.rows[0].count, expectedPublished);
    console.log(JSON.stringify({
      backupId: path.basename(backupPath, ".json.gz.enc"),
      postgresVersion: (await client.query("SELECT current_setting('server_version') AS version")).rows[0].version,
      restoredCounts,
      exactSixTableComparison: "passed",
      publishedEntryResolution: {expected: expectedPublished, restored: resolution.rows[0].count},
      plaintextWrittenToDisk: false
    }, null, 2));
  } finally {
    if (client) await client.end().catch(() => {});
    if (started) await embedded.stop().catch(() => {});
    runCommand("Restore SQLite Prisma generation", ["scripts/run-prisma.mjs", "generate"]);
    await fs.rm(dataDir, {recursive: true, force: true});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
