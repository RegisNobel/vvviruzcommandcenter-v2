import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {prisma} from "../lib/db/prisma";
import {AdminError} from "../lib/server/admin-error-response";
import {
  backfillStage3AnalyticsImportRows,
  computeMappingSuggestion,
  confirmMapping,
  leaveMappingUnmatched,
  listMappingQueue,
  listReleaseAliases,
  readMappingRowDetail,
  refreshMappingSuggestion,
  remapMapping,
  revokeReleaseAlias
} from "../lib/analytics/release-mapping-service";
import {
  buildReleaseAliasScope,
  normalizeMappingTitle,
  suggestReleaseMapping,
  type MappingCandidate
} from "../lib/analytics/release-matching";
import {commitSpotifyImport, createSpotifyImportPreview} from "../lib/analytics/spotify-import-service";
import {deleteAsset} from "../lib/server/asset-storage";
import {CANONICAL_ANALYTICS_ARTIST_ID, readCurrentAnalyticsDataset} from "../lib/repositories/analytics-imports";

process.env.ASSET_STORAGE_DRIVER = "local";
process.env.AUTH_SECRET ||= "stage4-test-auth-secret-stage4-test-auth-secret-1234567890";

const runId = randomUUID();
const prefix = `stage4-${runId}`;
const now = new Date("2026-08-03T21:30:00.000Z");
const releaseIds = [`${prefix}-release-a`, `${prefix}-release-b`, `${prefix}-release-wrong`];
const importIds: string[] = [];
const aliasIds: string[] = [];

function hash(value: string) {
  return createHash("sha256").update(`${prefix}:${value}`).digest("hex");
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AdminError, `Expected AdminError ${code}`);
    assert.equal(error.code, code);
    return true;
  });
}

async function createImport(idSuffix: string, metadata = "{}", options: {period?: boolean; status?: string} = {}) {
  const id = `${prefix}-import-${idSuffix}`;
  importIds.push(id);
  return prisma.analyticsImport.create({data: {id, source: "SPOTIFY_FOR_ARTISTS", importType: "SONGS_PERIOD", originalFilename: `${prefix}-${idSuffix}.csv`, fileHash: hash(idSuffix), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, uploadedByUsername: "stage4", uploadedAt: now, status: options.status ?? "IMPORTED", userConfirmedPeriodStart: options.period === false ? null : new Date("2026-07-01T00:00:00.000Z"), userConfirmedPeriodEnd: options.period === false ? null : new Date("2026-07-28T00:00:00.000Z"), periodDatesUserConfirmed: options.period !== false, rowCount: 1, acceptedRowCount: 0, unmatchedRowCount: 1, validationSummary: "{}", metadata, acceptedAt: now, createdAt: now, updatedAt: now}});
}

async function createRow(importId: string, suffix: string, values: Record<string, unknown>, options: {status?: string; outcome?: string} = {}) {
  const id = `${prefix}-row-${suffix}`;
  const title = String(values.exportedTitle ?? "");
  return prisma.analyticsImportRow.create({data: {id, importId, sourceRowNumber: Number(suffix.replace(/\D/g, "")) || Math.floor(Math.random() * 100000) + 2, exportType: "SONGS_PERIOD", rowIdentityKey: `${normalizeMappingTitle(title)}|${String(values.exportedReleaseDate ?? "")}`, originalValues: JSON.stringify(values), safeDisplayValues: JSON.stringify(values), normalizedValues: JSON.stringify(values), structuralOutcome: options.outcome ?? "ACCEPTED", mappingStatus: options.status ?? "UNMATCHED", mappingReason: "TEST", mappingConfidence: "NO_MATCH", mappingEvidence: "{}", unmatchedReason: options.status === "UNREVIEWED" ? null : "USER_DEFERRED", createdAt: now, updatedAt: now}});
}

async function cleanup() {
  const stored = await prisma.analyticsImport.findMany({where: {id: {in: importIds}}, select: {rawFileStorageKey: true}});
  await prisma.mappingAuditEvent.deleteMany({where: {OR: [{importId: {in: importIds}}, {rowId: {startsWith: prefix}}, {aliasId: {in: aliasIds}}]}});
  await prisma.songPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImportRow.deleteMany({where: {importId: {in: importIds}}});
  await prisma.releaseImportAlias.updateMany({where: {id: {in: aliasIds}}, data: {supersededByAliasId: null}});
  await prisma.releaseImportAlias.deleteMany({where: {OR: [{id: {in: aliasIds}}, {confirmedByUsername: {startsWith: prefix}}]}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: {in: releaseIds}}});
  for (const {rawFileStorageKey} of stored) if (rawFileStorageKey) await deleteAsset("analytics-raw", rawFileStorageKey).catch(() => undefined);
}

