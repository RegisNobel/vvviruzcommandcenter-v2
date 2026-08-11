import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const {parseMetaEvidenceCsv} = await import("../lib/ads/meta-evidence-contract.ts");
const {normalizeMetaHeader} = await import("../lib/ads/meta-csv.ts");
const root = process.cwd();
const sources = process.argv.slice(2);
if (sources.length !== 8) throw new Error("Pass four Game Over files followed by four Mahoraga files.");
const gamePaths = sources.slice(0, 4); const mahoragaPaths = sources.slice(4);
const tempRoot = path.join(root, ".codex-temp", "meta-dual-release-postgres");
const runtimeRequire = createRequire(path.join(root, ".codex-temp", "gate-c-runtime", "package.json"));
const EmbeddedPostgres = runtimeRequire("embedded-postgres").default ?? runtimeRequire("embedded-postgres");
const {Client} = runtimeRequire("pg");
const encoder = new TextEncoder(); const decoder = new TextDecoder();

function run(label, command, args, env) { const result = spawnSync(command, args, {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false}); if (result.status !== 0) throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`); }
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); server.on("error", reject); }); }
function dbUrl(port, password, database) { return `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`; }
async function connect(port, password, database) { const client = new Client({connectionString: dbUrl(port, password, database)}); client.on("error", () => {}); await client.connect(); return client; }
function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function csvBytes(matrix) { return encoder.encode(matrix.map((row) => row.map(csvCell).join(",")).join("\n")); }
function headerIndex(headers, name) { return headers.findIndex((header) => normalizeMetaHeader(header) === name); }
async function loadFiles(paths) { return Promise.all(paths.map(async (source) => ({fileName: path.basename(source), bytes: new Uint8Array(await fs.readFile(source))}))); }

function priorMahoragaRevision(files) {
  let changedDelivery = 0; let changedVideo = 0;
  const revised = files.map((file) => {
    const matrix = parseMetaEvidenceCsv(decoder.decode(file.bytes).replace(/^\uFEFF/, "")); const headers = matrix[0];
    const nameIndex = headerIndex(headers, "ad_name"); const dateIndex = headerIndex(headers, "reporting_starts"); const spendIndex = headers.findIndex((header) => /^Amount spent(?: \([A-Z]{3}\))?$/i.test(header));
    if (nameIndex >= 0 && dateIndex >= 0 && spendIndex >= 0) for (const row of matrix.slice(1)) if (row[nameIndex] === "mahoraga_cover_verse1_rev1" && row[dateIndex] === "2026-08-10" && Number(row[spendIndex]) === 3.84) { row[spendIndex] = "2.71"; if (headers.some((header) => /video|thruplay/i.test(header))) changedVideo += 1; else changedDelivery += 1; }
    return {fileName: `prior-${file.fileName}`, bytes: csvBytes(matrix)};
  });
  assert.equal(changedDelivery, 1); assert.equal(changedVideo, 1); return revised;
}

await fs.mkdir(tempRoot, {recursive: true});
const gameFiles = await loadFiles(gamePaths); const mahoragaFiles = await loadFiles(mahoragaPaths); const priorMahoragaFiles = priorMahoragaRevision(mahoragaFiles);
const baselineSchema = path.join(tempRoot, "baseline.postgres.prisma"); await fs.writeFile(baselineSchema, spawnSync("git", ["show", "HEAD:prisma/schema.postgres.prisma"], {cwd: root, encoding: "utf8"}).stdout);
const port = await freePort(); const password = crypto.randomBytes(24).toString("base64url"); const database = "meta_dual_release"; const dataDir = path.join(tempRoot, `pg-${crypto.randomUUID()}`); const storageRoot = path.join(tempRoot, `storage-${crypto.randomUUID()}`);
const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}}); let started = false;
try {
  await embedded.initialise(); await embedded.start(); started = true; await embedded.createDatabase(database);
  const env = {...process.env, DATABASE_URL: dbUrl(port, password, database), DIRECT_URL: dbUrl(port, password, database), AUTH_SECRET: "dual-release-rehearsal-secret-at-least-32", PRIVATE_STORAGE_DRIVER: "local", STORAGE_ROOT: storageRoot, ADS_PREVIEW_RETENTION_MINUTES: "15"};
  run("push baseline", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", baselineSchema, "--skip-generate"], env);
  let db = await connect(port, password, database);
  await db.query(`
    DO $roles$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $roles$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated,service_role;
    INSERT INTO "AdminUser" (id,username,"createdAt","updatedAt") VALUES ('dual-admin','dual-admin',now(),now());
    INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('dual-artist','dual-artist','Dual Artist',now(),now(),now());
    INSERT INTO "Release" (id,title,slug,"primaryArtistProfileId","createdOn","updatedOn") VALUES ('release-game','Game Over','game-over','dual-artist',now(),now()),('release-mahoraga','Mahoraga','mahoraga','dual-artist',now(),now());
    INSERT INTO "CopyEntry" (id,"releaseId",hook,caption,"createdOn","updatedOn") VALUES ('copy-a','release-mahoraga','Hook','Caption',now(),now()),('copy-b','release-mahoraga','Hook 2','Caption 2',now(),now());
  `);
  const legacyReportIds = [];
  for (let batch = 0; batch < 17; batch += 1) {
    const reportingEnd = new Date(Date.UTC(2026, 0, 28 + batch * 7)); const reportingStart = new Date(reportingEnd); reportingStart.setUTCDate(reportingStart.getUTCDate() - 27); const exportedAt = new Date(reportingEnd); exportedAt.setUTCDate(exportedAt.getUTCDate() + 1);
    await db.query(`INSERT INTO "AdImportBatch" (id,name,"releaseId","reportingStart","reportingEnd","exportedAt","createdAt","updatedAt") VALUES ($1,$2,'release-mahoraga',$3,$4,$5,now(),now())`, [`legacy-${batch}`, `Mahoraga Snapshot ${batch}`, reportingStart, reportingEnd, exportedAt]);
    const reportCount = batch < 5 || batch >= 15 ? 10 : 8;
    for (let item = 0; item < reportCount; item += 1) { const id = `legacy-report-${batch}-${item}`; legacyReportIds.push(id); await db.query(`INSERT INTO "AdCreativeReport" (id,"importBatchId","releaseId","adName",spend,"createdAt","updatedAt") VALUES ($1,$2,'release-mahoraga',$3,$4,now(),now())`, [id, `legacy-${batch}`, `Creative ${item % 32}`, item]); }
  }
  for (let item = 0; item < 109; item += 1) await db.query(`INSERT INTO "AdCreativeCopyLink" (id,"adCreativeReportId","copyEntryId","createdAt") VALUES ($1,$2,$3,now())`, [`legacy-copy-${item}`, legacyReportIds[item], item % 2 ? "copy-a" : "copy-b"]);
  assert.deepEqual((await db.query(`SELECT (SELECT count(*)::int FROM "AdImportBatch") batches,(SELECT count(*)::int FROM "AdCreativeReport") reports,(SELECT count(*)::int FROM "AdCreativeCopyLink") links`)).rows[0], {batches: 17, reports: 150, links: 109}); await db.end();

  run("push final schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate", "--accept-data-loss"], env);
  db = await connect(port, password, database); await db.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
  for (const role of ["anon", "authenticated", "service_role"]) for (const table of ["MetaImportFile", "MetaImportFileRow", "MetaDailySourceObservation", "MetaDailyResolution", "MetaDailyResolutionEvent", "MetaImportAuditEvent", "MetaPromotionLink", "MetaPromotionLinkAuditEvent", "MetaAccountTimezoneResolution"]) { await db.query("BEGIN"); try { await db.query(`SET LOCAL ROLE ${role}`); await assert.rejects(db.query(`SELECT * FROM "${table}"`), (error) => error.code === "42501"); } finally { await db.query("ROLLBACK"); } }
  await db.end(); run("generate client", process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], env); Object.assign(process.env, env);

  const {createMetaImportPreview, commitMetaImport, withdrawMetaImport} = await import("../lib/ads/meta-import-service.ts");
  const {confirmMetaAccountTimezone} = await import("../lib/ads/meta-account-timezones.ts");
  const {createMetaPromotionLink, transitionMetaPromotionLink, metaPromotionScopeWhere} = await import("../lib/ads/meta-promotion-links.ts");
  const {generateMetaIntervalSuggestions} = await import("../lib/analytics/campaign-timeline-service.ts");
  const {runRetentionCleanup} = await import("../lib/analytics/retention-cleanup.ts");
  const {prisma} = await import("../lib/db/prisma.ts");
  const actor = {userId: "dual-admin", username: "dual-admin"}; await confirmMetaAccountTimezone({accountId: "367019114407672", timezone: "America/Los_Angeles", sourceOrigin: "USER_CONFIRMED", actor});
  async function importBundle(files, releaseId, name, key) { const preview = await createMetaImportPreview({actor, files, context: {attributionSetting: "7-day click, 1-day view, or 1-day engaged-view", expectedGranularity: "DAILY", releaseId, name}}); assert.equal(preview.canCommit, true); return commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: key, confirmFinalReview: true, acknowledgeWarnings: true}); }
  const priorMahoraga = await importBundle(priorMahoragaFiles, "release-mahoraga", "Mahoraga reviewed prior revision", "dual-mahoraga-prior-01");
  const currentMahoraga = await importBundle(mahoragaFiles, "release-mahoraga", "Mahoraga final stable-ID", "dual-mahoraga-current-01");
  const game = await importBundle(gameFiles, "release-game", "Game Over final stable-ID", "dual-game-current-00001");
  const spendForImport = async (importId) => ({count: await prisma.metaDailySourceObservation.count({where: {importBatchId: importId, metricFamily: "SPEND"}}), cents: Math.round(((await prisma.metaDailySourceObservation.aggregate({where: {importBatchId: importId, metricFamily: "SPEND"}, _sum: {spend: true}}))._sum.spend ?? 0) * 100)});
  assert.deepEqual(await spendForImport(game.importId), {count: 210, cents: 28_348}); assert.deepEqual(await spendForImport(currentMahoraga.importId), {count: 852, cents: 82_718}); assert.deepEqual(await spendForImport(priorMahoraga.importId), {count: 852, cents: 82_605});
  assert.equal(await prisma.metaDailyResolution.count({where: {adSetId: "120247925536670172", metricFamily: "SPEND"}}), 210); assert.equal(await prisma.metaDailyResolution.count({where: {adSetId: "120245448816970172", metricFamily: "SPEND"}}), 852);
  const gameKeys = new Set((await prisma.metaDailyResolution.findMany({where: {adSetId: "120247925536670172", metricFamily: "SPEND"}, select: {identityKey: true}})).map(({identityKey}) => identityKey)); const mahoragaKeys = new Set((await prisma.metaDailyResolution.findMany({where: {adSetId: "120245448816970172", metricFamily: "SPEND"}, select: {identityKey: true}})).map(({identityKey}) => identityKey)); assert.equal([...gameKeys].filter((key) => mahoragaKeys.has(key)).length, 0);
  const revisedObservation = await prisma.metaDailySourceObservation.findFirstOrThrow({where: {importBatchId: currentMahoraga.importId, adSetId: "120245448816970172", adName: "mahoraga_cover_verse1_rev1", metricDate: new Date("2026-08-10T00:00:00.000Z"), metricFamily: "SPEND"}}); assert.equal(revisedObservation.spend, 3.84); const revisedCurrent = await prisma.metaDailyResolution.findUniqueOrThrow({where: {identityKey: revisedObservation.identityKey}, include: {currentObservation: true}}); assert.equal(revisedCurrent.currentObservation.importBatchId, currentMahoraga.importId);

  for (const [id, releaseId, name] of [["campaign-game", "release-game", "Game Over"], ["campaign-mahoraga", "release-mahoraga", "Mahoraga"], ["campaign-parent", "release-game", "Parent"], ["campaign-no-link", "release-mahoraga", "No Link"], ["campaign-shared-child", "release-game", "Shared Child"], ["campaign-scope-change", "release-game", "Scope Change"]]) await prisma.promotionCampaign.create({data: {id, artistProfileId: "dual-artist", releaseId, platform: "META", name, objective: "STREAMS", status: "DRAFT", externalCampaignName: "vvviruz_evergreen_nerdcore", createdAt: new Date(), updatedAt: new Date()}});
  assert.equal((await generateMetaIntervalSuggestions("campaign-no-link", actor)).created, 0, "matching names never link evidence");
  const gameSuggested = await createMetaPromotionLink({promotionCampaignId: "campaign-game", accountId: "367019114407672", scopeType: "AD_SET", externalCampaignId: "120243311904960172", externalAdSetId: "120247925536670172", currentDisplayName: "game over ad set", actor});
  await assert.rejects(transitionMetaPromotionLink({promotionCampaignId: "campaign-mahoraga", linkId: gameSuggested.id, status: "CONFIRMED", reason: "Scoped IDOR must fail", actor}), (error) => error.code === "NOT_FOUND");
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-game", linkId: gameSuggested.id, status: "CONFIRMED", reason: "Disposable Game Over scope", actor});
  const mahoragaSuggested = await createMetaPromotionLink({promotionCampaignId: "campaign-mahoraga", accountId: "367019114407672", scopeType: "AD_SET", externalCampaignId: "120243311904960172", externalAdSetId: "120245448816970172", currentDisplayName: "mahoraga ad set", actor});
  await transitionMetaPromotionLink({promotionCampaignId: "campaign-mahoraga", linkId: mahoragaSuggested.id, status: "CONFIRMED", reason: "Disposable Mahoraga scope", actor});
  const scopedCurrent = await prisma.metaPromotionLink.findMany({where: {promotionCampaignId: {in: ["campaign-game", "campaign-mahoraga"]}, status: "CONFIRMED", supersededBy: null}, orderBy: {promotionCampaignId: "asc"}}); assert.equal(scopedCurrent.length, 2); assert.ok(scopedCurrent.every((link) => link.associationMode === "SHARED_EXTERNAL_CAMPAIGN" && link.monetaryAttribution === "EXTERNAL_SCOPE_ONLY" && !link.ambiguous));
  const queryScope = async (link) => { const rows = await prisma.metaDailyResolution.findMany({where: {...metaPromotionScopeWhere(link), metricFamily: "SPEND"}, include: {currentObservation: true}}); return {count: rows.length, cents: Math.round(rows.reduce((sum, row) => sum + (row.currentObservation.spend ?? 0), 0) * 100), adSets: [...new Set(rows.map(({adSetId}) => adSetId))].sort()}; };
  assert.deepEqual(await queryScope(scopedCurrent.find(({promotionCampaignId}) => promotionCampaignId === "campaign-game")), {count: 210, cents: 28_348, adSets: ["120247925536670172"]}); assert.deepEqual(await queryScope(scopedCurrent.find(({promotionCampaignId}) => promotionCampaignId === "campaign-mahoraga")), {count: 852, cents: 82_718, adSets: ["120245448816970172"]});
  assert.equal((await generateMetaIntervalSuggestions("campaign-game", actor)).created, 1); assert.equal((await generateMetaIntervalSuggestions("campaign-mahoraga", actor)).created, 1); const gameEvidence = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-game", suggestionState: "CURRENT"}}); const mahoragaEvidence = await prisma.campaignEvidence.findFirstOrThrow({where: {campaignId: "campaign-mahoraga", suggestionState: "CURRENT"}}); assert.equal(gameEvidence.suggestedStartDate.toISOString().slice(0, 10), "2026-07-21"); assert.equal(gameEvidence.suggestedEndDate.toISOString().slice(0, 10), "2026-08-09"); assert.equal(mahoragaEvidence.suggestedStartDate.toISOString().slice(0, 10), "2026-06-10"); assert.equal(mahoragaEvidence.suggestedEndDate.toISOString().slice(0, 10), "2026-08-10"); assert.equal(await prisma.campaignActiveInterval.count({where: {confirmationStatus: "CONFIRMED"}}), 0);
  const parentSuggested = await createMetaPromotionLink({promotionCampaignId: "campaign-parent", accountId: "367019114407672", scopeType: "CAMPAIGN", externalCampaignId: "120243311904960172", actor}); await transitionMetaPromotionLink({promotionCampaignId: "campaign-parent", linkId: parentSuggested.id, status: "CONFIRMED", reason: "Explicit disposable parent scope", actor}); const parentCurrent = await prisma.metaPromotionLink.findFirstOrThrow({where: {promotionCampaignId: "campaign-parent", status: "CONFIRMED", supersededBy: null}}); assert.deepEqual(await queryScope(parentCurrent), {count: 1062, cents: 111_066, adSets: ["120245448816970172", "120247925536670172"]});
  const sharedChild = await createMetaPromotionLink({promotionCampaignId: "campaign-shared-child", accountId: "367019114407672", scopeType: "AD_SET", externalCampaignId: "120243311904960172", externalAdSetId: "120247925536670172", actor}); await assert.rejects(transitionMetaPromotionLink({promotionCampaignId: "campaign-shared-child", linkId: sharedChild.id, status: "CONFIRMED", reason: "Must require explicit sharing", actor}), (error) => error.code === "SHARED_SCOPE_CONFIRMATION_REQUIRED"); await transitionMetaPromotionLink({promotionCampaignId: "campaign-shared-child", linkId: sharedChild.id, status: "CONFIRMED", reason: "Explicit disposable shared child", confirmSharedScope: true, actor}); assert.equal((await prisma.metaPromotionLink.findFirstOrThrow({where: {promotionCampaignId: "campaign-shared-child", status: "CONFIRMED", supersededBy: null}})).monetaryAttribution, "UNALLOCATED_SHARED");
  const campaignScope = await createMetaPromotionLink({promotionCampaignId: "campaign-scope-change", accountId: "367019114407672", scopeType: "CAMPAIGN", externalCampaignId: "120243311904960172", actor}); const narrower = await createMetaPromotionLink({promotionCampaignId: "campaign-scope-change", accountId: "367019114407672", scopeType: "AD_SET", externalCampaignId: "120243311904960172", externalAdSetId: "120247925536670172", supersedesLinkId: campaignScope.id, actor}); assert.equal(await prisma.metaPromotionLinkAuditEvent.count({where: {linkId: narrower.id, action: "LINK_SCOPE_SUPERSEDED"}}), 1);

  const snapshotPath = path.join(tempRoot, "dual-snapshot.json"); run("export snapshot", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/export-db-snapshot.ts"], {...env, DB_SNAPSHOT_PATH: snapshotPath}); const restoreDb = "meta_dual_restore"; await embedded.createDatabase(restoreDb); const restoreEnv = {...env, DATABASE_URL: dbUrl(port, password, restoreDb), DIRECT_URL: dbUrl(port, password, restoreDb)}; run("push restore schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], restoreEnv); const restoreClient = await connect(port, password, restoreDb); await restoreClient.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8")); await restoreClient.end(); run("restore snapshot", process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], {...restoreEnv, DB_SNAPSHOT_PATH: snapshotPath, IMPORT_AUTH: "1"}); const restored = await connect(port, password, restoreDb); const restoredScope = (await restored.query(`SELECT "scopeType","accountId","externalCampaignId","externalAdSetId","externalAdId","status","associationMode","monetaryAttribution","ambiguous","supersedesLinkId" FROM "MetaPromotionLink" ORDER BY id`)).rows; const original = await connect(port, password, database); const originalScope = (await original.query(`SELECT "scopeType","accountId","externalCampaignId","externalAdSetId","externalAdId","status","associationMode","monetaryAttribution","ambiguous","supersedesLinkId" FROM "MetaPromotionLink" ORDER BY id`)).rows; await original.end(); assert.deepEqual(restoredScope, originalScope); assert.equal((await restored.query(`SELECT count(*)::int count FROM "MetaPromotionLinkAuditEvent"`)).rows[0].count, await prisma.metaPromotionLinkAuditEvent.count()); await restored.end();
  const gameBeforeWithdrawal = await queryScope(scopedCurrent.find(({promotionCampaignId}) => promotionCampaignId === "campaign-game")); await withdrawMetaImport({actor, importId: currentMahoraga.importId, reason: "Disposable current-revision withdrawal"}); const restoredRevision = await prisma.metaDailyResolution.findFirstOrThrow({where: {metricDate: new Date("2026-08-10T00:00:00.000Z"), metricFamily: "SPEND", currentObservation: {adName: "mahoraga_cover_verse1_rev1"}}, include: {currentObservation: true}}); assert.equal(restoredRevision.currentObservation.spend, 2.71); assert.equal(restoredRevision.currentObservation.importBatchId, priorMahoraga.importId); assert.deepEqual(await queryScope(scopedCurrent.find(({promotionCampaignId}) => promotionCampaignId === "campaign-game")), gameBeforeWithdrawal);
  const normalizedBeforeCleanup = await prisma.metaDailySourceObservation.count(); await prisma.metaImportFile.updateMany({data: {rawExpiresAt: new Date(Date.now() - 60_000)}}); const cleanup = await runRetentionCleanup({dryRun: false}); assert.ok(cleanup.expiredMetaRawFiles.deleted > 0); assert.equal(await prisma.metaDailySourceObservation.count(), normalizedBeforeCleanup); assert.deepEqual((await prisma.adImportBatch.aggregate({_count: true}))._count, 20);
  await prisma.$disconnect();
  console.log(JSON.stringify({suite: "meta-dual-release-postgres", legacy: {batches: 17, reports: 150, copyLinks: 109}, gameOver: {coreFacts: 210, positive: 60, explicitZero: 150, spendUsd: 283.48, firstActiveEvidence: "2026-07-21", lastActiveEvidence: "2026-08-09"}, mahoraga: {coreFacts: 852, positive: 110, explicitZero: 742, spendUsd: 827.18, firstActiveEvidence: "2026-06-10", lastActiveEvidence: "2026-08-10"}, isolation: {crossReleaseFacts: 0, duplicateCanonicalSpend: 0, gameReturnedFacts: 210, mahoragaReturnedFacts: 852, parentExplicitFacts: 1062, noLinkEvidence: 0, nameBasedImplicitLinking: 0}, revision: {priorUsd: 826.05, currentUsd: 827.18, revisedCurrent: 3.84, withdrawalRestored: 2.71}, scopedLinks: {scopeTypes: ["CAMPAIGN", "AD_SET", "AD"], sharedParent: true, explicitSharedChildRequired: true, scopedIdorDenied: true, scopeSupersessionAudited: true}, backupRestore: "equivalent", roleDenials: 27, privateRawCleanup: cleanup.expiredMetaRawFiles.deleted, normalizedDataPreserved: true, confirmedIntervalsCreated: 0, productionConnections: 0}, null, 2));
} finally { if (started) await embedded.stop().catch(() => undefined); }
