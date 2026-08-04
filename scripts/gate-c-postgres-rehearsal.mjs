import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const root = process.cwd();
const tempRoot = path.resolve(root, ".codex-temp");
const rehearsalRoot = path.resolve(tempRoot, "gate-c-rehearsal");
const runtimeRoot = path.resolve(process.env.GATE_C_POSTGRES_RUNTIME || path.join(tempRoot, "gate-c-runtime"));
const statePath = path.join(rehearsalRoot, "state.json");
const baselineSchemaPath = path.join(rehearsalRoot, "starting-state.postgres.prisma");
const packageRoot = path.join(root, "prisma", "deployment", "retention-lab");
const previewPath = path.join(packageRoot, "02-prisma-db-push-preview.sql");
const baselineCommit = process.env.GATE_C_BASELINE_COMMIT || "75408ca4be61b1011e01b8b5c5d19690939a5b3c";
const rehearsalDatabase = "gate_c_retention_rehearsal";

if (process.env.GATE_C_BACKUP_ENCRYPTION_SECRET) {
  process.env.BACKUP_ENCRYPTION_SECRET = process.env.GATE_C_BACKUP_ENCRYPTION_SECRET;
}

assert.ok(rehearsalRoot.startsWith(`${tempRoot}${path.sep}`));
const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const embeddedModule = runtimeRequire("embedded-postgres");
const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
const {Client} = runtimeRequire("pg");

const retentionTables = [
  "AnalyticsImport", "ArtistMetricObservation", "TrackMetricObservation", "SongPeriodSnapshot",
  "PlaylistPeriodSnapshot", "ReleaseImportAlias", "AnalyticsImportRow", "MappingAuditEvent",
  "PromotionCampaign", "CampaignEvidence", "CampaignActiveInterval", "CampaignTimelineEvent",
  "CampaignAuditEvent"
];
const checkNames = [
  "AnalyticsImport_status_check", "AnalyticsImport_fileHash_check", "AnalyticsImport_counts_check",
  "AnalyticsImport_normalizationVersion_check", "AnalyticsImport_rawFileSizeBytes_check",
  "AnalyticsImport_detectedPeriod_check", "AnalyticsImport_confirmedPeriod_check",
  "ArtistMetricObservation_metrics_check", "TrackMetricObservation_metrics_check",
  "SongPeriodSnapshot_period_check", "SongPeriodSnapshot_metrics_check",
  "PlaylistPeriodSnapshot_period_check", "PlaylistPeriodSnapshot_metrics_check",
  "PromotionCampaign_platform_check", "PromotionCampaign_objective_check", "PromotionCampaign_status_check",
  "PromotionCampaign_name_check", "CampaignEvidence_sourceType_check", "CampaignEvidence_confidence_check",
  "CampaignEvidence_imported_dates_check", "CampaignEvidence_spend_dates_check",
  "CampaignEvidence_suggested_dates_check", "CampaignActiveInterval_sourceType_check",
  "CampaignActiveInterval_confirmationStatus_check", "CampaignActiveInterval_dates_check",
  "CampaignActiveInterval_timezone_check", "CampaignTimelineEvent_eventType_check",
  "CampaignTimelineEvent_source_check", "CampaignTimelineEvent_confirmationStatus_check",
  "CampaignTimelineEvent_timezone_check"
];

function databaseUrl(state, database = rehearsalDatabase) {
  return `postgresql://postgres:${encodeURIComponent(state.password)}@127.0.0.1:${state.port}/${database}?schema=public`;
}

function databaseEnv(state, database = rehearsalDatabase, extra = {}) {
  const url = databaseUrl(state, database);
  return {...process.env, DATABASE_URL: url, DIRECT_URL: url, ...extra};
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env || process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.error?.message || `exit ${result.status}`}).\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return {stdout: result.stdout || "", stderr: result.stderr || ""};
}

function runNode(label, args, env) {
  return run(label, process.execPath, args, {env});
}