async function main() {
  const admin = await prisma.adminUser.findFirstOrThrow();
  const actor = {userId: admin.id, username: `${prefix}-admin`};
  await prisma.release.createMany({data: [
    {id: releaseIds[0], slug: releaseIds[0], title: "Mahoraga (Jujutsu Kaisen Rap)", primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, spotifyUrl: "https://open.spotify.com/track/TrackAAA123", isrc: "US-AAA-26-00001", upc: "111111111111", releaseDate: new Date("2026-07-01T00:00:00.000Z"), createdOn: now, updatedOn: now},
    {id: releaseIds[1], slug: releaseIds[1], title: "Mahoraga - Remastered", primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, spotifyUrl: "https://open.spotify.com/track/TrackBBB456", isrc: "US-BBB-26-00002", upc: "222222222222", releaseDate: new Date("2026-07-01T00:00:00.000Z"), createdOn: now, updatedOn: now},
    {id: releaseIds[2], slug: releaseIds[2], title: "Mahoraga (Jujutsu Kaisen Rap)", primaryArtistProfileId: null, spotifyUrl: "https://open.spotify.com/track/TrackWRONG9", isrc: "US-WRG-26-00003", upc: "333333333333", releaseDate: new Date("2026-07-01T00:00:00.000Z"), createdOn: now, updatedOn: now}
  ]});

  assert.equal(normalizeMappingTitle("  MAHORAGA   —  Live  "), "mahoraga - live");
  assert.notEqual(normalizeMappingTitle("Mahoraga"), normalizeMappingTitle("Mahoraga - Remastered"));
  const candidates = await prisma.release.findMany({where: {id: {in: releaseIds}}, select: {id: true, title: true, releaseDate: true, primaryArtistProfileId: true, spotifyUrl: true, isrc: true, upc: true}}) as MappingCandidate[];
  const suggest = (evidence: Parameters<typeof suggestReleaseMapping>[0]["evidence"], aliases: Parameters<typeof suggestReleaseMapping>[0]["aliases"] = []) => suggestReleaseMapping({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", evidence, candidates, aliases});
  assert.equal(suggest({exportedTitle: "x", spotifyTrackId: "TrackAAA123"}).confidence, "EXACT_ID");
  assert.equal(suggest({exportedTitle: "x", isrc: "USAAA2600001"}).matchMethod, "ISRC");
  assert.equal(suggest({exportedTitle: "x", spotifyUrl: "https://open.spotify.com/track/TrackAAA123?si=x"}).matchMethod, "SPOTIFY_URL_TRACK_ID");
  assert.equal(suggest({exportedTitle: "x", upc: "111111111111", exportedReleaseDate: "2026-07-01"}).matchMethod, "UPC_RELEASE_CONTEXT");
  assert.equal(suggest({exportedTitle: "Mahoraga (Jujutsu Kaisen Rap)", exportedReleaseDate: "2026-07-01"}).confidence, "EXACT_TITLE_DATE");
  assert.equal(suggest({exportedTitle: "Mahoraga - Remastered"}).confidence, "EXACT_TITLE_UNIQUE");
  assert.ok(["FUZZY_HIGH", "FUZZY_LOW"].includes(suggest({exportedTitle: "Mahoraga (Jujutsu Kaisen Rapp)"}).confidence));
  assert.notEqual(suggest({exportedTitle: "Mahoraga feat. Another Artist"}).confidence, "EXACT_TITLE_UNIQUE");
  assert.notEqual(suggest({exportedTitle: "Mahoraga Live"}).confidence, "EXACT_TITLE_UNIQUE");
  assert.equal(suggest({exportedTitle: "Completely unrelated"}).confidence, "NO_MATCH");
  const wrongOnly = suggestReleaseMapping({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", evidence: {exportedTitle: candidates[2].title, spotifyTrackId: "TrackWRONG9"}, candidates: [candidates[2]]});
  assert.equal(wrongOnly.confidence, "NO_MATCH");
  const ambiguous = suggestReleaseMapping({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", evidence: {exportedTitle: "Same"}, candidates: [{...candidates[0], title: "Same"}, {...candidates[1], title: "Same"}]});
  assert.equal(ambiguous.confidence, "AMBIGUOUS");
  assert.notEqual(buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Same", exportedReleaseDate: "2026-07-01"}), buildReleaseAliasScope({artistProfileId: "another-artist", source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Same", exportedReleaseDate: "2026-07-01"}));
  assert.notEqual(buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Same", exportedReleaseDate: "2026-07-01"}), buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "TRACK_STREAM_TIMELINE", exportedTitle: "Same", exportedReleaseDate: "2026-07-01"}));
  assert.notEqual(buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Same", exportedReleaseDate: "2026-07-01"}), buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Same", exportedReleaseDate: null}));

  const importA = await createImport("main");
  const rowA = await createRow(importA.id, "101", {exportedTitle: "Legacy Mahoraga Export", exportedReleaseDate: "2026-07-01", listeners: 10, streams: 20, saves: 3});
  await expectCode(() => confirmMapping(rowA.id, {actor, releaseId: "missing"}), "RELEASE_NOT_FOUND");
  await expectCode(() => confirmMapping(rowA.id, {actor, releaseId: releaseIds[2]}), "ARTIST_MISMATCH");
  const confirmed = await confirmMapping(rowA.id, {actor, releaseId: releaseIds[0], createAlias: true, reason: "Catalog reviewed", now});
  assert.equal(confirmed.code, "MAPPING_CONFIRMED");
  assert.ok(confirmed.aliasId);
  aliasIds.push(confirmed.aliasId!);
  const immutable = await prisma.songPeriodSnapshot.findUniqueOrThrow({where: {mappingRowId: rowA.id}});
  assert.equal(immutable.releaseId, releaseIds[0]);
  const refreshedImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: importA.id}});
  assert.equal(refreshedImport.acceptedRowCount, 1);
  assert.equal(refreshedImport.unmatchedRowCount, 0);
  assert.ok(JSON.parse(refreshedImport.validationSummary).mappingReconciliation);
  await expectCode(() => confirmMapping(rowA.id, {actor, releaseId: releaseIds[0]}), "MAPPING_ALREADY_CONFIRMED");
  const duplicateRow = await createRow(importA.id, "105", {exportedTitle: "Duplicate target", exportedReleaseDate: "2026-07-02", listeners: 1, streams: 1, saves: 0});
  await expectCode(() => confirmMapping(duplicateRow.id, {actor, releaseId: releaseIds[0]}), "MAPPING_CONFLICT");
  const currentA = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  assert.ok(currentA.songPeriodSnapshots.some(({id, releaseId}) => id === immutable.id && releaseId === releaseIds[0]));

  const importAliasReuse = await createImport("alias-reuse");
  const aliasRow = await createRow(importAliasReuse.id, "102", {exportedTitle: "Legacy Mahoraga Export", exportedReleaseDate: "2026-07-01", listeners: 5, streams: 8, saves: 1}, {status: "UNREVIEWED"});
  const aliasSuggestion = await computeMappingSuggestion(aliasRow.id);
  assert.equal(aliasSuggestion.confidence, "EXACT_ALIAS");
  assert.equal(aliasSuggestion.mayAutoApply, true);
  await refreshMappingSuggestion(aliasRow.id, now);
  assert.equal((await prisma.analyticsImportRow.findUniqueOrThrow({where: {id: aliasRow.id}})).mappingStatus, "SUGGESTED");
  await expectCode(() => confirmMapping(aliasRow.id, {actor, releaseId: releaseIds[1], createAlias: true}), "ALIAS_CONFLICT");

  const remapped = await remapMapping(rowA.id, {actor, releaseId: releaseIds[1], reason: "Confirmed remaster identity", createAlias: true, now});
  assert.equal(remapped.code, "MAPPING_REMAPPED");
  assert.ok(remapped.aliasId);
  aliasIds.push(remapped.aliasId!);
  assert.equal((await prisma.songPeriodSnapshot.findUniqueOrThrow({where: {id: immutable.id}})).releaseId, releaseIds[0]);
  const currentRemapped = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  assert.ok(currentRemapped.songPeriodSnapshots.some(({id, releaseId}) => id === immutable.id && releaseId === releaseIds[1]));
  const oldAlias = await prisma.releaseImportAlias.findUniqueOrThrow({where: {id: confirmed.aliasId!}});
  assert.equal(oldAlias.status, "SUPERSEDED");
  assert.equal(oldAlias.supersededByAliasId, remapped.aliasId);
  await expectCode(() => remapMapping(rowA.id, {actor, releaseId: releaseIds[0], reason: ""}), "REMAP_REASON_REQUIRED");

  await leaveMappingUnmatched(rowA.id, {actor, reason: "VERSION_NOT_SUPPORTED", note: "Keep for later", now});
  assert.equal((await prisma.songPeriodSnapshot.findUniqueOrThrow({where: {id: immutable.id}})).releaseId, releaseIds[0]);
  const currentUnmatched = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  assert.equal(currentUnmatched.songPeriodSnapshots.some(({id}) => id === immutable.id), false);
  await expectCode(() => leaveMappingUnmatched(rowA.id, {actor, reason: "BAD_REASON"}), "INVALID_UNMATCHED_REASON");

  const detail = await readMappingRowDetail(rowA.id);
  assert.ok(detail.auditEvents.some(({action}) => action === "REMAPPED"));
  assert.equal(JSON.stringify(detail).includes("rawFileStorageKey"), false);
  const queue = await listMappingQueue({page: 1, pageSize: 1, mappingStatus: "UNMATCHED", artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID});
  assert.equal(queue.pageSize, 1);
  assert.ok(queue.total >= 1);
  const aliases = await listReleaseAliases({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID});
  assert.ok(aliases.items.some(({id}) => id === remapped.aliasId));
  assert.equal(JSON.stringify(aliases).includes("activeScopeKey"), false);
  await revokeReleaseAlias(remapped.aliasId!, {actor, reason: "No longer reusable", now});
  await expectCode(() => revokeReleaseAlias(remapped.aliasId!, {actor, reason: "again"}), "ALIAS_REVOKED");
  const afterRevoke = await computeMappingSuggestion(aliasRow.id);
  assert.notEqual(afterRevoke.confidence, "EXACT_ALIAS");

  const noDateImport = await createImport("no-date");
  const noDateRow = await createRow(noDateImport.id, "103", {exportedTitle: "No Date", listeners: 1, streams: 1, saves: 0});
  await expectCode(() => confirmMapping(noDateRow.id, {actor, releaseId: releaseIds[0], createAlias: true}), "MISSING_CONFIRMATION");
  const rejectedImport = await createImport("rejected");
  const rejectedRow = await createRow(rejectedImport.id, "104", {exportedTitle: "Rejected", exportedReleaseDate: "2026-07-01", listeners: 1, streams: 1, saves: 0}, {outcome: "REJECTED"});
  await expectCode(() => confirmMapping(rejectedRow.id, {actor, releaseId: releaseIds[0]}), "MAPPING_ROW_NOT_ELIGIBLE");
  const noPeriodImport = await createImport("no-period", "{}", {period: false});
  const noPeriodRow = await createRow(noPeriodImport.id, "106", {exportedTitle: "No period", exportedReleaseDate: "2026-07-01", listeners: 1, streams: 1, saves: 0});
  await expectCode(() => confirmMapping(noPeriodRow.id, {actor, releaseId: releaseIds[0]}), "PERIOD_NOT_CONFIRMED");
  const inactiveImport = await createImport("inactive", "{}", {status: "WITHDRAWN"});
  const inactiveRow = await createRow(inactiveImport.id, "107", {exportedTitle: "Inactive", exportedReleaseDate: "2026-07-01", listeners: 1, streams: 1, saves: 0});
  await expectCode(() => confirmMapping(inactiveRow.id, {actor, releaseId: releaseIds[0]}), "IMPORT_NOT_ACTIVE");

  const concurrentImport = await createImport("concurrent");
  const concurrentRow = await createRow(concurrentImport.id, "108", {exportedTitle: "Concurrent", exportedReleaseDate: "2026-07-01", listeners: 1, streams: 2, saves: 0});
  const confirmations = await Promise.allSettled([
    confirmMapping(concurrentRow.id, {actor, releaseId: releaseIds[0], now}),
    confirmMapping(concurrentRow.id, {actor, releaseId: releaseIds[0], now})
  ]);
  assert.equal(confirmations.filter(({status}) => status === "fulfilled").length, 1);
  assert.equal((await prisma.songPeriodSnapshot.count({where: {mappingRowId: concurrentRow.id}})), 1);
  const remaps = await Promise.allSettled([
    remapMapping(concurrentRow.id, {actor, releaseId: releaseIds[1], reason: "Concurrent correction", now}),
    remapMapping(concurrentRow.id, {actor, releaseId: releaseIds[1], reason: "Concurrent correction", now})
  ]);
  assert.equal(remaps.filter(({status}) => status === "fulfilled").length, 1);
  assert.equal((await prisma.analyticsImportRow.findUniqueOrThrow({where: {id: concurrentRow.id}})).confirmedReleaseId, releaseIds[1]);

  const backfillMappedImport = await createImport("backfill", JSON.stringify({temporaryMappings: [{originalRowNumber: 2, exportedTitle: "Backfill mapped", safeDisplayExportedTitle: "Backfill mapped", exportedReleaseDate: "2026-07-01", decision: "MAPPED", releaseId: releaseIds[0]}, {originalRowNumber: 3, exportedTitle: "Backfill unmatched", safeDisplayExportedTitle: "Backfill unmatched", exportedReleaseDate: "2026-07-02", decision: "UNMATCHED", releaseId: null, normalizedValues: {exportedTitle: "Backfill unmatched", exportedReleaseDate: "2026-07-02", listeners: 2, streams: 3, saves: 1}}]}));
  await prisma.songPeriodSnapshot.create({data: {id: `${prefix}-backfill-snapshot`, importId: backfillMappedImport.id, releaseId: releaseIds[0], periodStart: new Date("2026-07-01T00:00:00.000Z"), periodEnd: new Date("2026-07-28T00:00:00.000Z"), exportedTitle: "Backfill mapped", exportedReleaseDate: new Date("2026-07-01T00:00:00.000Z"), listeners: 2, streams: 4, saves: 1, createdAt: now}});
  const backfill = await backfillStage3AnalyticsImportRows({importId: backfillMappedImport.id, now});
  assert.equal(backfill.rowsCreated, 2);
  assert.equal(backfill.mappedRows, 1);
  assert.equal(backfill.unmatchedRows, 1);
  const rerun = await backfillStage3AnalyticsImportRows({importId: backfillMappedImport.id, now});
  assert.equal(rerun.rowsCreated, 0);
  assert.equal(rerun.rowsSkipped, 2);
  const missingImport = await createImport("missing-metadata", "{}");
  assert.equal((await backfillStage3AnalyticsImportRows({importId: missingImport.id, now})).issues[0]?.code, "MISSING_METADATA");
  const malformedImport = await createImport("malformed-metadata", "not-json");
  assert.equal((await backfillStage3AnalyticsImportRows({importId: malformedImport.id, now})).issues[0]?.code, "MALFORMED_METADATA");

  const stage3Alias = await prisma.releaseImportAlias.create({data: {id: `${prefix}-commit-alias`, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Auto Alias Song", normalizedTitle: normalizeMappingTitle("Auto Alias Song"), exportedReleaseDate: new Date("2026-07-03T00:00:00.000Z"), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseId: releaseIds[0], status: "ACTIVE", matchMethod: "MANUAL_CONFIRMATION", evidence: "{}", scopeKey: buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Auto Alias Song", exportedReleaseDate: "2026-07-03"}), activeScopeKey: buildReleaseAliasScope({artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Auto Alias Song", exportedReleaseDate: "2026-07-03"}), confirmedById: admin.id, confirmedByUsername: actor.username, confirmedAt: now, createdAt: now, updatedAt: now}});
  aliasIds.push(stage3Alias.id);
  const bytes = new TextEncoder().encode("song,listeners,streams,saves,release_date\nAuto Alias Song,4,9,1,2026-07-03");
  const preview = await createSpotifyImportPreview({actor, fileName: `${prefix}-alias-commit.csv`, mimeType: "text/csv", bytes, previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now});
  const aliasCommit = await commitSpotifyImport({actor, previewToken: preview.previewToken!, clientIdempotencyKey: `${prefix}-alias-commit-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", acknowledgeWarnings: true, now});
  importIds.push(aliasCommit.importId);
  const autoRow = await prisma.analyticsImportRow.findFirstOrThrow({where: {importId: aliasCommit.importId}});
  assert.equal(autoRow.mappingReason, "EXISTING_ALIAS_REUSED");
  assert.equal(autoRow.appliedAliasId, stage3Alias.id);

  const routeRoot = path.join(process.cwd(), "app", "api", "analytics");
  const routeFiles = ["mappings/queue/route.ts", "mappings/[rowId]/route.ts", "mappings/[rowId]/confirm/route.ts", "mappings/[rowId]/unmatch/route.ts", "mappings/[rowId]/remap/route.ts", "aliases/route.ts", "aliases/[id]/revoke/route.ts"];
  for (const relative of routeFiles) {
    const source = fs.readFileSync(path.join(routeRoot, relative), "utf8");
    assert.match(source, /requireAuthenticatedApiRequest\(request\)/);
    assert.equal(source.includes("rawFileStorageKey"), false);
  }

  console.log("Catalog and release mapping tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await cleanup().catch((error) => console.error("Stage 4 cleanup failed", error));
  await prisma.$disconnect();
});
