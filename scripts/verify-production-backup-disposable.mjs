import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {spawn, spawnSync} from "node:child_process";

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

import backupVerificationIntegrity from "../lib/backups/backup-verification-integrity.ts";
import disposableRestoreGuard from "../lib/backups/disposable-restore-guard.ts";
import googleDriveRetrieval from "../lib/backups/google-drive-retrieval.ts";

// Prisma stores these DateTime values as timezone-naive PostgreSQL timestamps.
// Preserve the timezone used to freeze the approved fingerprints so identical
// rows hash consistently on local Windows and UTC Vercel build workers.
process.env.TZ = "America/New_York";

const {verifyAndDecodeBackup} = backupVerificationIntegrity;
const {assertDisposableRestoreTarget, DISPOSABLE_DATABASE_PREFIX} = disposableRestoreGuard;
const {readNormalizedGoogleDriveOAuthCredentials, retrievePinnedEncryptedGoogleDriveBackup, sanitizedBackupRetrievalFailure} = googleDriveRetrieval;

const {Client} = pg;
const APPROVED = Object.freeze({
  backupRunId: "70e04de9-3ab8-459c-971b-c23cd404a04e",
  encryptedSha256: "efb7561a0f0279692b873fa178801432668dfe8e1ba8c31461d891b1de7d32a0",
  sizeBytes: 5_975_016,
  gameOverImportId: "e2a5a408-02ea-426b-910a-2015124877ad"
});
const EXPECTED_SPOTIFY = Object.freeze({
  analyticsImports: {count: 5, sha256: "0dab3136b7a034cb610d1f6e0f499b740d5fc059f33ae35bcb00aede1de2b51f"},
  artistTimeline: {count: 944, sha256: "ca4c182e1b6e81406c1f6a808ffc734699b06acf662f66fe17922d9e963f8923"},
  mahoragaTrackTimeline: {count: 944, sha256: "2eda2e032d76c870c0ada11380c637ba085cf3f9e2d2b8bda6d8e4081c96e1ea"},
  songsPeriod: {count: 27, sha256: "0d94610b1baaee3e4acab12c596b89e938541b4405236ea2fc00794eeb4822e2"},
  playlistsPeriod: {count: 8, sha256: "bca161344f5fb8b08a6e9c9dec6b5cf4d850cd00613b423a74262bfa8dd107f6"},
  gameOverTrackTimeline: {count: 952, sha256: "91e4bb2d8811b2ee6476b633c2593b44ac2f6edd1551552e120b2c221932e0de"}
});
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
let phase = "configuration";
let failed = false;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required server configuration ${name} is absent.`);
  return value;
}

function connectionOptions(url, production = false) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return {connectionString: parsed.toString(), ...(production ? {ssl: {rejectUnauthorized: false}} : {})};
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function spotifyFingerprint(client) {
  phase = "state-spotify-analytics-imports-read";
  const analyticsImports = (await client.query(`SELECT id,"fileHash","importType",status,"rowCount","acceptedRowCount","rejectedRowCount","unmatchedRowCount","warningCount","acceptedAt","withdrawnAt","replacedByImportId" FROM "AnalyticsImport" ORDER BY id`)).rows;
  phase = "state-spotify-artist-timeline-read";
  const artistTimeline = (await client.query(`SELECT o.* FROM "ArtistMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" WHERE i.status='IMPORTED' ORDER BY o.id`)).rows;
  phase = "state-spotify-mahoraga-track-read";
  const mahoragaTrackTimeline = (await client.query(`SELECT o.* FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title ILIKE '%mahoraga%' ORDER BY o.id`)).rows;
  phase = "state-spotify-songs-read";
  const songsPeriod = (await client.query(`SELECT s.* FROM "SongPeriodSnapshot" s JOIN "AnalyticsImport" i ON i.id=s."importId" WHERE i.status='IMPORTED' ORDER BY s.id`)).rows;
  phase = "state-spotify-playlists-read";
  const playlistsPeriod = (await client.query(`SELECT p.* FROM "PlaylistPeriodSnapshot" p JOIN "AnalyticsImport" i ON i.id=p."importId" WHERE i.status='IMPORTED' ORDER BY p.id`)).rows;
  phase = "state-spotify-game-over-track-read";
  const gameOverTrackTimeline = (await client.query(`SELECT o.* FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title='Game Over' ORDER BY o.id`)).rows;
  return {
    analyticsImports: {count: analyticsImports.length, sha256: digest(analyticsImports)},
    artistTimeline: {count: artistTimeline.length, sha256: digest(artistTimeline)},
    mahoragaTrackTimeline: {count: mahoragaTrackTimeline.length, sha256: digest(mahoragaTrackTimeline)},
    songsPeriod: {count: songsPeriod.length, sha256: digest(songsPeriod)},
    playlistsPeriod: {count: playlistsPeriod.length, sha256: digest(playlistsPeriod)},
    gameOverTrackTimeline: {count: gameOverTrackTimeline.length, sha256: digest(gameOverTrackTimeline)}
  };
}

async function stateFingerprint(client) {
  phase = "state-counts-read";
  const counts = (await client.query(`
    SELECT
      (SELECT count(*)::int FROM "AdImportBatch") batches,
      (SELECT count(*)::int FROM "AdImportBatch" WHERE "sourceGranularity"='AGGREGATE_SNAPSHOT') legacy_batches,
      (SELECT count(*)::int FROM "AdImportBatch" WHERE "sourceGranularity"='DAILY' AND "importState"='ACCEPTED') daily_imports,
      (SELECT count(*)::int FROM "AdCreativeReport") reports,
      (SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links,
      (SELECT count(*)::int FROM "MetaDailySourceObservation") source_observations,
      (SELECT count(*)::int FROM "MetaDailyResolution") resolutions,
      (SELECT count(*)::int FROM "MetaPromotionLink") meta_links,
      (SELECT count(*)::int FROM "PromotionCampaign") campaigns,
      (SELECT count(*)::int FROM "CampaignActiveInterval" WHERE "confirmationStatus"='CONFIRMED') confirmed_intervals
  `)).rows[0];
  phase = "state-game-over-read";
  const gameOver = (await client.query(`
    SELECT b.id,b."importState",b."validationState",b."sourceAsOfOrigin",b."reportingStart",b."reportingEnd",
      count(*)::int facts,
      count(*) FILTER (WHERE o.spend > 0)::int positive,
      count(*) FILTER (WHERE o.spend = 0)::int explicit_zero,
      count(*) FILTER (WHERE o.spend IS NULL)::int missing,
      round(sum(o.spend)::numeric,2)::text spend,
      count(DISTINCT o."adSetId")::int ad_set_count,
      min(o."adSetId") ad_set_id,
      min(o."sourceReportingDate") start_date,max(o."sourceReportingDate") end_date
    FROM "AdImportBatch" b
    JOIN "MetaDailySourceObservation" o ON o."importBatchId"=b.id AND o."metricKey"='SPEND'
    JOIN "MetaDailyResolution" r ON r."currentObservationId"=o.id
    WHERE b.id=$1 GROUP BY b.id
  `, [APPROVED.gameOverImportId])).rows[0];
  phase = "state-details-read";
  const details = (await client.query(`
    SELECT
      (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId"=$1) provenance_files,
      (SELECT count(*)::int FROM "MetaImportFile" WHERE "importBatchId"=$1 AND "rawStorageKey"<>'' AND "rawStorageSha256"<>'') raw_provenance_files,
      (SELECT count(*)::int FROM "MetaImportAuditEvent" WHERE "importBatchId"=$1 AND action='IMPORT_ACCEPTED') acceptance_audits,
      (SELECT count(*)::int FROM "MetaDailyResolution" r JOIN "MetaDailySourceObservation" o ON o.id=r."currentObservationId" JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"=(SELECT id FROM "Release" WHERE title ILIKE '%mahoraga%' ORDER BY id LIMIT 1) AND b."sourceGranularity"='DAILY') mahoraga_facts,
      (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT' AND "accountId"='367019114407672' AND "ianaTimezone"='America/Los_Angeles') timezone_matches,
      (SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT') current_timezones
  `, [APPROVED.gameOverImportId])).rows[0];
  const spotify = await spotifyFingerprint(client);
  return {counts, gameOver, details, spotify, sha256: digest({counts, gameOver, details, spotify})};
}

function assertExpectedState(state) {
  phase = "invariant-foundation-counts";
  assert.deepEqual(state.counts, {batches: 18, legacy_batches: 17, daily_imports: 1, reports: 360, copy_links: 109, source_observations: 255, resolutions: 255, meta_links: 0, campaigns: 0, confirmed_intervals: 0});
  phase = "invariant-game-over";
  assert.equal(state.gameOver.id, APPROVED.gameOverImportId);
  assert.equal(state.gameOver.importState, "ACCEPTED");
  assert.equal(state.gameOver.facts, 210);
  assert.equal(state.gameOver.positive, 60);
  assert.equal(state.gameOver.explicit_zero, 150);
  assert.equal(state.gameOver.missing, 0);
  assert.equal(state.gameOver.spend, "283.48");
  assert.equal(state.gameOver.ad_set_count, 1);
  assert.equal(state.gameOver.ad_set_id, "120247925536670172");
  assert.equal(state.gameOver.start_date, "2026-07-11");
  assert.equal(state.gameOver.end_date, "2026-08-09");
  assert.equal(state.gameOver.sourceAsOfOrigin, "IMPORT_ACCEPTED_FALLBACK");
  phase = "invariant-provenance-and-timezone";
  assert.deepEqual(state.details, {provenance_files: 4, raw_provenance_files: 4, acceptance_audits: 1, mahoraga_facts: 0, timezone_matches: 1, current_timezones: 1});
  for (const key of Object.keys(EXPECTED_SPOTIFY)) {
    phase = `invariant-spotify-${key}`;
    assert.deepEqual(state.spotify[key], EXPECTED_SPOTIFY[key]);
  }
}

function run(command, args, env, input) {
  const result = spawnSync(command, args, {cwd: process.cwd(), env, input, encoding: input ? undefined : "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});
  if (result.status !== 0) throw new Error("Disposable restore subprocess failed safely.");
  return result;
}

function spawnChecked(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {...options, stdio: ["ignore", "ignore", "pipe"]});
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) return resolve();
      const normalized = stderr.toLowerCase();
      const operationCode = normalized.includes("cannot be run as root") ? "E_RUNTIME_ROOT"
        : normalized.includes("error while loading shared libraries") ? "E_RUNTIME_LIBRARY"
          : normalized.includes("permission denied") ? "E_RUNTIME_PERMISSION"
            : normalized.includes("no such file or directory") ? "E_RUNTIME_FILE"
              : normalized.includes("locale") ? "E_RUNTIME_LOCALE"
                : "E_SUBPROCESS_EXIT";
      const error = new Error(`Disposable PostgreSQL subprocess exited safely with code ${code}.`);
      error.code = operationCode;
      reject(error);
    });
  });
}

function postgresRuntimeIdentity() {
  const processUid = process.getuid?.();
  const shellUid = Number(spawnSync("id", ["-u"], {encoding: "utf8"}).stdout?.trim());
  const runtimeUid = shellUid === 0 ? shellUid : processUid;
  if (runtimeUid !== 0) return {};
  let uid = Number(spawnSync("id", ["-u", "postgres"], {encoding: "utf8"}).stdout?.trim());
  let gid = Number(spawnSync("id", ["-g", "postgres"], {encoding: "utf8"}).stdout?.trim());
  if (!Number.isInteger(uid) || !Number.isInteger(gid)) {
    spawnSync("groupadd", ["postgres"], {stdio: "ignore"});
    spawnSync("useradd", ["-g", "postgres", "postgres"], {stdio: "ignore"});
    uid = Number(spawnSync("id", ["-u", "postgres"], {encoding: "utf8"}).stdout?.trim());
    gid = Number(spawnSync("id", ["-g", "postgres"], {encoding: "utf8"}).stdout?.trim());
  }
  assert.ok(Number.isInteger(uid) && Number.isInteger(gid), "Disposable PostgreSQL runtime user is unavailable.");
  return {uid, gid};
}

class VercelTmpEmbeddedPostgres {
  constructor(options) {
    this.options = options;
    this.runtimeDirectory = path.join(path.dirname(options.databaseDir), "postgres-runtime");
    this.nativeDirectory = path.join(this.runtimeDirectory, "native");
  }

  runtimeEnv() {
    return {...process.env, PATH: `${path.join(this.nativeDirectory, "bin")}:${process.env.PATH || ""}`, LD_LIBRARY_PATH: path.join(this.nativeDirectory, "lib"), LC_MESSAGES: "C"};
  }

  runtimeInvocation(command, args) {
    if (this.useRunuser) {
      return {command: "runuser", args: ["-u", "postgres", "--", command, ...args], options: {env: this.runtimeEnv()}};
    }
    return {command, args, options: {...this.identity, env: this.runtimeEnv()}};
  }

  async initialise() {
    phase = "disposable-runtime-copy";
    const packageRoot = path.resolve(process.cwd(), "node_modules", "@embedded-postgres", "linux-x64");
    const source = path.join(packageRoot, "native");
    const hydrateScript = path.join(packageRoot, "scripts", "hydrate-symlinks.js");
    const approvedRoot = `${packageRoot}${path.sep}`;
    assert.ok(source.startsWith(approvedRoot), "Embedded PostgreSQL source path guard failed.");
    assert.ok(hydrateScript.startsWith(approvedRoot), "Embedded PostgreSQL hydration path guard failed.");
    await fs.cp(source, this.nativeDirectory, {recursive: true, dereference: false});
    phase = "disposable-runtime-symlinks";
    await spawnChecked(process.execPath, [hydrateScript], {cwd: this.runtimeDirectory, env: process.env});
    phase = "disposable-runtime-permissions";
    for (const entry of await fs.readdir(path.join(this.nativeDirectory, "bin"), {withFileTypes: true})) {
      if (entry.isFile()) await fs.chmod(path.join(this.nativeDirectory, "bin", entry.name), 0o755);
    }
    await fs.mkdir(this.options.databaseDir, {recursive: true});
    phase = "disposable-runtime-identity";
    this.identity = postgresRuntimeIdentity();
    if (this.identity.uid !== undefined) {
      await fs.chown(path.dirname(this.options.databaseDir), this.identity.uid, this.identity.gid);
      await fs.chown(this.options.databaseDir, this.identity.uid, this.identity.gid);
      phase = "disposable-runtime-identity-fallback";
      const runuserProbe = spawnSync("runuser", ["-u", "postgres", "--", "id", "-u"], {encoding: "utf8"});
      assert.equal(runuserProbe.status, 0, "Disposable runtime could not switch to its unprivileged user.");
      assert.equal(Number(runuserProbe.stdout?.trim()), this.identity.uid, "Disposable runtime user identity mismatch.");
      this.useRunuser = true;
    }
    const passwordFile = path.join(os.tmpdir(), `pg-password-${crypto.randomBytes(8).toString("hex")}`);
    await fs.writeFile(passwordFile, `${this.options.password}\n`, {mode: 0o600});
    if (this.identity.uid !== undefined) await fs.chown(passwordFile, this.identity.uid, this.identity.gid);
    try {
      phase = "disposable-initdb";
      const initdb = this.runtimeInvocation(path.join(this.nativeDirectory, "bin", "initdb"), [`--pgdata=${this.options.databaseDir}`, "--auth=password", `--username=${this.options.user}`, `--pwfile=${passwordFile}`, "--locale=C"]);
      await spawnChecked(initdb.command, initdb.args, initdb.options);
    } finally {
      await fs.unlink(passwordFile).catch(() => {});
    }
  }

  async start() {
    phase = "disposable-postgres-start";
    await new Promise((resolve, reject) => {
      const command = path.join(this.nativeDirectory, "bin", "postgres");
      const invocation = this.runtimeInvocation(command, ["-D", this.options.databaseDir, "-p", String(this.options.port), "-h", "127.0.0.1"]);
      this.process = spawn(invocation.command, invocation.args, {...invocation.options, stdio: ["ignore", "ignore", "pipe"]});
      let settled = false;
      this.process.once("error", reject);
      this.process.stderr?.on("data", (chunk) => {
        if (!settled && chunk.toString("utf8").includes("database system is ready to accept connections")) { settled = true; resolve(); }
      });
      this.process.once("close", (code) => { if (!settled) reject(new Error(`Disposable PostgreSQL exited before readiness (${code}).`)); });
    });
  }

  async createDatabase(name) {
    phase = "disposable-database-create";
    const admin = new Client({host: "127.0.0.1", port: this.options.port, user: this.options.user, password: this.options.password, database: "postgres"});
    await admin.connect();
    try { await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(name)}`); } finally { await admin.end(); }
  }

  async stop() {
    if (!this.process) return;
    const child = this.process;
    await new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGINT"); });
    this.process = undefined;
  }
}

let production;
let embedded;
let target;
let tempDirectory;
let targetIdentity;
try {
  const productionUrl = required("POSTGRES_URL_NON_POOLING");
  const productionIdentity = new URL(productionUrl);
  assert.ok(productionIdentity.hostname.endsWith("pooler.supabase.com"), "Production identity hostname guard failed.");
  assert.equal(productionIdentity.port, "5432", "Production identity port guard failed.");
  assert.ok(decodeURIComponent(productionIdentity.username).includes("qkwifxvfrotmmnjluhbt"), "Production identity project guard failed.");
  required("BACKUP_ENCRYPTION_SECRET");
  production = new Client(connectionOptions(productionUrl, true));
  phase = "production-connect";
  await production.connect();
  await production.query("BEGIN READ ONLY");
  phase = "production-state-read";
  const before = await stateFingerprint(production);
  phase = "production-state-invariants";
  assertExpectedState(before);
  phase = "approved-backup-metadata-read";
  const backupResult = await production.query(`SELECT id,status,"googleDriveFileId","sizeBytes","checksumSha256","startedAt","finishedAt" FROM "BackupRun" WHERE id=$1`, [APPROVED.backupRunId]);
  phase = "approved-backup-metadata-invariants";
  assert.equal(backupResult.rowCount, 1, "Approved backup run was not found.");
  const backup = backupResult.rows[0];
  assert.equal(backup.status, "success");
  assert.equal(backup.sizeBytes, APPROVED.sizeBytes);
  assert.equal(backup.checksumSha256, APPROVED.encryptedSha256);
  assert.ok(backup.googleDriveFileId, "Approved backup has no Drive reference.");
  await production.query("COMMIT");

  const credentialState = readNormalizedGoogleDriveOAuthCredentials();
  const encrypted = await retrievePinnedEncryptedGoogleDriveBackup({
    credentials: credentialState.credentials,
    expectedFileId: backup.googleDriveFileId,
    expectedSize: APPROVED.sizeBytes,
    expectedSha256: APPROVED.encryptedSha256,
    onPhase: (nextPhase) => { phase = nextPhase; }
  });
  phase = "encrypted-backup-integrity-and-decryption";
  const snapshot = verifyAndDecodeBackup(encrypted, APPROVED.encryptedSha256);

  const port = await freePort();
  const database = `${DISPOSABLE_DATABASE_PREFIX}${crypto.randomBytes(8).toString("hex")}`;
  const password = crypto.randomBytes(32).toString("base64url");
  const targetUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
  phase = "disposable-target-guard";
  targetIdentity = assertDisposableRestoreTarget({
    allowRestore: process.env.ALLOW_DISPOSABLE_BACKUP_RESTORE,
    targetKind: process.env.BACKUP_VERIFY_TARGET_KIND,
    targetUrl,
    productionUrls: [process.env.DATABASE_URL, process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL, productionUrl]
  });

  phase = "disposable-target-provisioning";
  tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-backup-verify-"));
  const databaseDirectory = path.join(tempDirectory, "data");
  const embeddedOptions = {databaseDir: databaseDirectory, user: "postgres", password, port, persistent: false, createPostgresUser: process.getuid?.() === 0, onLog: () => {}, onError: () => {}};
  embedded = process.platform === "linux" && process.arch === "x64" ? new VercelTmpEmbeddedPostgres(embeddedOptions) : new EmbeddedPostgres(embeddedOptions);
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(database);
  target = new Client(connectionOptions(targetUrl));
  await target.connect();
  assert.equal((await target.query(`SELECT count(*)::int count FROM pg_tables WHERE schemaname='public'`)).rows[0].count, 0, "Disposable target was not empty.");
  await target.end(); target = undefined;

  phase = "disposable-schema-initialization";
  const targetEnv = {...process.env, DATABASE_URL: targetUrl, DIRECT_URL: targetUrl, POSTGRES_PRISMA_URL: targetUrl, POSTGRES_URL: targetUrl, POSTGRES_URL_NON_POOLING: targetUrl};
  run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], targetEnv);
  target = new Client(connectionOptions(targetUrl)); await target.connect();
  await target.query(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await target.query(await fs.readFile(path.join(process.cwd(), "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
  await target.end(); target = undefined;

  phase = "in-memory-restore";
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], {...targetEnv, DB_SNAPSHOT_STDIN: "1", IMPORT_AUTH: "0"}, snapshot);
  snapshot.fill(0);
  encrypted.fill(0);

  phase = "restored-invariant-verification";
  target = new Client(connectionOptions(targetUrl)); await target.connect();
  const restored = await stateFingerprint(target);
  assertExpectedState(restored);
  assert.equal(restored.sha256, before.sha256, "Restored product fingerprint differs from protected production state.");
  await target.end(); target = undefined;

  phase = "production-isolation-verification";
  await production.query("BEGIN READ ONLY");
  const after = await stateFingerprint(production);
  await production.query("COMMIT");
  assertExpectedState(after);
  assert.equal(after.sha256, before.sha256, "Production state changed during disposable verification.");

  console.log(JSON.stringify({
    gate: "E2.1B",
    status: "success",
    backup: {runId: APPROVED.backupRunId, encryptedSha256: APPROVED.encryptedSha256, sizeBytes: APPROVED.sizeBytes},
    target: targetIdentity,
    restored: {counts: restored.counts, gameOver: restored.gameOver, details: restored.details, spotify: restored.spotify, fingerprint: restored.sha256},
    production: {beforeFingerprint: before.sha256, afterFingerprint: after.sha256, writes: 0},
    plaintextFilesCreated: 0
  }, null, 2));
} catch (error) {
  failed = true;
  try { await production?.query("ROLLBACK"); } catch {}
  const classification = error instanceof assert.AssertionError
    ? "INVARIANT_MISMATCH"
    : error instanceof SyntaxError
      ? "INVALID_BACKUP_PAYLOAD"
      : "VERIFICATION_OPERATION_FAILED";
  const databaseCode = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : undefined;
  const operationCode = typeof error?.code === "string" && /^E[A-Z0-9_]+$/.test(error.code) ? error.code : undefined;
  const retrieval = sanitizedBackupRetrievalFailure(error);
  console.error(JSON.stringify({gate: "E2.1B", status: "failed-safe", phase: retrieval?.phase ?? phase, classification, retrievalCode: retrieval?.code, httpStatus: retrieval?.httpStatus, oauthError: retrieval?.oauthError, retryable: retrieval?.retryable, databaseCode, operationCode}));
} finally {
  if (target) await target.end().catch(() => {});
  if (embedded) await embedded.stop().catch(() => {});
  if (tempDirectory) await fs.rm(tempDirectory, {recursive: true, force: true}).catch(() => {});
  if (production) await production.end().catch(() => {});
  if (tempDirectory) {
    const remains = await fs.stat(tempDirectory).then(() => true).catch(() => false);
    if (remains) {
      console.error("Disposable target cleanup failed.");
      process.exitCode = 1;
    }
  }
}
if (failed) process.exit(1);