async function freePort() {
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

async function readState() {
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

async function writeState(state) {
  await fs.mkdir(rehearsalRoot, {recursive: true});
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

function embeddedFor(state) {
  return new EmbeddedPostgres({
    databaseDir: path.join(rehearsalRoot, "postgres-data"),
    user: "postgres",
    password: state.password,
    port: state.port,
    persistent: true,
    onLog: () => {},
    onError: () => {}
  });
}

async function withServer(state, callback, initialise = false) {
  const embedded = embeddedFor(state);
  let started = false;
  try {
    if (initialise) await embedded.initialise();
    await embedded.start();
    started = true;
    return await callback(embedded);
  } finally {
    if (started) await embedded.stop().catch(() => undefined);
  }
}

async function client(state, database = rehearsalDatabase) {
  const value = new Client({connectionString: databaseUrl(state, database)});
  await value.connect();
  return value;
}

async function sqlFile(name) {
  return fs.readFile(path.join(packageRoot, name), "utf8");
}

async function createRolesAndDefaults(db) {
  await db.query(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='trusted_prisma') THEN CREATE ROLE trusted_prisma NOLOGIN; END IF;
    END $roles$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
  `);
}

async function materializeBaselineSchema() {
  const result = run("Read committed starting schema", "git", ["show", `${baselineCommit}:prisma/schema.postgres.prisma`]);
  assert.match(result.stdout, /provider\s*=\s*"postgresql"/);
  assert.match(result.stdout, /artistLinkId\s+String\?/);
  assert.doesNotMatch(result.stdout, /model AnalyticsImport\s*\{/);
  await fs.writeFile(baselineSchemaPath, result.stdout);
}

function pushSchema(state, database, schemaPath, acceptDataLoss = false) {
  const args = ["scripts/run-prisma.mjs", "db", "push", "--schema", schemaPath, "--skip-generate"];
  if (acceptDataLoss) args.push("--accept-data-loss");
  return runNode(`Prisma db push (${database})`, args, databaseEnv(state, database));
}

async function seedStartingFixtures(db) {
  await db.query(`
    INSERT INTO "AdminUser" (id, username, "createdAt", "updatedAt")
    VALUES ('gate-c-admin', 'gate-c-admin', now(), now());
    INSERT INTO "ArtistProfile" (id, slug, "displayName", "draftUpdatedAt", "createdAt", "updatedAt")
    VALUES ('gate-c-existing-artist', 'gate-c-existing-artist', 'Gate C Existing Artist', now(), now(), now());
    INSERT INTO "Release" (id, title, slug, "isPublished", "createdOn", "updatedOn")
    VALUES ('gate-c-base-release', 'Gate C Base Release', 'gate-c-base-release', true, now(), now());
    INSERT INTO "AppearsOn" (id, title, artists, "coverArtUrl", "spotifyUrl", "isPublished", "createdAt", "updatedAt")
    VALUES ('gate-c-appears-on', 'Gate C Appears On', '["Gate C Existing Artist"]', '', '', true, now(), now());
    INSERT INTO "AppearsOnArtistCredit" (id, "appearsOnId", "artistProfileId", role, "createdAt", "updatedAt", "artistLinkId")
    VALUES ('gate-c-appears-on-credit', 'gate-c-appears-on', 'gate-c-existing-artist', 'FEATURED', now(), now(), NULL);
    INSERT INTO "BreakingBarzCategory" (id, name, slug, "sortOrder", "isActive", "createdAt", "updatedAt")
    VALUES ('gate-c-bb-category', 'Wordplay', 'gate-c-wordplay', 10, true, now(), now());
    INSERT INTO "BreakingBarzEntry" (id, slug, "releaseId", "songTitle", "artistNames", status, "createdAt", "updatedAt")
    VALUES ('gate-c-bb-entry', 'gate-c-bb-entry', 'gate-c-base-release', 'Gate C Bar', '["Gate C Existing Artist"]', 'draft', now(), now());
    INSERT INTO "BreakingBarzVersion" (id, "entryId", version, "songTitle", "artistNames", "lyricExcerpt", summary, breakdown, "verificationStatus", "verificationNote", "editorialStatus", "createdAt")
    VALUES ('gate-c-bb-version', 'gate-c-bb-entry', 1, 'Gate C Bar', '["Gate C Existing Artist"]', 'Synthetic line', 'Synthetic summary', 'Synthetic breakdown', 'interpretation', '', 'draft', now());
    INSERT INTO "BreakingBarzEntryCategory" ("entryId", "categoryId") VALUES ('gate-c-bb-entry', 'gate-c-bb-category');
  `);
}

async function startingFingerprint(db) {
  const result = await db.query(`
    SELECT
      (SELECT count(*)::int FROM "AppearsOnArtistCredit") AS appears_on_credits,
      (SELECT count("artistLinkId")::int FROM "AppearsOnArtistCredit") AS populated_artist_links,
      (SELECT count(*)::int FROM "BreakingBarzEntry") AS breaking_barz_entries,
      (SELECT count(*)::int FROM "ArtistProfile") AS artist_profiles,
      (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1)) AS retention_tables
  `, [retentionTables]);
  return result.rows[0];
}

function encryptArtifact(buffer, secret) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret, "utf8").digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.from(JSON.stringify({
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  }));
}

function decryptArtifact(buffer, secret) {
  const value = JSON.parse(buffer.toString("utf8"));
  assert.equal(value.version, 1);
  assert.equal(value.algorithm, "aes-256-gcm");
  const key = crypto.createHash("sha256").update(secret, "utf8").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64url")), decipher.final()]);
}

async function exportSnapshot(state, database, name) {
  const snapshotPath = path.join(rehearsalRoot, `${name}.json`);
  runNode("Generate current PostgreSQL Prisma client", ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], databaseEnv(state, database));
  runNode("Export disposable snapshot", ["--conditions=react-server", "--import", "tsx", "scripts/export-db-snapshot.ts"], databaseEnv(state, database, {DB_SNAPSHOT_PATH: snapshotPath}));
  return {snapshotPath, bytes: await fs.readFile(snapshotPath)};
}

async function uploadEncryptedSnapshot(snapshotBytes, label) {
  const secret = process.env.BACKUP_ENCRYPTION_SECRET?.trim();
  assert.ok(secret && secret.length >= 32, "BACKUP_ENCRYPTION_SECRET is required for Gate C.");
  const compressed = zlib.gzipSync(snapshotBytes);
  const encrypted = encryptArtifact(compressed, secret);
  const checksum = crypto.createHash("sha256").update(encrypted).digest("hex");
  const storage = await import("../lib/server/private-object-storage.ts");
  const stored = await storage.storePrivateObject({namespace: "database-backups", data: encrypted});
  const downloaded = await storage.readPrivateObject("database-backups", stored.key, {expectedSha256: checksum});
  assert.deepEqual(downloaded.buffer, encrypted);
  assert.deepEqual(zlib.gunzipSync(decryptArtifact(downloaded.buffer, secret)), snapshotBytes);
  return {label, key: stored.key, sizeBytes: encrypted.byteLength, checksumSha256: checksum, encryptionVersion: 1, createdAt: stored.createdAt.toISOString()};
}

async function restoreStartingSnapshot(state, embedded, snapshotPath, database) {
  await embedded.createDatabase(database);
  pushSchema(state, database, baselineSchemaPath);
  runNode("Import starting-state snapshot", ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], databaseEnv(state, database, {DB_SNAPSHOT_PATH: snapshotPath, IMPORT_AUTH: "1"}));
  const restored = await client(state, database);
  try {
    return await startingFingerprint(restored);
  } finally {
    await restored.end();
  }
}

function generatedDiff(state) {
  const result = runNode("Generate current PostgreSQL diff", [
    "scripts/run-prisma.mjs", "migrate", "diff",
    "--from-url", databaseUrl(state),
    "--to-schema-datamodel", "prisma/schema.postgres.prisma",
    "--script"
  ], databaseEnv(state));
  return result.stdout.trim();
}

function classifyDiff(diff) {
  const operations = diff.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^(ALTER|DROP|CREATE|INSERT|UPDATE|DELETE)\b/i.test(line));
  const destructive = operations.filter((line) => /\bDROP\b/i.test(line));
  const expectedDestructive = [
    'ALTER TABLE "AppearsOnArtistCredit" DROP CONSTRAINT "AppearsOnArtistCredit_artistLinkId_fkey";',
    'ALTER TABLE "AppearsOnArtistCredit" DROP COLUMN "artistLinkId";'
  ];
  assert.deepEqual(destructive, expectedDestructive);
  assert.equal((diff.match(/CREATE TABLE/g) || []).length, 13);
  assert.equal((diff.match(/DROP TABLE/g) || []).length, 0);
  return {operationCount: operations.length, destructive, unexpected: []};
}

async function preflight(db) {
  await db.query(await sqlFile("01-preflight.sql"));
  const fingerprint = await startingFingerprint(db);
  assert.equal(fingerprint.populated_artist_links, 0);
  assert.equal(fingerprint.retention_tables, 0);
  return fingerprint;
}

async function prepare() {
  await fs.rm(rehearsalRoot, {recursive: true, force: true});
  await fs.mkdir(rehearsalRoot, {recursive: true});
  const state = {
    baselineCommit,
    port: await freePort(),
    password: crypto.randomBytes(32).toString("base64url"),
    database: rehearsalDatabase,
    preparedAt: new Date().toISOString()
  };
  await writeState(state);
  await materializeBaselineSchema();
  await withServer(state, async (embedded) => {
    await embedded.createDatabase(rehearsalDatabase);
    const db = await client(state);
    try {
      await createRolesAndDefaults(db);
    } finally {
      await db.end();
    }
    pushSchema(state, rehearsalDatabase, baselineSchemaPath);
    const seeded = await client(state);
    try {
      await seedStartingFixtures(seeded);
      await seeded.query(await fs.readFile(path.join(root, "prisma", "deployment", "breaking-barz-access", "02-enable-rls-and-revoke.sql"), "utf8"));
      state.startingState = await preflight(seeded);
    } finally {
      await seeded.end();
    }
    const exported = await exportSnapshot(state, rehearsalDatabase, "starting-state");
    state.startingBackup = await uploadEncryptedSnapshot(exported.bytes, "gate-c-starting-state");
    state.startingBackup.snapshotPath = exported.snapshotPath;
    const restoredFingerprint = await restoreStartingSnapshot(state, embedded, exported.snapshotPath, "gate_c_starting_restore");
    assert.deepEqual(restoredFingerprint, state.startingState);
    state.startingBackup.restoreVerified = true;
    const diff = generatedDiff(state);
    state.diff = {...classifyDiff(diff), checksumSha256: crypto.createHash("sha256").update(diff).digest("hex")};
    const header = `-- REGENERATED GATE C REHEARSAL PREVIEW: ${new Date().toISOString()}\n-- Baseline commit: ${baselineCommit}\n-- SHA-256 (SQL body): ${state.diff.checksumSha256}\n-- Classification: 13 additive tables; only artistLinkId FK and empty column removal are destructive.\n`;
    await fs.writeFile(previewPath, `${header}${diff}\n`);
    await writeState(state);
  }, true);
  console.log(JSON.stringify({
    mode: "prepare",
    postgres: "17.x embedded native PostgreSQL",
    database: rehearsalDatabase,
    startingState: state.startingState,
    startingBackup: {...state.startingBackup, snapshotPath: undefined},
    diff: state.diff
  }, null, 2));
}

async function expectDenied(db, role, table, operation) {
  const sql = operation === "SELECT" ? `SELECT * FROM "${table}" LIMIT 0`
    : operation === "INSERT" ? `INSERT INTO "${table}" DEFAULT VALUES`
    : operation === "UPDATE" ? `UPDATE "${table}" SET id=id WHERE false`
    : `DELETE FROM "${table}" WHERE false`;
  await db.query("BEGIN");
  try {
    await db.query(`SET LOCAL ROLE ${role}`);
    await db.query(sql);
    assert.fail(`${role} ${operation} unexpectedly succeeded on ${table}`);
  } catch (error) {
    assert.equal(error.code, "42501");
  } finally {
    await db.query("ROLLBACK");
  }
}

async function seedConstraintFixtures(db) {
  await db.query(`
    INSERT INTO "Release" (id, title, slug, "primaryArtistProfileId", "releaseDate", "createdOn", "updatedOn")
    VALUES ('gate-c-retention-release', 'Gate C Retention Release', 'gate-c-retention-release', 'artist-profile-vvviruz', '2026-06-10', now(), now());
    INSERT INTO "AnalyticsImport" (id, "importType", "originalFilename", "fileHash", "artistProfileId", "uploadedAt", status, "createdAt", "updatedAt")
    VALUES ('gate-c-check-import', 'ARTIST_AUDIENCE_TIMELINE', 'synthetic.csv', repeat('a',64), 'artist-profile-vvviruz', now(), 'IMPORTED', now(), now());
    INSERT INTO "AnalyticsImportRow" (id, "importId", "sourceRowNumber", "exportType", "rowIdentityKey", "structuralOutcome", "createdAt", "updatedAt")
    VALUES ('gate-c-check-row', 'gate-c-check-import', 2, 'SONGS_PERIOD', 'gate-c-row', 'ACCEPTED', now(), now());
    INSERT INTO "ArtistMetricObservation" (id, "importId", "artistProfileId", "metricDate", listeners, "monthlyListeners", "monthlyActiveListeners", streams, "playlistAdds", saves, followers, "createdAt")
    VALUES ('gate-c-check-artist-metric', 'gate-c-check-import', 'artist-profile-vvviruz', '2026-06-01', 1,1,1,1,1,1,1,now());
    INSERT INTO "TrackMetricObservation" (id, "importId", "releaseId", "metricDate", streams, "createdAt")
    VALUES ('gate-c-check-track-metric', 'gate-c-check-import', 'gate-c-retention-release', '2026-06-01', 1, now());
    INSERT INTO "SongPeriodSnapshot" (id, "importId", "releaseId", "periodStart", "periodEnd", "exportedTitle", "exportedReleaseDate", listeners, streams, saves, "createdAt", "mappingRowId")
    VALUES ('gate-c-check-song', 'gate-c-check-import', 'gate-c-retention-release', '2026-06-01', '2026-06-30', 'Gate C', '2026-06-10', 1,1,1,now(),'gate-c-check-row');
    INSERT INTO "PlaylistPeriodSnapshot" (id, "importId", "playlistTitle", "playlistAuthor", "periodStart", "periodEnd", listeners, streams, "createdAt")
    VALUES ('gate-c-check-playlist', 'gate-c-check-import', 'Gate C Playlist', 'Gate C', '2026-06-01', '2026-06-30', 1,1,now());
    INSERT INTO "PromotionCampaign" (id, "artistProfileId", "releaseId", platform, name, objective, status, "createdAt", "updatedAt")
    VALUES ('gate-c-check-campaign', 'artist-profile-vvviruz', 'gate-c-retention-release', 'META', 'Gate C Campaign', 'STREAMS', 'DRAFT', now(), now());
    INSERT INTO "CampaignEvidence" (id, "campaignId", "sourceType", confidence, "importedStartDate", "importedEndDate", "spendStartDate", "spendEndDate", "suggestedStartDate", "suggestedEndDate", "createdAt", "updatedAt")
    VALUES ('gate-c-check-evidence','gate-c-check-campaign','MANUAL_REFERENCE','HIGH','2026-06-01','2026-06-30','2026-06-01','2026-06-30','2026-06-01','2026-06-30',now(),now());
    INSERT INTO "CampaignActiveInterval" (id, "campaignId", "activeStartDate", "activeEndDate", timezone, "sourceType", "confirmationStatus", "createdAt", "updatedAt")
    VALUES ('gate-c-check-interval','gate-c-check-campaign','2026-06-10','2026-06-20','UTC','MANUAL','CONFIRMED',now(),now());
    INSERT INTO "CampaignTimelineEvent" (id, "campaignId", "releaseId", "eventType", "eventDate", timezone, title, source, "confirmationStatus", "createdAt", "updatedAt")
    VALUES ('gate-c-check-event','gate-c-check-campaign','gate-c-retention-release','MANUAL_NOTE','2026-06-15','UTC','Gate C note','USER_ENTERED','CONFIRMED',now(),now());
  `);
}

async function verifyCheckEnforcement(db) {
  const attempts = {
    AnalyticsImport_status_check: `UPDATE "AnalyticsImport" SET status='INVALID' WHERE id='gate-c-check-import'`,
    AnalyticsImport_fileHash_check: `UPDATE "AnalyticsImport" SET "fileHash"='short' WHERE id='gate-c-check-import'`,
    AnalyticsImport_counts_check: `UPDATE "AnalyticsImport" SET "rowCount"=-1 WHERE id='gate-c-check-import'`,
    AnalyticsImport_normalizationVersion_check: `UPDATE "AnalyticsImport" SET "normalizationVersion"=0 WHERE id='gate-c-check-import'`,
    AnalyticsImport_rawFileSizeBytes_check: `UPDATE "AnalyticsImport" SET "rawFileSizeBytes"=-1 WHERE id='gate-c-check-import'`,
    AnalyticsImport_detectedPeriod_check: `UPDATE "AnalyticsImport" SET "detectedPeriodStart"='2026-07-02',"detectedPeriodEnd"='2026-07-01' WHERE id='gate-c-check-import'`,
    AnalyticsImport_confirmedPeriod_check: `UPDATE "AnalyticsImport" SET "userConfirmedPeriodStart"='2026-07-02',"userConfirmedPeriodEnd"='2026-07-01' WHERE id='gate-c-check-import'`,
    ArtistMetricObservation_metrics_check: `UPDATE "ArtistMetricObservation" SET listeners=-1 WHERE id='gate-c-check-artist-metric'`,
    TrackMetricObservation_metrics_check: `UPDATE "TrackMetricObservation" SET streams=-1 WHERE id='gate-c-check-track-metric'`,
    SongPeriodSnapshot_period_check: `UPDATE "SongPeriodSnapshot" SET "periodStart"='2026-07-01',"periodEnd"='2026-06-30' WHERE id='gate-c-check-song'`,
    SongPeriodSnapshot_metrics_check: `UPDATE "SongPeriodSnapshot" SET listeners=-1 WHERE id='gate-c-check-song'`,
    PlaylistPeriodSnapshot_period_check: `UPDATE "PlaylistPeriodSnapshot" SET "periodStart"='2026-07-01',"periodEnd"='2026-06-30' WHERE id='gate-c-check-playlist'`,
    PlaylistPeriodSnapshot_metrics_check: `UPDATE "PlaylistPeriodSnapshot" SET streams=-1 WHERE id='gate-c-check-playlist'`,
    PromotionCampaign_platform_check: `UPDATE "PromotionCampaign" SET platform='INVALID' WHERE id='gate-c-check-campaign'`,
    PromotionCampaign_objective_check: `UPDATE "PromotionCampaign" SET objective='INVALID' WHERE id='gate-c-check-campaign'`,
    PromotionCampaign_status_check: `UPDATE "PromotionCampaign" SET status='INVALID' WHERE id='gate-c-check-campaign'`,
    PromotionCampaign_name_check: `UPDATE "PromotionCampaign" SET name=' ' WHERE id='gate-c-check-campaign'`,
    CampaignEvidence_sourceType_check: `UPDATE "CampaignEvidence" SET "sourceType"='INVALID' WHERE id='gate-c-check-evidence'`,
    CampaignEvidence_confidence_check: `UPDATE "CampaignEvidence" SET confidence='INVALID' WHERE id='gate-c-check-evidence'`,
    CampaignEvidence_imported_dates_check: `UPDATE "CampaignEvidence" SET "importedStartDate"='2026-07-02',"importedEndDate"='2026-07-01' WHERE id='gate-c-check-evidence'`,
    CampaignEvidence_spend_dates_check: `UPDATE "CampaignEvidence" SET "spendStartDate"='2026-07-02',"spendEndDate"='2026-07-01' WHERE id='gate-c-check-evidence'`,
    CampaignEvidence_suggested_dates_check: `UPDATE "CampaignEvidence" SET "suggestedStartDate"='2026-07-02',"suggestedEndDate"='2026-07-01' WHERE id='gate-c-check-evidence'`,
    CampaignActiveInterval_sourceType_check: `UPDATE "CampaignActiveInterval" SET "sourceType"='INVALID' WHERE id='gate-c-check-interval'`,
    CampaignActiveInterval_confirmationStatus_check: `UPDATE "CampaignActiveInterval" SET "confirmationStatus"='INVALID' WHERE id='gate-c-check-interval'`,
    CampaignActiveInterval_dates_check: `UPDATE "CampaignActiveInterval" SET "activeStartDate"='2026-07-02',"activeEndDate"='2026-07-01' WHERE id='gate-c-check-interval'`,
    CampaignActiveInterval_timezone_check: `UPDATE "CampaignActiveInterval" SET timezone=' ' WHERE id='gate-c-check-interval'`,
    CampaignTimelineEvent_eventType_check: `UPDATE "CampaignTimelineEvent" SET "eventType"='INVALID' WHERE id='gate-c-check-event'`,
    CampaignTimelineEvent_source_check: `UPDATE "CampaignTimelineEvent" SET source='INVALID' WHERE id='gate-c-check-event'`,
    CampaignTimelineEvent_confirmationStatus_check: `UPDATE "CampaignTimelineEvent" SET "confirmationStatus"='INVALID' WHERE id='gate-c-check-event'`,
    CampaignTimelineEvent_timezone_check: `UPDATE "CampaignTimelineEvent" SET timezone=' ' WHERE id='gate-c-check-event'`
  };
  assert.deepEqual(Object.keys(attempts).sort(), [...checkNames].sort());
  const results = [];
  for (const [name, sql] of Object.entries(attempts)) {
    await db.query("BEGIN");
    try {
      await db.query(sql);
      assert.fail(`${name} accepted invalid data.`);
    } catch (error) {
      assert.equal(error.code, "23514", `${name} should fail with check_violation.`);
      assert.equal(error.constraint, name);
      results.push({name, sqlstate: error.code});
    } finally {
      await db.query("ROLLBACK");
    }
  }
  return results;
}

async function verifyCanonicalAmbiguity(db) {
  const seed = await sqlFile("04-canonical-artist.sql");
  await db.query(seed);
  const tests = [
    ["conflicting-slug", `DELETE FROM "ArtistProfile" WHERE id='artist-profile-vvviruz'; INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('gate-c-conflict','vvviruz','Different',now(),now(),now());`],
    ["same-display-name", `DELETE FROM "ArtistProfile" WHERE id='artist-profile-vvviruz'; INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('gate-c-conflict','different','VVVIRUZ',now(),now(),now());`],
    ["incompatible-existing", `UPDATE "ArtistProfile" SET "workflowStatus"='PUBLISHED',"publishedAt"=now() WHERE id='artist-profile-vvviruz';`]
  ];
  const results = [];
  for (const [name, fixture] of tests) {
    await db.query("BEGIN");
    try {
      await db.query(fixture);
      await db.query(seed);
      assert.fail(`${name} ambiguity unexpectedly passed.`);
    } catch (error) {
      assert.equal(error.code, "P0001");
      results.push({name, sqlstate: error.code});
    } finally {
      await db.query("ROLLBACK");
    }
  }
  return results;
}

async function deploy() {
  const state = await readState();
  await withServer(state, async () => {
    const db = await client(state);
    try {
      const version = (await db.query("SELECT current_setting('server_version') AS version")).rows[0].version;
      assert.match(version, /^17\./);
      const before = await preflight(db);
      assert.deepEqual(before, state.startingState);
      const currentDiff = generatedDiff(state);
      const currentChecksum = crypto.createHash("sha256").update(currentDiff).digest("hex");
      assert.equal(currentChecksum, state.diff.checksumSha256);
      classifyDiff(currentDiff);
      pushSchema(state, rehearsalDatabase, "prisma/schema.postgres.prisma", true);
      await db.query(await sqlFile("03-post-push-constraints-and-access.sql"));
      await db.query(await sqlFile("04-canonical-artist.sql"));
      await db.query(await sqlFile("04-canonical-artist.sql"));
      await db.query(await sqlFile("05-verify.sql"));

      const catalog = await db.query(`
        SELECT
          (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname=ANY($1)) AS tables,
          (SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::regnamespace AND t.relname=ANY($1) AND c.contype='p') AS primary_keys,
          (SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::regnamespace AND t.relname=ANY($1) AND c.contype='f') AS foreign_keys,
          (SELECT count(*)::int FROM pg_constraint WHERE conname=ANY($2) AND contype='c') AS checks,
          (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1)) AS indexes,
          (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1) AND c.relrowsecurity AND NOT c.relforcerowsecurity) AS rls_tables,
          (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1)) AS policies,
          (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='AppearsOnArtistCredit' AND column_name='artistLinkId') AS artist_link_columns
      `, [retentionTables, checkNames]);
      const counts = catalog.rows[0];
      assert.equal(counts.tables, 13);
      assert.equal(counts.primary_keys, 13);
      assert.equal(counts.checks, 30);
      assert.equal(counts.rls_tables, 13);
      assert.equal(counts.policies, 0);
      assert.equal(counts.artist_link_columns, 0);
      assert.ok(counts.foreign_keys >= 30);
      assert.ok(counts.indexes >= 50);

      for (const role of ["anon", "authenticated", "service_role"]) {
        for (const table of retentionTables) {
          for (const operation of ["SELECT", "INSERT", "UPDATE", "DELETE"]) await expectDenied(db, role, table, operation);
        }
      }
      const trusted = await db.query('SELECT count(*)::int AS count FROM "AnalyticsImport"');
      assert.equal(trusted.rows[0].count, 0);
      await seedConstraintFixtures(db);
      const checks = await verifyCheckEnforcement(db);
      const ambiguity = await verifyCanonicalAmbiguity(db);
      const canonical = (await db.query(`SELECT id,slug,"displayName","workflowStatus","publishedAt","publishedVersionId" FROM "ArtistProfile" WHERE id='artist-profile-vvviruz'`)).rows;
      assert.deepEqual(canonical, [{id: "artist-profile-vvviruz", slug: "vvviruz", displayName: "vvviruz", workflowStatus: "DRAFT", publishedAt: null, publishedVersionId: null}]);
      state.deployment = {
        deployedAt: new Date().toISOString(),
        postgresVersion: version,
        diffChecksumSha256: currentChecksum,
        exactOrder: ["starting-backup", "preflight", "prisma-db-push", "post-push-companion", "canonical-artist", "verification"],
        catalog: counts,
        roleDenials: 3 * retentionTables.length * 4,
        checkViolations: checks,
        canonical,
        ambiguity
      };
      await writeState(state);
      console.log(JSON.stringify({mode: "deploy", ...state.deployment}, null, 2));
    } finally {
      await db.end();
    }
  });
}

async function status() {
  const state = await readState();
  console.log(JSON.stringify({
    baselineCommit: state.baselineCommit,
    database: state.database,
    preparedAt: state.preparedAt,
    diff: state.diff,
    startingBackup: state.startingBackup && {...state.startingBackup, snapshotPath: undefined},
    deployment: state.deployment || null
  }, null, 2));
}

async function cleanupKey() {
  const key = process.argv[3];
  assert.match(key || "", /^database-backups\/[0-9a-f-]{36}\.json\.gz\.enc$/i);
  const storage = await import("../lib/server/private-object-storage.ts");
  await storage.deletePrivateObject("database-backups", key);
  console.log(JSON.stringify({mode: "cleanup-key", removed: true}));
}

const mode = process.argv[2];
if (mode === "prepare") await prepare();
else if (mode === "deploy") await deploy();
else if (mode === "status") await status();
else if (mode === "cleanup-key") await cleanupKey();
else throw new Error("Use prepare, deploy, or status.");
