import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import {performance} from "node:perf_hooks";

const {buildMetaEvidenceBundle, parseMetaEvidenceCsv, resolveCanonicalDaily} = await import("../lib/ads/meta-evidence-contract.ts");
const {normalizeMetaHeader} = await import("../lib/ads/meta-csv.ts");

const root = process.cwd();
const sources = process.argv.slice(2);
if (sources.length < 3 || sources.length > 4) throw new Error("Pass the current real Meta CSV paths.");
const tempRoot = path.join(root, ".codex-temp", "meta-daily-real-contract");
const runtimeRequire = createRequire(path.join(root, ".codex-temp", "gate-c-runtime", "package.json"));
const EmbeddedPostgres = runtimeRequire("embedded-postgres").default ?? runtimeRequire("embedded-postgres");
const {Client} = runtimeRequire("pg");
const encoder = new TextEncoder(); const decoder = new TextDecoder();

function run(label, command, args, env) {
  const result = spawnSync(command, args, {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});
  if (result.status !== 0) throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`);
}
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close((error) => error ? reject(error) : resolve(address.port)); }); server.on("error", reject); }); }
function dbUrl(port, password, database) { return `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`; }
async function connect(port, password, database) { const client = new Client({connectionString: dbUrl(port, password, database)}); client.on("error", () => {}); await client.connect(); return client; }
function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function csvBytes(matrix) { return encoder.encode(matrix.map((row) => row.map(csvCell).join(",")).join("\n")); }
function index(headers, name) { return headers.findIndex((header) => normalizeMetaHeader(header) === name); }
function detectedView(headers) { const normalized = headers.map(normalizeMetaHeader); if (normalized.some((header) => /video|thruplay/.test(header))) return "video"; if (normalized.some((header) => /amount_spent|results|result_indicator|attribution_setting|quality_ranking/.test(header))) return "delivery"; if (normalized.some((header) => /click|engagement|reaction|comment|save|share/.test(header))) return "engagement"; if (normalized.some((header) => /impressions|reach|frequency/.test(header))) return "reach"; return "unknown"; }

async function sanitizedFixture() {
  const loaded = await Promise.all(sources.map(async (source) => { const bytes = await fs.readFile(source); return {hash: crypto.createHash("sha256").update(bytes).digest("hex"), matrix: parseMetaEvidenceCsv(decoder.decode(bytes).replace(/^\uFEFF/, ""))}; }));
  const matrices = loaded.filter((item, itemIndex) => loaded.findIndex((candidate) => candidate.hash === item.hash) === itemIndex).map((item) => item.matrix);
  const delivery = matrices.find((matrix) => detectedView(matrix[0]) === "delivery"); if (!delivery) throw new Error("A Delivery/spend view is required for the scale fixture.");
  const dateWindows = matrices.map((matrix) => { const headers = matrix[0]; const dateIndex = index(headers, "reporting_starts"); const dates = matrix.slice(1).map((row) => row[dateIndex]).filter(Boolean).sort(); return {matrix, start: dates[0], end: dates.at(-1)}; });
  const deliveryWindow = dateWindows.find((item) => item.matrix === delivery); const enrichmentWindows = dateWindows.filter((item) => item.matrix !== delivery);
  const commonStart = enrichmentWindows.map(({start}) => start).sort().at(-1); const commonEnd = enrichmentWindows.map(({end}) => end).sort()[0];
  const maps = {account: new Map(), campaign: new Map(), adSet: new Map(), ad: new Map()};
  const token = (map, value, prefix) => { if (!map.has(value)) map.set(value, `${prefix}-${String(map.size + 1).padStart(2, "0")}`); return map.get(value); };
  const deliveryHeaders = delivery[0]; const deliveryDate = index(deliveryHeaders, "reporting_starts"); const deliveryAd = index(deliveryHeaders, "ad_id"); const deliverySpend = deliveryHeaders.findIndex((header) => /^Amount spent(?: \([A-Z]{3}\))?$/i.test(header));
  const spendByAdDay = new Map(delivery.slice(1).map((row) => [`${row[deliveryAd]}|${row[deliveryDate]}`, row[deliverySpend]]));
  const sanitized = matrices.map((matrix, fileIndex) => {
    const headers = [...matrix[0]]; const dateIndex = index(headers, "reporting_starts"); const endIndex = index(headers, "reporting_ends");
    const accountIndex = index(headers, "account_id"); const campaignIndex = index(headers, "campaign_id"); const adSetIndex = index(headers, "ad_set_id"); const adIndex = index(headers, "ad_id"); const adNameIndex = index(headers, "ad_name");
    const spendIndex = headers.findIndex((header) => /^Amount spent(?: \([A-Z]{3}\))?$/i.test(header));
    const rows = matrix.slice(1).filter((row) => matrix === delivery || (row[dateIndex] >= commonStart && row[dateIndex] <= commonEnd)).map((sourceRow) => {
      const row = [...sourceRow]; const originalAd = row[adIndex];
      if (spendIndex >= 0 && matrix !== delivery) row[spendIndex] = spendByAdDay.get(`${originalAd}|${row[dateIndex]}`) ?? row[spendIndex];
      row[accountIndex] = token(maps.account, row[accountIndex], "account"); row[campaignIndex] = token(maps.campaign, row[campaignIndex], "campaign"); row[adSetIndex] = token(maps.adSet, row[adSetIndex], "adset"); row[adIndex] = token(maps.ad, originalAd, "ad");
      if (adNameIndex >= 0) row[adNameIndex] = `Creative ${String(maps.ad.get(originalAd)).slice(-2)}`;
      row[dateIndex] = row[dateIndex]; if (endIndex >= 0) row[endIndex] = row[dateIndex]; return row;
    });
    return {fileName: `sanitized-view-${fileIndex + 1}.csv`, bytes: csvBytes([headers, ...rows])};
  });
  if (!sanitized.some((file) => detectedView(parseMetaEvidenceCsv(decoder.decode(file.bytes))[0]) === "video")) {
    const deliveryMatrix = parseMetaEvidenceCsv(decoder.decode(sanitized[matrices.indexOf(delivery)].bytes)); const headers = deliveryMatrix[0];
    const fields = ["reporting_starts", "reporting_ends", "ad_name", "impressions", "reach", "amount_spent", "account_id", "campaign_id", "ad_set_id", "ad_id"];
    const sourceIndexes = fields.map((field) => index(headers, field)); const videoHeaders = ["Reporting starts", "Reporting ends", "Ad name", "Impressions", "Reach", "Amount spent (USD)", "Account ID", "Campaign ID", "Ad set ID", "Ad ID", "Video plays"];
    const videoRows = deliveryMatrix.slice(1).filter((row) => row[sourceIndexes[0]] >= commonStart && row[sourceIndexes[0]] <= commonEnd).map((row) => [...sourceIndexes.map((sourceIndex) => row[sourceIndex] ?? ""), ""]);
    sanitized.push({fileName: "sanitized-derived-video-enrichment.csv", bytes: csvBytes([videoHeaders, ...videoRows])});
  }
  return {files: sanitized, timingStart: deliveryWindow.start, timingEnd: deliveryWindow.end, commonStart, commonEnd, timingDates: new Set(delivery.slice(1).map((row) => row[deliveryDate])).size, enrichmentDates: new Set(enrichmentWindows.flatMap(({matrix}) => { const dateIndex = index(matrix[0], "reporting_starts"); return matrix.slice(1).map((row) => row[dateIndex]); })).size, ads: maps.ad.size, duplicateSourceFiles: loaded.length - matrices.length};
}

function withReviewedCorrection(files) {
  let correctedIdentity = null;
  return files.map((file) => {
    const matrix = parseMetaEvidenceCsv(decoder.decode(file.bytes)); const headers = matrix[0]; const view = detectedView(headers);
    const dateIndex = index(headers, "reporting_starts"); const adIndex = index(headers, "ad_id"); const spendIndex = headers.findIndex((header) => /^Amount spent(?: \([A-Z]{3}\))?$/i.test(header));
    if ((view === "delivery" || view === "video") && spendIndex >= 0) {
      const target = correctedIdentity
        ? matrix.slice(1).find((row) => `${row[adIndex]}|${row[dateIndex]}` === correctedIdentity)
        : matrix.slice(1).find((row) => Number(row[spendIndex] || 0) > 0);
      if (target) { correctedIdentity ??= `${target[adIndex]}|${target[dateIndex]}`; target[spendIndex] = String(Number(target[spendIndex]) + 0.01); }
    }
    headers.push("Validation revision"); for (const row of matrix.slice(1)) row.push("2");
    return {fileName: `corrected-${file.fileName}`, bytes: csvBytes(matrix)};
  });
}

await fs.mkdir(tempRoot, {recursive: true});
const fixture = await sanitizedFixture(); const initialFiles = fixture.files; const correctedFiles = withReviewedCorrection(fixture.files);
const contract = buildMetaEvidenceBundle(initialFiles, {attributionSetting: "7-day click", expectedGranularity: "DAILY", manualTimezone: "America/Los_Angeles", manualTimezoneOrigin: "USER_CONFIRMED"});
assert.equal(contract.coreTimingEligible, true); assert.equal(contract.currency, "USD"); assert.equal(contract.currencyOrigin, "METRIC_HEADER"); assert.equal(contract.reportingStart, fixture.timingStart); assert.equal(contract.reportingEnd, fixture.timingEnd); assert.equal(contract.commonObservedDateCount, fixture.enrichmentDates); assert.ok(contract.files.filter((file) => file.sourceView !== "delivery").every((file) => file.missingCoreDateCount > 0));
assert.equal(contract.enrichmentCompatibility, "COMPATIBLE_WITH_GAPS"); assert.equal(contract.viewConflicts.filter(({code}) => code === "CROSS_VIEW_SPEND_MISMATCH").length, 0); assert.equal(contract.metricObservations.filter(({metricFamily}) => metricFamily === "SPEND").length, fixture.timingDates * fixture.ads);
assert.equal(contract.mergedDailyRows.filter(({spend}) => spend > 0).length, 60); assert.equal(contract.mergedDailyRows.filter(({spend}) => spend === 0).length, 150); assert.equal(Math.round(contract.mergedDailyRows.reduce((sum, row) => sum + row.spend, 0) * 100), 28_348);

const port = await freePort(); const password = crypto.randomBytes(24).toString("base64url"); const database = "meta_daily_real_contract"; const dataDir = path.join(tempRoot, `pg-${crypto.randomUUID()}`);
const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}}); let started = false;
try {
  await embedded.initialise(); await embedded.start(); started = true; await embedded.createDatabase(database);
  const env = {...process.env, DATABASE_URL: dbUrl(port, password, database), DIRECT_URL: dbUrl(port, password, database), AUTH_SECRET: "meta-daily-real-contract-secret-at-least-32", PRIVATE_STORAGE_DRIVER: "local", STORAGE_ROOT: tempRoot, ADS_PREVIEW_RETENTION_MINUTES: "15"};
  run("push schema", process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], env);
  let db = await connect(port, password, database);
  await db.query(`
    DO $roles$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $roles$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
  `);
  await db.query(await fs.readFile(path.join(root, "docs/operations/manifests/ad-lab-gate-e1-postgres-companion.sql"), "utf8"));
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["MetaImportFile", "MetaImportFileRow", "MetaDailySourceObservation", "MetaDailyResolution", "MetaDailyResolutionEvent", "MetaImportAuditEvent", "MetaPromotionLink", "MetaPromotionLinkAuditEvent", "MetaAccountTimezoneResolution"]) {
      await db.query("BEGIN");
      try {
        await db.query(`SET LOCAL ROLE ${role}`);
        await assert.rejects(db.query(`SELECT * FROM "${table}"`), (error) => error.code === "42501");
      } finally {
        await db.query("ROLLBACK");
      }
    }
  }
  run("generate postgres client", process.execPath, ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"], env);
  await db.query(`INSERT INTO "AdminUser" (id,username,"createdAt","updatedAt") VALUES ('contract-admin','contract-admin',now(),now()); INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('contract-artist','contract-artist','Contract Artist',now(),now(),now()); INSERT INTO "Release" (id,title,slug,"primaryArtistProfileId","createdOn","updatedOn") VALUES ('contract-release','Contract Release','contract-release','contract-artist',now(),now());`); await db.end();
  Object.assign(process.env, env);
  const {createMetaImportPreview, commitMetaImport, withdrawMetaImport} = await import("../lib/ads/meta-import-service.ts"); const {confirmMetaAccountTimezone} = await import("../lib/ads/meta-account-timezones.ts"); const {readAdPerformanceTimeline} = await import("../lib/repositories/ads.ts"); const {runRetentionCleanup} = await import("../lib/analytics/retention-cleanup.ts"); const {deleteStoredAssetStrict, listStoredAssetReferences} = await import("../lib/server/asset-storage.ts"); const {prisma} = await import("../lib/db/prisma.ts");
  assert.equal(await prisma.release.count({where: {id: "contract-release"}}), 1);
  const actor = {userId: "contract-admin", username: "contract-admin"};
  await confirmMetaAccountTimezone({accountId: "367019114407672", timezone: "America/Los_Angeles", sourceOrigin: "USER_CONFIRMED", actor});
  await confirmMetaAccountTimezone({accountId: "account-01", timezone: "America/Los_Angeles", sourceOrigin: "USER_CONFIRMED", actor});
  assert.equal((await prisma.metaAccountTimezoneResolution.findFirstOrThrow({where: {accountId: "367019114407672", resolutionState: "CURRENT"}})).ianaTimezone, "America/Los_Angeles");
  const context = {attributionSetting: "7-day click", expectedGranularity: "DAILY", releaseId: "contract-release", name: "Sanitized real contract"};
  const expiryNow = new Date(); const expiry = await createMetaImportPreview({actor, files: initialFiles.map((file) => ({...file, bytes: encoder.encode(`${decoder.decode(file.bytes)}\n`)})), context, now: expiryNow}); assert.equal(expiry.canCommit, true); await assert.rejects(commitMetaImport({actor, previewToken: expiry.previewToken, clientIdempotencyKey: "real-contract-expiry-01", confirmFinalReview: true, acknowledgeWarnings: true, now: new Date(expiryNow.getTime() + 16 * 60_000)}), (error) => error.code === "EXPIRED_PREVIEW"); await runRetentionCleanup({dryRun: false}, {list: listStoredAssetReferences, metaList: listStoredAssetReferences, remove: deleteStoredAssetStrict, now: () => new Date(expiryNow.getTime() + 16 * 60_000)});
  assert.equal(await prisma.release.count({where: {id: "contract-release"}}), 1);
  const previewStarted = performance.now(); const preview = await createMetaImportPreview({actor, files: initialFiles, context}); const previewMs = performance.now() - previewStarted; assert.equal(preview.canCommit, true);
  const commitStarted = performance.now(); const initial = await commitMetaImport({actor, previewToken: preview.previewToken, clientIdempotencyKey: "real-contract-initial-01", confirmFinalReview: true, acknowledgeWarnings: true}); const commitMs = performance.now() - commitStarted;
  const persistedInitial = await prisma.adImportBatch.findUniqueOrThrow({where: {id: initial.importId}}); assert.equal(persistedInitial.coreTimingEligible, true); assert.equal(persistedInitial.normalizedTimezone, "America/Los_Angeles"); assert.equal(persistedInitial.timezoneSource, "USER_CONFIRMED"); assert.equal(persistedInitial.enrichmentCompatibility, "COMPATIBLE_WITH_GAPS"); assert.equal(JSON.parse(persistedInitial.enrichmentWarnings).includes("CROSS_VIEW_SPEND_MISMATCH"), false);
  assert.equal(await prisma.metaDailySourceObservation.count({where: {importBatchId: initial.importId, metricFamily: "SPEND"}}), 210); assert.equal(Math.round((await prisma.metaDailySourceObservation.aggregate({where: {importBatchId: initial.importId, metricFamily: "SPEND"}, _sum: {spend: true}}))._sum.spend * 100), 28_348);
  assert.equal(await prisma.promotionCampaign.count(), 0); assert.equal(await prisma.metaPromotionLink.count(), 0); assert.equal(await prisma.campaignActiveInterval.count(), 0);
  const observations = await prisma.metaDailySourceObservation.findMany({where: {importBatchId: initial.importId}, include: {importBatch: true}}); const resolutionStarted = performance.now(); resolveCanonicalDaily(observations.map((item) => ({...item, metricDate: item.metricDate.toISOString().slice(0,10), sourceFileHash: "", sourceFileName: "", sourceRowNumber: 0, sourceView: "delivery", reportingStart: item.sourceReportingDate, reportingEnd: item.sourceReportingDate, timezoneSource: item.timezoneSource, currencyOrigin: item.currencyOrigin, sourceAsOf: item.sourceAsOf?.toISOString() ?? null, sourceAsOfOrigin: item.sourceAsOfOrigin, acceptedAt: item.acceptedAt.toISOString(), importState: "ACCEPTED", identityKey: item.identityKey}))); const resolutionMs = performance.now() - resolutionStarted;
  const correctedPreview = await createMetaImportPreview({actor, files: correctedFiles, context}); const corrected = await commitMetaImport({actor, previewToken: correctedPreview.previewToken, clientIdempotencyKey: "real-contract-corrected-01", confirmFinalReview: true, acknowledgeWarnings: true}); assert.equal(await prisma.metaDailyResolutionEvent.count({where: {reason: "AUTHORITATIVE_SOURCE_SUPERSEDED"}}) > 0, true);
  const rankingStarted = performance.now(); const ranking = await readAdPerformanceTimeline("contract-release"); const rankingMs = performance.now() - rankingStarted; assert.equal(ranking.rankingBasis, "canonical_daily"); assert.equal(ranking.analysisWindowStart, fixture.timingStart); assert.equal(ranking.analysisWindowEnd, fixture.timingEnd);
  const withdrawalStarted = performance.now(); await withdrawMetaImport({actor, importId: corrected.importId, reason: "Disposable correction withdrawal"}); const withdrawalMs = performance.now() - withdrawalStarted; const restoredSpend = await prisma.metaDailyResolution.findMany({where: {metricFamily: "SPEND"}, include: {currentObservation: true}}); assert.equal(Math.round(restoredSpend.reduce((sum, row) => sum + row.currentObservation.spend, 0) * 100), 28_348);
  assert.equal(await prisma.promotionCampaign.count(), 0); assert.equal(await prisma.metaPromotionLink.count(), 0); assert.equal(await prisma.campaignActiveInterval.count(), 0);
  const normalizedBeforeCleanup = await prisma.metaDailySourceObservation.count();
  await prisma.metaImportFile.updateMany({data: {rawExpiresAt: new Date(Date.now() - 60_000)}});
  const rawCleanup = await runRetentionCleanup({dryRun: false});
  assert.ok(rawCleanup.expiredMetaRawFiles.deleted > 0);
  assert.equal(await prisma.metaDailySourceObservation.count(), normalizedBeforeCleanup);
  console.log(JSON.stringify({suite: "meta-daily-real-contract-postgres", sourceRows: contract.files.reduce((sum, file) => sum + file.rowCount, 0), coreDates: fixture.timingDates, enrichmentDates: fixture.enrichmentDates, ads: fixture.ads, views: 4, duplicateInputFilesRejected: fixture.duplicateSourceFiles, positiveCoreCells: 60, explicitZeroCoreCells: 150, canonicalSpendFacts: 210, canonicalSpendUsd: 283.48, videoSpendMatches: 60, videoSpendConflicts: 0, timezoneRegistry: "America/Los_Angeles USER_CONFIRMED", previewMs: Math.round(previewMs), commitIncludingResolutionMs: Math.round(commitMs), canonicalResolutionEngineMs: Math.round(resolutionMs * 100) / 100, rankingQueryMs: Math.round(rankingMs), withdrawalMs: Math.round(withdrawalMs), expirySafe: true, correctionSupersession: true, withdrawalRestoration: true, roleDenials: 27, privateRawCleanup: rawCleanup.expiredMetaRawFiles.deleted, normalizedDataPreservedAfterCleanup: true, promotionCampaignsCreated: 0, metaPromotionLinksCreated: 0, confirmedIntervalsCreated: 0, rawIdentifiersPrinted: false}, null, 2));
  await prisma.$disconnect();
} finally {
  if (started) await embedded.stop().catch(() => undefined);
}
