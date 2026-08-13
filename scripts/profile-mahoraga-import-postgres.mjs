import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import {performance} from "node:perf_hooks";

const root = process.cwd();
const runtimeRequire = createRequire(path.join(root, ".codex-temp", "gate-c-runtime", "package.json"));
const {Client} = runtimeRequire("pg");
const expectedMahoragaHashes = [
  "e43d5e17fd9716203a6ac5fbb959c56265eb82e976ac51aaf23a2d933974e1a0",
  "ba8c9ae9e0ca5448e786adc40f0adedfd3ecd914688e2eb51e25b26fa94dcec0",
  "88007b49bf69ee3ba03db71c30a640a6165a57cef866d8d3c60cf24215841a5b",
  "fc93cdacefb53018482c1e5fe6b247a1ec293ff899db198e37d9895ed10bc583"
];
const expectedManifest = "1bfc3d1bae9e75815e59b5a987e6246fe39a4724533f239eb3a9dd5dfdc25b5a";
const expectedBundle = "3ef5c3334daaac195aa1e1be2432c70ef94dd1048518b8f8508247844aea5359";
const expectedSemantics = {
  run1: "47e9f15095b8c7a2d487c6058d8dc44481df46e810601c9c771e43a60d87cbde",
  run2: "9ca69c67fb8132c8a15bdf5dc0dc1d0a6084f7027f35136576b7a238ab765c51",
  run3: "680ac0dd2d127f8ccfdd397a8cdbb1b03da4be6e80403e13947be9e1bcf59c97"
};

function run(label, command, args, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});
  if (result.status !== 0) throw new Error(`${label} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return result.stdout.trim();
}
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); server.on("error", reject); }); }
function dbUrl(port, password, database) { return `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`; }
async function connect(url) { const client = new Client({connectionString: url}); client.on("error", () => {}); await client.connect(); return client; }
async function loadFiles(paths) { return Promise.all(paths.map(async (source) => ({fileName: path.basename(source), bytes: new Uint8Array(await fs.readFile(source))}))); }
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function digest(value) { return sha(Buffer.from(JSON.stringify(canonical(value)))); }
async function semanticFingerprint(db, importId) {
  const one = async (table, orderBy) => (await db.query(`SELECT * FROM "${table}" WHERE "importBatchId"=$1 ORDER BY ${orderBy}`, [importId])).rows;
  const batch = (await db.query(`SELECT * FROM "AdImportBatch" WHERE id=$1`, [importId])).rows[0];
  const files = await one("MetaImportFile", '"sha256"');
  const fileById = new Map(files.map((file) => [file.id, file.sha256]));
  const rows = (await db.query(`SELECT r.* FROM "MetaImportFileRow" r JOIN "MetaImportFile" f ON f.id=r."importFileId" WHERE f."importBatchId"=$1 ORDER BY f.sha256,r."sourceRowNumber"`, [importId])).rows;
  const rowById = new Map(rows.map((row) => [row.id, `${fileById.get(row.importFileId)}:${row.sourceRowNumber}`]));
  const observations = await one("MetaDailySourceObservation", '"identityKey"');
  const observationById = new Map(observations.map((row) => [row.id, row.identityKey]));
  const reports = await one("AdCreativeReport", '"adName","reportingStart"');
  const audits = await one("MetaImportAuditEvent", '"action","createdAt"');
  const resolutions = (await db.query(`SELECT x.* FROM "MetaDailyResolution" x JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY x."identityKey"`, [importId])).rows;
  const resolutionById = new Map(resolutions.map((row) => [row.id, row.identityKey]));
  const events = (await db.query(`SELECT e.* FROM "MetaDailyResolutionEvent" e JOIN "MetaDailyResolution" x ON x.id=e."resolutionId" JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" WHERE o."importBatchId"=$1 ORDER BY x."identityKey",e."createdAt"`, [importId])).rows;
  const normalized = {
    batch: [{...batch, id: "<IMPORT>", acceptedAt: "<NOW>", sourceAsOf: batch.sourceAsOfOrigin === "IMPORT_ACCEPTED_FALLBACK" ? "<NOW>" : batch.sourceAsOf, createdAt: "<NOW>", updatedAt: "<NOW>"}],
    files: files.map(({id, importBatchId, rawStorageKey, rawExpiresAt, createdAt, ...row}) => ({...row, importBatchId: "<IMPORT>", rawStorageKey: "<RAW>", rawExpiresAt: "<EXPIRY>", createdAt: "<NOW>"})),
    rows: rows.map(({id, importFileId, createdAt, ...row}) => ({...row, importFile: fileById.get(importFileId), createdAt: "<NOW>"})),
    observations: observations.map(({id, importBatchId, sourceFileIds, sourceRowIds, acceptedAt, sourceAsOf, createdAt, ...row}) => ({...row, importBatchId: "<IMPORT>", sourceFileIds: JSON.parse(sourceFileIds).map((value) => fileById.get(value)), sourceRowIds: JSON.parse(sourceRowIds).map((value) => rowById.get(value)), acceptedAt: "<NOW>", sourceAsOf: row.sourceAsOfOrigin === "IMPORT_ACCEPTED_FALLBACK" ? "<NOW>" : sourceAsOf, createdAt: "<NOW>"})),
    reports: reports.map(({id, importBatchId, createdAt, updatedAt, ...row}) => ({...row, importBatchId: "<IMPORT>", createdAt: "<NOW>", updatedAt: "<NOW>"})),
    audits: audits.map(({id, importBatchId, createdAt, ...row}) => ({...row, importBatchId: "<IMPORT>", createdAt: "<NOW>"})),
    resolutions: resolutions.map(({id, currentObservationId, resolvedAt, ...row}) => ({...row, currentObservationId: observationById.get(currentObservationId), resolvedAt: "<NOW>"})),
    events: events.map(({id, resolutionId, previousObservationId, currentObservationId, createdAt, ...row}) => ({...row, resolutionId: resolutionById.get(resolutionId), previousObservationId: previousObservationId ? observationById.get(previousObservationId) : null, currentObservationId: observationById.get(currentObservationId), createdAt: "<NOW>"}))
  };
  return {all: digest(normalized), categories: Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, {count: value.length, digest: digest(value)}]))};
}

