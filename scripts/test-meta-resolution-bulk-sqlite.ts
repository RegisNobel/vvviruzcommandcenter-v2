import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";

const root = process.cwd();
const databaseName = `meta-resolution-${randomUUID()}.db`;
const databasePath = path.join(root, ".codex-temp", databaseName);
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const env = {...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, ALLOW_DATABASE_URL_OVERRIDE: "1", AUTH_SECRET: "sqlite-resolution-test-auth-secret-at-least-32"};
function run(label: string, args: string[]) {
  const result = spawnSync(process.execPath, args, {cwd: root, env, encoding: "utf8", shell: false});
  if (result.status !== 0) throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`);
}

async function main() {
await fs.mkdir(path.dirname(databasePath), {recursive: true});
try {
  const sourcePath = path.join(root, "storage", "vvviruz-command-center.db");
  const source = new DatabaseSync(sourcePath, {readOnly: true}); const sourceCanaries = Number((source.prepare(`SELECT (SELECT count(*) FROM ArtistProfile WHERE id='sqlite-artist') + (SELECT count(*) FROM AdImportBatch WHERE id LIKE 'sqlite-%') + (SELECT count(*) FROM MetaDailySourceObservation WHERE accountId='sqlite') AS count`).get() as {count: number}).count); source.close();
  assert.equal(sourceCanaries, 0, "SQLite regression test canaries must never reach the source database.");
  await fs.copyFile(sourcePath, databasePath);
  run("generate SQLite client", ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.prisma"]);
  process.env.DATABASE_URL = databaseUrl; process.env.DIRECT_URL = databaseUrl; process.env.ALLOW_DATABASE_URL_OVERRIDE = "1"; process.env.AUTH_SECRET = env.AUTH_SECRET;
  const {prisma} = await import("../lib/db/prisma");
  const {recalculateMetaDailyResolutions} = await import("../lib/ads/meta-import-service");
  const now = new Date("2026-08-13T12:00:00.000Z");
  const keys = ["sqlite|campaign|set|same|2026-08-10|SPEND|USD|SPEND", "sqlite|campaign|set|changed|2026-08-10|SPEND|USD|SPEND", "sqlite|campaign|set|deleted|2026-08-10|SPEND|USD|SPEND"];
  await prisma.metaDailyResolutionEvent.deleteMany({where: {resolution: {identityKey: {startsWith: "sqlite|"}}}}); await prisma.metaDailyResolution.deleteMany({where: {identityKey: {startsWith: "sqlite|"}}}); await prisma.metaDailySourceObservation.deleteMany({where: {accountId: "sqlite"}}); await prisma.metaImportFileRow.deleteMany({where: {importFile: {importBatchId: {startsWith: "sqlite-"}}}}); await prisma.metaImportFile.deleteMany({where: {importBatchId: {startsWith: "sqlite-"}}}); await prisma.adCreativeReport.deleteMany({where: {importBatchId: {startsWith: "sqlite-"}}}); await prisma.metaImportAuditEvent.deleteMany({where: {importBatchId: {startsWith: "sqlite-"}}}); await prisma.adImportBatch.deleteMany({where: {id: {startsWith: "sqlite-"}}}); await prisma.release.deleteMany({where: {id: "sqlite-release"}}); await prisma.artistProfile.deleteMany({where: {id: "sqlite-artist"}});
  await prisma.artistProfile.create({data: {id: "sqlite-artist", slug: "sqlite-artist", displayName: "SQLite Artist", draftUpdatedAt: now, createdAt: now, updatedAt: now}});
  await prisma.release.create({data: {id: "sqlite-release", title: "SQLite", slug: "sqlite-release", primaryArtistProfileId: "sqlite-artist", createdOn: now, updatedOn: now}});
  await prisma.adImportBatch.createMany({data: [
    {id: "sqlite-active", name: "Active", releaseId: "sqlite-release", sourceGranularity: "DAILY", coreTimingEligible: true, accountId: "sqlite", normalizedTimezone: "America/Los_Angeles", importState: "ACCEPTED", acceptedAt: new Date("2026-08-13T10:00:00.000Z"), createdAt: now, updatedAt: now},
    {id: "sqlite-new", name: "New", releaseId: "sqlite-release", sourceGranularity: "DAILY", coreTimingEligible: true, accountId: "sqlite", normalizedTimezone: "America/Los_Angeles", importState: "ACCEPTED", acceptedAt: new Date("2026-08-13T11:00:00.000Z"), createdAt: now, updatedAt: now},
    {id: "sqlite-withdrawn", name: "Withdrawn", releaseId: "sqlite-release", sourceGranularity: "DAILY", coreTimingEligible: true, accountId: "sqlite", normalizedTimezone: "America/Los_Angeles", importState: "WITHDRAWN", acceptedAt: new Date("2026-08-13T10:00:00.000Z"), createdAt: now, updatedAt: now}
  ]});
  const observation = (id: string, importBatchId: string, identityKey: string, acceptedAt: Date, spend: number) => ({id, importBatchId, accountId: "sqlite", campaignId: "campaign", adSetId: "set", adId: identityKey.split("|")[3], metricDate: new Date("2026-08-10T00:00:00.000Z"), sourceReportingDate: "2026-08-10", accountTimezone: "America/Los_Angeles", normalizedTimezone: "America/Los_Angeles", timezoneSource: "USER_CONFIRMED", currency: "USD", currencyOrigin: "METRIC_HEADER", metricFamily: "SPEND", metricKey: "SPEND", attributionSetting: "", resultMetricKey: "NONE", spend, sourceAsOfOrigin: "IMPORT_ACCEPTED_FALLBACK", acceptedAt, parserVersion: "test", normalizationVersion: "test", identityKey, createdAt: now});
  await prisma.metaDailySourceObservation.createMany({data: [
    observation("sqlite-same", "sqlite-active", keys[0], new Date("2026-08-13T10:00:00.000Z"), 1),
    observation("sqlite-old", "sqlite-active", keys[1], new Date("2026-08-13T10:00:00.000Z"), 1),
    observation("sqlite-new", "sqlite-new", keys[1], new Date("2026-08-13T11:00:00.000Z"), 2),
    observation("sqlite-deleted", "sqlite-withdrawn", keys[2], new Date("2026-08-13T10:00:00.000Z"), 3)
  ]});
  await prisma.metaImportFile.create({data: {id: "sqlite-bulk-file", importBatchId: "sqlite-active", sha256: "a".repeat(64), sanitizedFileName: "bulk.csv", sourceView: "delivery", rowCount: 1215, rawStorageKey: "test-only", rawStorageSha256: "b".repeat(64), rawSizeBytes: 1, createdAt: now}});
  await prisma.metaImportFileRow.createMany({data: Array.from({length: 1215}, (_, index) => ({id: `sqlite-bulk-row-${index}`, importFileId: "sqlite-bulk-file", sourceRowNumber: index + 1, sourceView: "delivery", sourceIdentityKey: `sqlite-bulk-row-${index}`, normalizedPayload: JSON.stringify({index}), parserVersion: "test", normalizationVersion: "test", createdAt: now}))});
  await prisma.metaDailySourceObservation.createMany({data: Array.from({length: 933}, (_, index) => observation(`sqlite-bulk-observation-${index}`, "sqlite-active", `sqlite|campaign|bulk-set|bulk-ad-${index}|2026-08-10|SPEND|USD|SPEND`, now, 0))});
  await prisma.adCreativeReport.createMany({data: Array.from({length: 852}, (_, index) => ({id: `sqlite-bulk-report-${index}`, importBatchId: "sqlite-active", releaseId: "sqlite-release", adName: `Bulk ad ${index}`, reportingStart: now, reportingEnd: now, spend: 0, createdAt: now, updatedAt: now}))});
  assert.equal(await prisma.metaImportFileRow.count({where: {importFileId: "sqlite-bulk-file"}}), 1215); assert.equal(await prisma.metaDailySourceObservation.count({where: {id: {startsWith: "sqlite-bulk-observation-"}}}), 933); assert.equal(await prisma.adCreativeReport.count({where: {id: {startsWith: "sqlite-bulk-report-"}}}), 852);
  await prisma.metaDailyResolution.createMany({data: keys.map((identityKey, index) => ({id: `sqlite-resolution-${index}`, identityKey, accountId: "sqlite", campaignId: "campaign", adSetId: "set", adId: identityKey.split("|")[3], metricDate: new Date("2026-08-10T00:00:00.000Z"), currency: "USD", currencyOrigin: "METRIC_HEADER", metricFamily: "SPEND", metricKey: "SPEND", attributionSetting: "", resultMetricKey: "NONE", currentObservationId: ["sqlite-same", "sqlite-old", "sqlite-deleted"][index], resolvedAt: now, resolutionVersion: 5}))});
  const outcome = await prisma.$transaction((tx) => recalculateMetaDailyResolutions(tx, keys, now), {maxWait: 10_000, timeout: 60_000});
  assert.deepEqual(outcome, {affected: 3, created: 0, unchanged: 1, changed: 1, deleted: 1, events: 1});
  const resolutions = await prisma.metaDailyResolution.findMany({where: {identityKey: {in: keys}}, orderBy: {identityKey: "asc"}});
  assert.equal(resolutions.length, 2); assert.equal(resolutions.find((row) => row.identityKey === keys[0])?.resolutionVersion, 5); assert.equal(resolutions.find((row) => row.identityKey === keys[1])?.resolutionVersion, 6); assert.equal(resolutions.find((row) => row.identityKey === keys[1])?.currentObservationId, "sqlite-new");
  assert.equal(await prisma.metaDailyResolutionEvent.count({where: {reason: "AUTHORITATIVE_SOURCE_SUPERSEDED"}}), 1);
  await prisma.$disconnect();
  console.log(JSON.stringify({suite: "meta-resolution-bulk-sqlite", outcome, passed: true}));
} finally {
  await fs.unlink(databasePath).catch(() => undefined);
}
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
