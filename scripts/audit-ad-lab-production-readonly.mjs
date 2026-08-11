import crypto from "node:crypto";
import fs from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";

const runtimeRequire = createRequire(path.join(process.cwd(), ".codex-temp", "gate-c-runtime", "package.json"));
const {Client} = runtimeRequire("pg");
async function loadEnvFile(fileName) {
  let raw; try { raw = await fs.readFile(path.resolve(process.cwd(), fileName), "utf8"); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim(); if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("="); if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim(); let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
await loadEnvFile(process.env.PRODUCTION_ENV_FILE || ".env.production.local");
const direct = process.env.POSTGRES_URL_NON_POOLING;
if (!direct) throw new Error("POSTGRES_URL_NON_POOLING is unavailable.");
const identity = new URL(direct);
if (!identity.hostname.endsWith("pooler.supabase.com") || identity.port !== "5432" || !decodeURIComponent(identity.username).includes("qkwifxvfrotmmnjluhbt")) throw new Error("Production database identity check failed.");

const ref = (value) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 10);
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalizedName = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const connection = new URL(direct); connection.searchParams.delete("sslmode");
const client = new Client({connectionString: connection.toString(), ssl: {rejectUnauthorized: false}}); client.on("error", () => {}); await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const postgresServerVersion = (await client.query("SHOW server_version")).rows[0].server_version;
  const batches = (await client.query(`SELECT id,name,"batchType","reportingStart","reportingEnd","exportedAt","createdAt" FROM "AdImportBatch" ORDER BY "createdAt",id`)).rows;
  const reports = (await client.query(`SELECT r.id,r."importBatchId",r."adName",r.spend,b.name,b."batchType",b."reportingStart",b."reportingEnd",b."exportedAt",b."createdAt",rel.title "releaseTitle",count(l.id)::int copy_links FROM "AdCreativeReport" r JOIN "AdImportBatch" b ON b.id=r."importBatchId" LEFT JOIN "Release" rel ON rel.id=b."releaseId" LEFT JOIN "AdCreativeCopyLink" l ON l."adCreativeReportId"=r.id GROUP BY r.id,b.id,rel.id ORDER BY b."createdAt",r.id`)).rows;
  const campaigns = (await client.query(`SELECT id,"artistProfileId","releaseId",platform,name,objective,status,"createdAt","updatedAt" FROM "PromotionCampaign" ORDER BY id`)).rows;
  const metaPromotionLinkTablePresent = (await client.query(`SELECT to_regclass('public."MetaPromotionLink"') IS NOT NULL AS present`)).rows[0].present;
  const metaPromotionLinkRows = metaPromotionLinkTablePresent ? (await client.query(`SELECT count(*)::int count FROM "MetaPromotionLink"`)).rows[0].count : 0;
  const aliases = (await client.query(`SELECT * FROM "ReleaseImportAlias" ORDER BY id`)).rows;
  const analyticsImports = (await client.query(`SELECT id,"fileHash","importType",status,"rowCount","acceptedRowCount","rejectedRowCount","unmatchedRowCount","warningCount","acceptedAt","withdrawnAt","replacedByImportId" FROM "AnalyticsImport" ORDER BY id`)).rows;
  const artistTimeline = (await client.query(`SELECT o.* FROM "ArtistMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" WHERE i.status='IMPORTED' ORDER BY o.id`)).rows;
  const mahoragaTrack = (await client.query(`SELECT o.* FROM "TrackMetricObservation" o JOIN "AnalyticsImport" i ON i.id=o."importId" JOIN "Release" r ON r.id=o."releaseId" WHERE i.status='IMPORTED' AND r.title ILIKE '%mahoraga%' ORDER BY o.id`)).rows;
  const songsPeriod = (await client.query(`SELECT s.* FROM "SongPeriodSnapshot" s JOIN "AnalyticsImport" i ON i.id=s."importId" WHERE i.status='IMPORTED' ORDER BY s.id`)).rows;
  const playlistsPeriod = (await client.query(`SELECT p.* FROM "PlaylistPeriodSnapshot" p JOIN "AnalyticsImport" i ON i.id=p."importId" WHERE i.status='IMPORTED' ORDER BY p.id`)).rows;
  await client.query("COMMIT");

  function rankingFor(input) {
    const totals = new Map(); const latest = new Map(); const display = new Map();
    for (const row of input) {
    const key = normalizedName(row.adName); display.set(key, ref(row.adName)); totals.set(key, (totals.get(key) ?? 0) + Number(row.spend ?? 0));
    const stamp = `${row.reportingEnd?.toISOString?.() ?? ""}|${row.exportedAt?.toISOString?.() ?? ""}|${row.createdAt?.toISOString?.() ?? ""}|${row.importBatchId}`;
    const prior = latest.get(key); if (!prior || stamp > prior.stamp) latest.set(key, {stamp, spend: Number(row.spend ?? 0), batchRef: ref(row.importBatchId)});
    }
    const keys = [...display.keys()];
    const oldOrder = [...keys].sort((a, b) => totals.get(b) - totals.get(a) || a.localeCompare(b));
    const newOrder = [...keys].sort((a, b) => latest.get(b).spend - latest.get(a).spend || a.localeCompare(b));
    const impacts = keys.map((key) => ({adRef: display.get(key), existingAccumulatedSpend: totals.get(key), latestSnapshotSpend: latest.get(key).spend, difference: latest.get(key).spend - totals.get(key), oldRank: oldOrder.indexOf(key) + 1, newRank: newOrder.indexOf(key) + 1, resolverBasis: "LATEST_AGGREGATE_SNAPSHOT", latestBatchRef: latest.get(key).batchRef})).sort((a, b) => a.oldRank - b.oldRank);
    return {reports: input.length, distinctAds: impacts.length, changedTotals: impacts.filter((item) => item.difference !== 0).length, changedPositions: impacts.filter((item) => item.oldRank !== item.newRank).length, impacts};
  }
  const allRanking = rankingFor(reports);
  const mahoragaReports = reports.filter((row) => /mahoraga/i.test(`${row.name ?? ""} ${row.releaseTitle ?? ""}`));
  const mahoragaRanking = rankingFor(mahoragaReports);
  const types = new Map(); for (const batch of batches) types.set(batch.batchType || "UNSPECIFIED", (types.get(batch.batchType || "UNSPECIFIED") ?? 0) + 1);
  console.log(JSON.stringify({
    guard: {productionIdentityVerified: true, transaction: "READ ONLY"},
    inventory: {postgresServerVersion, batches: batches.length, reports: reports.length, copyLabLinks: reports.reduce((sum, row) => sum + row.copy_links, 0), aggregateSnapshotBatches: batches.length, existingDailyBatches: 0, batchTypes: Object.fromEntries([...types.entries()].sort()), dailyLikeBatches: batches.filter((row) => row.reportingStart && row.reportingEnd && row.reportingStart.toISOString() === row.reportingEnd.toISOString()).length, mahoragaBatches: new Set(mahoragaReports.map((row) => row.importBatchId)).size, mahoragaReports: mahoragaReports.length, mahoragaCopyLabLinks: mahoragaReports.reduce((sum, row) => sum + row.copy_links, 0), campaigns: campaigns.length, aliases: aliases.length, metaPromotionLinkTablePresent, metaPromotionLinkRows, expectedLegacyDefaults: {sourceGranularity: "AGGREGATE_SNAPSHOT", campaignIntervalEligible: false, eligibilityReason: "LEGACY_AGGREGATE_SNAPSHOT", validationState: "ACCEPTED_WITH_LIMITATIONS", sourceAsOfOrigin: "UNKNOWN"}},
    spotifyFingerprints: {analyticsImports: {count: analyticsImports.length, sha256: digest(analyticsImports)}, artistTimeline: {count: artistTimeline.length, sha256: digest(artistTimeline)}, mahoragaTrackTimeline: {count: mahoragaTrack.length, sha256: digest(mahoragaTrack)}, songsPeriod: {count: songsPeriod.length, sha256: digest(songsPeriod)}, playlistsPeriod: {count: playlistsPeriod.length, sha256: digest(playlistsPeriod)}},
    ranking: {labelAfterDeployment: "Latest observed snapshot spend", allProduction: {...allRanking, postDeploymentFingerprint: digest(allRanking.impacts)}, mahoraga: {...mahoragaRanking, postDeploymentFingerprint: digest(mahoragaRanking.impacts)}},
    mahoragaPerReportVerification: mahoragaReports.map((row) => ({reportRef: ref(row.id), batchRef: ref(row.importBatchId), adRef: ref(row.adName), reportSpend: Number(row.spend ?? 0), copyLabLinks: row.copy_links, expectedClassification: "AGGREGATE_SNAPSHOT_NOT_INTERVAL_ELIGIBLE"})),
    rawNamesPrinted: false
  }, null, 2));
} finally { await client.end(); }