async function worker() {
  const mode = process.argv[3];
  const files = await loadFiles(JSON.parse(process.env.PROFILE_SOURCE_PATHS));
  const {createMetaImportPreview, commitMetaImport, recalculateMetaDailyResolutions} = await import("../lib/ads/meta-import-service.ts");
  const {confirmMetaAccountTimezone} = await import("../lib/ads/meta-account-timezones.ts");
  const {prisma} = await import("../lib/db/prisma.ts");
  const actor = {userId: "profile-admin", username: "profile-admin"};
  try {
    if (mode === "bulk-atomicity") {
      let code = null;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.adImportBatch.create({data: {id: "bulk-atomicity-batch", name: "Bulk atomicity canary", releaseId: "profile-mahoraga", createdAt: new Date(), updatedAt: new Date()}});
          await tx.metaImportFile.create({data: {id: "bulk-atomicity-file", importBatchId: "bulk-atomicity-batch", sha256: "bulk-atomicity-sha", sanitizedFileName: "bulk.csv", sourceView: "delivery", rowCount: 2, rawStorageKey: "test-only", rawStorageSha256: "test-only", rawSizeBytes: 1, createdAt: new Date()}});
          await tx.metaImportFileRow.createMany({data: [
            {id: "bulk-row-a", importFileId: "bulk-atomicity-file", sourceRowNumber: 1, sourceView: "delivery", sourceIdentityKey: "bulk-a", normalizedPayload: "{}", parserVersion: "test", normalizationVersion: "test", createdAt: new Date()},
            {id: "bulk-row-b", importFileId: "bulk-atomicity-file", sourceRowNumber: 1, sourceView: "delivery", sourceIdentityKey: "bulk-b", normalizedPayload: "{}", parserVersion: "test", normalizationVersion: "test", createdAt: new Date()}
          ]});
        }, {maxWait: 10_000, timeout: 60_000});
      } catch (error) { code = error?.code ?? error?.name ?? "UNKNOWN"; }
      const [batches, files, rows] = await Promise.all([prisma.adImportBatch.count({where: {id: "bulk-atomicity-batch"}}), prisma.metaImportFile.count({where: {id: "bulk-atomicity-file"}}), prisma.metaImportFileRow.count({where: {id: {in: ["bulk-row-a", "bulk-row-b"]}}})]);
      console.log(JSON.stringify({mode, code, batches, files, rows})); return;
    }
    if (mode === "stress") {
      const calls = []; const diagnostics = {onCall(event) { if (event.kind === "database") calls.push(event); }};
      const keys = Array.from({length: 933}, (_, index) => `stress|campaign|set|ad-${index}|2026-08-10|SPEND|USD|SPEND`);
      const outcome = await prisma.$transaction((tx) => recalculateMetaDailyResolutions(tx, keys, new Date("2026-08-13T12:00:00.000Z"), diagnostics), {maxWait: 10_000, timeout: 60_000});
      const [remaining, unchanged, changed, events] = await Promise.all([
        prisma.metaDailyResolution.count({where: {identityKey: {in: keys}}}),
        prisma.metaDailyResolution.count({where: {identityKey: {in: keys.slice(0, 311)}, resolutionVersion: 5}}),
        prisma.metaDailyResolution.count({where: {identityKey: {in: keys.slice(311, 622)}, resolutionVersion: 6, currentObservationId: {startsWith: "stress-new-"}}}),
        prisma.metaDailyResolutionEvent.count({where: {resolution: {identityKey: {in: keys}}, reason: "AUTHORITATIVE_SOURCE_SUPERSEDED"}})
      ]);
      console.log(JSON.stringify({mode, outcome, databaseCalls: calls.length, remaining, unchanged, changed, deleted: 933 - remaining, events})); return;
    }
    if (mode === "game") {
      await confirmMetaAccountTimezone({accountId: "367019114407672", timezone: "America/Los_Angeles", sourceOrigin: "USER_CONFIRMED", actor});
      const preview = await createMetaImportPreview({actor, files, context: {attributionSetting: "7-day click, 1-day view, or 1-day engaged-view", expectedGranularity: "DAILY", releaseId: "profile-game", name: "Game Over production-shaped baseline"}});
      assert.equal(preview.canCommit, true);
      await commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: "profile-game-current-0001", confirmFinalReview: true, acknowledgeWarnings: true});
      console.log(JSON.stringify({mode, ok: true}));
      return;
    }

    const rawDir = path.join(root, "storage", "ads-raw"); const rawBefore = new Set(await fs.readdir(rawDir).catch(() => []));
    const calls = []; const stages = []; const transaction = []; const started = performance.now();
    const diagnostics = {
      onCall(event) { calls.push({...event, atMs: performance.now() - started}); },
      onStage(event) { stages.push({...event, atMs: performance.now() - started}); },
      onTransaction(event) { transaction.push(event); }
    };
    const previewStarted = performance.now();
    const preview = await createMetaImportPreview({actor, files, context: {attributionSetting: "7-day click, 1-day view, or 1-day engaged-view", expectedGranularity: "DAILY", releaseId: "profile-mahoraga", name: `Mahoraga profile ${mode}`}});
    const previewMs = performance.now() - previewStarted;
    assert.equal(preview.canCommit, true);
    let result = "success"; let code = null; let importId = null;
    const commitStarted = performance.now();
    try {
      const committed = await commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: `profile-mahoraga-${mode}-0001`, confirmFinalReview: true, acknowledgeWarnings: true, diagnostics});
      importId = committed.importId;
    } catch (error) {
      result = "failure"; code = error?.code ?? error?.name ?? "UNKNOWN";
    }
    const commitMs = performance.now() - commitStarted;
    const byStage = {};
    for (const item of calls) {
      const current = byStage[item.stage] ?? {calls: 0, rows: 0, elapsedMs: 0, maxMs: 0};
      current.calls += 1; current.rows += item.rows; current.elapsedMs += item.elapsedMs; current.maxMs = Math.max(current.maxMs, item.elapsedMs); byStage[item.stage] = current;
    }
    const lastCall = calls.at(-1) ?? null;
    const transactionStages = new Set(["batch_persistence", "import_file_persistence", "source_row_persistence", "metric_observation_persistence", "compatibility_report_persistence", "import_audit_persistence", "replacement_state_write", "resolution_source_lookup", "resolution_existing_lookup", "resolution_bulk_delete", "resolution_bulk_create", "resolution_bulk_update", "resolution_event_bulk_create"]);
    const transactionDbCalls = calls.filter((item) => item.kind === "database" && transactionStages.has(item.stage)).length;
    const db = await connect(process.env.DATABASE_URL);
    const state = (await db.query(`SELECT
      (SELECT count(*)::int FROM "AdImportBatch" WHERE "releaseId"='profile-mahoraga' AND "sourceGranularity"='DAILY') mah_batches,
      (SELECT count(*)::int FROM "MetaImportFile" f JOIN "AdImportBatch" b ON b.id=f."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_files,
      (SELECT count(*)::int FROM "MetaImportFileRow" r JOIN "MetaImportFile" f ON f.id=r."importFileId" JOIN "AdImportBatch" b ON b.id=f."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_rows,
      (SELECT count(*)::int FROM "MetaDailySourceObservation" o JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_observations,
      (SELECT count(*)::int FROM "MetaDailyResolution" x JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_resolutions,
      (SELECT count(*)::int FROM "MetaDailyResolutionEvent" e JOIN "MetaDailyResolution" x ON x.id=e."resolutionId" JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" JOIN "AdImportBatch" b ON b.id=o."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_resolution_events,
      (SELECT count(*)::int FROM "MetaImportAuditEvent" e JOIN "AdImportBatch" b ON b.id=e."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_audits,
      (SELECT count(*)::int FROM "AdCreativeReport" r JOIN "AdImportBatch" b ON b.id=r."importBatchId" WHERE b."releaseId"='profile-mahoraga' AND b."sourceGranularity"='DAILY') mah_reports,
      (SELECT count(*)::int FROM "MetaDailyResolution" WHERE "adSetId"='120247925536670172' AND "metricKey"='SPEND') game_facts,
      (SELECT round(coalesce(sum(o.spend),0)::numeric,2)::text FROM "MetaDailyResolution" x JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" WHERE x."adSetId"='120247925536670172' AND x."metricKey"='SPEND') game_spend`)).rows[0];
    if (result === "success") {
      const contract = (await db.query(`SELECT count(*)::int facts,
        count(*) FILTER (WHERE o.spend>0)::int positive,
        count(*) FILTER (WHERE o.spend=0)::int zero,
        count(*) FILTER (WHERE o.spend IS NULL)::int missing,
        round(coalesce(sum(o.spend),0)::numeric,2)::text spend,
        count(DISTINCT o."adId")::int ads
        FROM "MetaDailyResolution" x JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId"
        WHERE o."importBatchId"=$1 AND x."metricKey"='SPEND'`, [importId])).rows[0];
      assert.deepEqual(contract, {facts: 852, positive: 110, zero: 742, missing: 0, spend: "827.18", ads: 12});
      const correction = (await db.query(`SELECT o.spend::text spend FROM "MetaDailyResolution" x JOIN "MetaDailySourceObservation" o ON o.id=x."currentObservationId" WHERE o."importBatchId"=$1 AND o."adName"='mahoraga_cover_verse1_rev1' AND o."sourceReportingDate"='2026-08-10' AND x."metricKey"='SPEND'`, [importId])).rows[0];
      assert.equal(correction.spend, "3.84");
    } else {
      assert.deepEqual(state, {mah_batches: 0, mah_files: 0, mah_rows: 0, mah_observations: 0, mah_resolutions: 0, mah_resolution_events: 0, mah_audits: 0, mah_reports: 0, game_facts: 210, game_spend: "283.48"});
    }
    assert.equal(state.game_facts, 210); assert.equal(state.game_spend, "283.48");
    const semantics = result === "success" ? await semanticFingerprint(db, importId) : null;
    await db.end();
    const rawObjects = (await fs.readdir(rawDir).catch(() => [])).filter((name) => !rawBefore.has(name));
    if (result === "failure") assert.equal(rawObjects.length, 0, "Failed-run raw compensation left residue.");
    console.log(JSON.stringify({mode, result, code, previewMs, commitMs, transactionDbCalls, transaction: transaction[0] ?? null, lastCall: lastCall ? {stage: lastCall.stage, atMs: lastCall.atMs} : null, calls: byStage, stages, state, rawObjects: rawObjects.length, semantics}));
  } finally { await prisma.$disconnect(); }
}

async function orchestrate() {
  const sourcePaths = process.argv.slice(2);
  if (sourcePaths.length !== 8) throw new Error("Pass four Game Over files followed by four Mahoraga files.");
  const gamePaths = sourcePaths.slice(0, 4); const mahoragaPaths = sourcePaths.slice(4);
  const mahoragaFiles = await loadFiles(mahoragaPaths);
  assert.deepEqual(mahoragaFiles.map(({bytes}) => sha(bytes)), expectedMahoragaHashes);
  const manifest = JSON.parse(run("verify Mahoraga manifest", process.execPath, ["--import", "tsx", "scripts/verify-mahoraga-daily-readiness-manifest.ts", ...mahoragaPaths]));
  assert.equal(manifest.bundleManifestFingerprint, expectedManifest);
  const {buildMetaEvidenceBundle} = await import("../lib/ads/meta-evidence-contract.ts");
  const bundle = buildMetaEvidenceBundle(mahoragaFiles, {attributionSetting: "", expectedGranularity: "DAILY", manualTimezone: "America/Los_Angeles", manualTimezoneOrigin: "USER_CONFIRMED"});
  assert.equal(bundle.bundleHash, expectedBundle); assert.equal(bundle.files.reduce((sum, file) => sum + file.rowCount, 0), 1215); assert.equal(bundle.metricObservations.length, 933); assert.equal(bundle.mergedDailyRows.length, 852);

  const tempRoot = path.join(root, ".codex-temp", "mahoraga-phase2"); await fs.mkdir(tempRoot, {recursive: true});
  const localStorageDirectories = [path.join(root, "storage", "ads-preview"), path.join(root, "storage", "ads-raw")];
  const preexistingStorage = new Map(await Promise.all(localStorageDirectories.map(async (directory) => [directory, new Set(await fs.readdir(directory).catch(() => []))])));
  const EmbeddedPostgres = runtimeRequire("embedded-postgres").default ?? runtimeRequire("embedded-postgres");
  const port = await freePort(); const password = crypto.randomBytes(48).toString("base64url"); const baseDb = "e21_mahoraga_profile_base"; const dataDir = path.join(tempRoot, `pg-${crypto.randomUUID()}`);
  const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}}); let started = false;
  try {
    await embedded.initialise(); await embedded.start(); started = true; await embedded.createDatabase(baseDb);
    const baseStorage = path.join(tempRoot, `base-storage-${crypto.randomUUID()}`);
    const baseEnv = {...process.env, DATABASE_URL: dbUrl(port, password, baseDb), DIRECT_URL: dbUrl(port, password, baseDb), AUTH_SECRET: "phase2-diagnostic-auth-secret-at-least-32", PRIVATE_STORAGE_DRIVER: "local", STORAGE_ROOT: baseStorage, ADS_PREVIEW_RETENTION_MINUTES: "15"};
    run("push PostgreSQL schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], baseEnv);
    let db = await connect(baseEnv.DATABASE_URL);
    await db.query(`DO $roles$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $roles$;`);
    await db.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
    await db.query(`INSERT INTO "AdminUser" (id,username,"createdAt","updatedAt") VALUES ('profile-admin','profile-admin',now(),now()); INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('profile-artist','profile-artist','Profile Artist',now(),now(),now()); INSERT INTO "Release" (id,title,slug,"primaryArtistProfileId","createdOn","updatedOn") VALUES ('profile-game','Game Over','profile-game','profile-artist',now(),now()),('profile-mahoraga','Mahoraga','profile-mahoraga','profile-artist',now(),now()); INSERT INTO "CopyEntry" (id,hook,caption,"createdOn","updatedOn") VALUES ('profile-copy','Hook','Caption',now(),now());`);
    const reportIds = [];
    for (let batch = 0; batch < 17; batch += 1) {
      await db.query(`INSERT INTO "AdImportBatch" (id,name,"releaseId","createdAt","updatedAt") VALUES ($1,$2,'profile-mahoraga',now(),now())`, [`profile-legacy-${batch}`, `Legacy ${batch}`]);
      const count = batch < 14 ? 9 : 8;
      for (let item = 0; item < count; item += 1) { const id = `profile-report-${batch}-${item}`; reportIds.push(id); await db.query(`INSERT INTO "AdCreativeReport" (id,"importBatchId","releaseId","adName","createdAt","updatedAt") VALUES ($1,$2,'profile-mahoraga','Legacy creative',now(),now())`, [id, `profile-legacy-${batch}`]); }
    }
    assert.equal(reportIds.length, 150);
    for (let index = 0; index < 109; index += 1) await db.query(`INSERT INTO "AdCreativeCopyLink" (id,"adCreativeReportId","copyEntryId","createdAt") VALUES ($1,$2,'profile-copy',now())`, [`profile-link-${index}`, reportIds[index]]);
    await db.end();
    run("generate PostgreSQL client", process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], baseEnv);
    run("create Game Over production-shaped state", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/profile-mahoraga-import-postgres.mjs", "--worker", "game"], {...baseEnv, PROFILE_SOURCE_PATHS: JSON.stringify(gamePaths)});
    db = await connect(baseEnv.DATABASE_URL);
    const baseline = (await db.query(`SELECT current_setting('server_version') version,(SELECT count(*)::int FROM "AdImportBatch") batches,(SELECT count(*)::int FROM "AdCreativeReport") reports,(SELECT count(*)::int FROM "AdCreativeCopyLink") copy_links,(SELECT count(*)::int FROM "AdImportBatch" WHERE "sourceGranularity"='DAILY') daily_imports,(SELECT count(*)::int FROM "MetaDailySourceObservation") observations,(SELECT count(*)::int FROM "MetaDailyResolution") resolutions,(SELECT count(*)::int FROM "MetaAccountTimezoneResolution" WHERE "resolutionState"='CURRENT') timezones`)).rows[0];
    assert.deepEqual({...baseline, version: undefined}, {version: undefined, batches: 18, reports: 360, copy_links: 109, daily_imports: 1, observations: 255, resolutions: 255, timezones: 1});
    await db.end();
    const stressOnly = process.env.PROFILE_STRESS_ONLY === "1"; const runs = [];
    for (let index = 1; index <= (stressOnly ? 0 : 3); index += 1) {
      const database = `e21_mahoraga_profile_run_${index}`; const admin = await connect(dbUrl(port, password, "postgres")); await admin.query(`CREATE DATABASE ${database} TEMPLATE ${baseDb}`); await admin.end();
      const storageRoot = path.join(tempRoot, `run-${index}-storage-${crypto.randomUUID()}`); const env = {...baseEnv, DATABASE_URL: dbUrl(port, password, database), DIRECT_URL: dbUrl(port, password, database), STORAGE_ROOT: storageRoot, PROFILE_SOURCE_PATHS: JSON.stringify(mahoragaPaths)};
      const output = run(`Mahoraga profile run ${index}`, process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/profile-mahoraga-import-postgres.mjs", "--worker", `run${index}`], env);
      const measured = JSON.parse(output.split(/\r?\n/).at(-1));
      assert.equal(measured.transactionDbCalls <= 50, true); assert.equal(measured.transaction.callbackMs < 5_000, true); assert.equal(measured.commitMs < 10_000, true); assert.equal(measured.semantics.all, expectedSemantics[`run${index}`]);
      runs.push(measured);
    }
    if (!stressOnly) { const callbacks = runs.map((item) => item.transaction.callbackMs).sort((left, right) => left - right); assert.equal(callbacks[1] < 2_000, true); }
    const stressDatabase = "e21_mahoraga_resolution_stress"; {
      const admin = await connect(dbUrl(port, password, "postgres")); await admin.query(`CREATE DATABASE ${stressDatabase} TEMPLATE ${baseDb}`); await admin.end();
      const stressDb = await connect(dbUrl(port, password, stressDatabase));
      await stressDb.query(`
        INSERT INTO "AdImportBatch" (id,name,"releaseId","sourceGranularity","accountId","normalizedTimezone","coreTimingEligible","importState","acceptedAt","createdAt","updatedAt") VALUES
          ('stress-active','Stress active','profile-mahoraga','DAILY','stress','America/Los_Angeles',true,'ACCEPTED','2026-08-13 10:00:00+00',now(),now()),
          ('stress-new','Stress new','profile-mahoraga','DAILY','stress','America/Los_Angeles',true,'ACCEPTED','2026-08-13 11:00:00+00',now(),now()),
          ('stress-withdrawn','Stress withdrawn','profile-mahoraga','DAILY','stress','America/Los_Angeles',true,'WITHDRAWN','2026-08-13 10:00:00+00',now(),now());
        INSERT INTO "MetaDailySourceObservation" (id,"importBatchId","accountId","campaignId","adSetId","adId","metricDate","sourceReportingDate","accountTimezone","normalizedTimezone","timezoneSource",currency,"currencyOrigin","metricFamily","metricKey","attributionSetting","resultMetricKey",spend,"sourceAsOfOrigin","acceptedAt","parserVersion","normalizationVersion","identityKey","createdAt")
        SELECT 'stress-old-'||i,'stress-active','stress','campaign','set','ad-'||i,'2026-08-10','2026-08-10','America/Los_Angeles','America/Los_Angeles','USER_CONFIRMED','USD','METRIC_HEADER','SPEND','SPEND','','NONE',1,'IMPORT_ACCEPTED_FALLBACK','2026-08-13 10:00:00+00','stress','stress','stress|campaign|set|ad-'||i||'|2026-08-10|SPEND|USD|SPEND',now() FROM generate_series(0,621) i;
        INSERT INTO "MetaDailySourceObservation" (id,"importBatchId","accountId","campaignId","adSetId","adId","metricDate","sourceReportingDate","accountTimezone","normalizedTimezone","timezoneSource",currency,"currencyOrigin","metricFamily","metricKey","attributionSetting","resultMetricKey",spend,"sourceAsOfOrigin","acceptedAt","parserVersion","normalizationVersion","identityKey","createdAt")
        SELECT 'stress-new-'||i,'stress-new','stress','campaign','set','ad-'||i,'2026-08-10','2026-08-10','America/Los_Angeles','America/Los_Angeles','USER_CONFIRMED','USD','METRIC_HEADER','SPEND','SPEND','','NONE',2,'IMPORT_ACCEPTED_FALLBACK','2026-08-13 11:00:00+00','stress','stress','stress|campaign|set|ad-'||i||'|2026-08-10|SPEND|USD|SPEND',now() FROM generate_series(311,621) i;
        INSERT INTO "MetaDailySourceObservation" (id,"importBatchId","accountId","campaignId","adSetId","adId","metricDate","sourceReportingDate","accountTimezone","normalizedTimezone","timezoneSource",currency,"currencyOrigin","metricFamily","metricKey","attributionSetting","resultMetricKey",spend,"sourceAsOfOrigin","acceptedAt","parserVersion","normalizationVersion","identityKey","createdAt")
        SELECT 'stress-deleted-'||i,'stress-withdrawn','stress','campaign','set','ad-'||i,'2026-08-10','2026-08-10','America/Los_Angeles','America/Los_Angeles','USER_CONFIRMED','USD','METRIC_HEADER','SPEND','SPEND','','NONE',3,'IMPORT_ACCEPTED_FALLBACK','2026-08-13 10:00:00+00','stress','stress','stress|campaign|set|ad-'||i||'|2026-08-10|SPEND|USD|SPEND',now() FROM generate_series(622,932) i;
        INSERT INTO "MetaDailyResolution" (id,"identityKey","accountId","campaignId","adSetId","adId","metricDate",currency,"currencyOrigin","metricFamily","metricKey","attributionSetting","resultMetricKey","currentObservationId","resolvedAt","resolutionVersion")
        SELECT 'stress-resolution-'||i,'stress|campaign|set|ad-'||i||'|2026-08-10|SPEND|USD|SPEND','stress','campaign','set','ad-'||i,'2026-08-10','USD','METRIC_HEADER','SPEND','SPEND','','NONE',CASE WHEN i<622 THEN 'stress-old-'||i ELSE 'stress-deleted-'||i END,now(),5 FROM generate_series(0,932) i;
      `); await stressDb.end();
    }
    const stressEnv = {...baseEnv, DATABASE_URL: dbUrl(port, password, stressDatabase), DIRECT_URL: dbUrl(port, password, stressDatabase), PROFILE_SOURCE_PATHS: JSON.stringify(mahoragaPaths)};
    const stressOutput = run("existing-resolution 933-key stress", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/profile-mahoraga-import-postgres.mjs", "--worker", "stress"], stressEnv);
    const stressRun = JSON.parse(stressOutput.split(/\r?\n/).at(-1)); assert.deepEqual(stressRun.outcome, {affected: 933, created: 0, unchanged: 311, changed: 311, deleted: 311, events: 311}); assert.equal(stressRun.databaseCalls <= 100, true); assert.deepEqual({...stressRun, mode: undefined, outcome: undefined, databaseCalls: undefined}, {mode: undefined, outcome: undefined, databaseCalls: undefined, remaining: 622, unchanged: 311, changed: 311, deleted: 311, events: 311});
    if (stressOnly) { console.log(JSON.stringify({suite: "gate-e2.1-phase3-resolution-stress", stressRun}, null, 2)); return; }
    const rollbackDatabase = "e21_mahoraga_profile_rollback"; const admin = await connect(dbUrl(port, password, "postgres")); await admin.query(`CREATE DATABASE ${rollbackDatabase} TEMPLATE ${baseDb}`); await admin.end();
    const rollbackDb = await connect(dbUrl(port, password, rollbackDatabase));
    await rollbackDb.query(`CREATE OR REPLACE FUNCTION profile_reject_mahoraga_resolution_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM "MetaDailyResolution" WHERE id=NEW."resolutionId" AND "adSetId"='120245448816970172') THEN RAISE EXCEPTION 'diagnostic rollback canary'; END IF; RETURN NEW; END $$; CREATE TRIGGER profile_reject_mahoraga_resolution_event BEFORE INSERT ON "MetaDailyResolutionEvent" FOR EACH ROW EXECUTE FUNCTION profile_reject_mahoraga_resolution_event();`); await rollbackDb.end();
    const rollbackStorage = path.join(tempRoot, `rollback-storage-${crypto.randomUUID()}`); const rollbackEnv = {...baseEnv, DATABASE_URL: dbUrl(port, password, rollbackDatabase), DIRECT_URL: dbUrl(port, password, rollbackDatabase), STORAGE_ROOT: rollbackStorage, PROFILE_SOURCE_PATHS: JSON.stringify(mahoragaPaths)};
    const rollbackOutput = run("Mahoraga rollback verification", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/profile-mahoraga-import-postgres.mjs", "--worker", "rollback"], rollbackEnv);
    const atomicityRun = JSON.parse(rollbackOutput.split(/\r?\n/).at(-1)); assert.equal(atomicityRun.result, "failure"); assert.equal(atomicityRun.code, "TRANSACTION_FAILURE");
    const bulkFailureDatabase = "e21_mahoraga_profile_bulk_failure"; { const admin = await connect(dbUrl(port, password, "postgres")); await admin.query(`CREATE DATABASE ${bulkFailureDatabase} TEMPLATE ${baseDb}`); await admin.end(); }
    const bulkFailureEnv = {...baseEnv, DATABASE_URL: dbUrl(port, password, bulkFailureDatabase), DIRECT_URL: dbUrl(port, password, bulkFailureDatabase), PROFILE_SOURCE_PATHS: JSON.stringify(mahoragaPaths)};
    const bulkFailureOutput = run("Mahoraga bulk-write rollback verification", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/profile-mahoraga-import-postgres.mjs", "--worker", "bulk-atomicity"], bulkFailureEnv); const bulkFailureRun = JSON.parse(bulkFailureOutput.split(/\r?\n/).at(-1)); assert.equal(typeof bulkFailureRun.code, "string"); assert.deepEqual({...bulkFailureRun, mode: undefined, code: undefined}, {mode: undefined, code: undefined, batches: 0, files: 0, rows: 0});
    console.log(JSON.stringify({suite: "gate-e2.1-phase3-mahoraga-performance", input: {manifest: expectedManifest, bundle: expectedBundle, hashes: expectedMahoragaHashes, sourceRows: 1215, metricObservations: 933, mergedDailyRows: 852}, environment: {postgres: baseline.version, loopbackOnly: true, randomizedCredentialBytes: 48, productionConnections: 0, baseline}, transaction: {maxWaitMs: 10000, timeoutMs: 60000}, runs, stressRun, atomicityRun, bulkFailureRun}, null, 2));
  } finally {
    if (started) await embedded.stop().catch(() => undefined);
    for (const directory of localStorageDirectories) {
      const before = preexistingStorage.get(directory); for (const name of await fs.readdir(directory).catch(() => [])) if (!before.has(name)) await fs.unlink(path.join(directory, name));
    }
  }
}

if (process.argv[2] === "--worker") await worker(); else await orchestrate();
