import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {put} from "@vercel/blob";

import {AdminError} from "../lib/server/admin-error-response";
import {prisma} from "../lib/db/prisma";
import {
  commitSpotifyImport,
  createSpotifyImportPreview,
  listExpiredSpotifyImportFiles,
  listExpiredSpotifyPreviewFiles,
  listOrphanedSpotifyRawFiles,
  listSpotifyImports,
  readSpotifyImportDetail,
  reprocessSpotifyImport,
  SPOTIFY_IMPORT_MAX_FILE_BYTES,
  withdrawSpotifyImport
} from "../lib/analytics/spotify-import-service";
import {checksumSpotifyPreviewResult, createSpotifyPreviewToken, readSpotifyPreviewToken} from "../lib/analytics/spotify-preview-token";
import {parseSpotifyExport} from "../lib/analytics/spotify-export-parser";
import {deleteAsset, listStoredAssetReferences, storeAsset} from "../lib/server/asset-storage";
import {readCurrentAnalyticsDataset, CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";

process.env.ASSET_STORAGE_DRIVER = "local";
process.env.PRIVATE_STORAGE_DRIVER ||= "local";
process.env.AUTH_SECRET ||= "stage3-test-auth-secret-stage3-test-auth-secret-1234567890";

const runId = randomUUID();
const prefix = `stage3-${runId}`;
const encoder = new TextEncoder();
const now = new Date("2026-08-03T19:00:00.000Z");
let sequence = 1;
const releaseIds = [1, 2, 3, 4, 5].map((index) => `${prefix}-release-${index}`);
let previewAssetsBefore = new Set<string>();
let rawAssetsBefore = new Set<string>();

const audienceCsv = (date = "2026-08-01", streams = sequence++) =>
  `date,listeners,monthly listeners,monthly active listeners,streams,playlist adds,saves,followers\n${date},10,20,18,${streams},2,3,4`;
const trackCsv = (streams = sequence++) => `date,streams\n2026-08-01,${streams}`;
const songsCsv = (suffix: string) => `song,listeners,streams,saves,release_date\nSong ${suffix} A,10,20,3,2026-07-01\nSong ${suffix} B,11,21,4,2026-07-02`;
const playlistsCsv = (suffix: string) => `title,author,listeners,streams,date_added
Playlist ${suffix} 1,Spotify,10,20,n/a
Playlist ${suffix} 2,Spotify,11,21,n/a
Playlist ${suffix} 3,Spotify,12,22,-
Playlist ${suffix} 4,Spotify,13,23,
Playlist ${suffix} 5,Spotify,14,24,n/a
Playlist ${suffix} 6,Spotify,15,25,-
Playlist ${suffix} 7,Spotify,16,26,
Playlist ${suffix} 8,=owner,17,27,2026-07-11`;

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AdminError, `Expected AdminError ${code}`);
    assert.equal(error.code, code);
    return true;
  });
}

async function preview(actor: {userId: string; username: string}, name: string, text: string, options: Record<string, unknown> = {}) {
  return createSpotifyImportPreview({actor, fileName: `${prefix}-${name}.csv`, mimeType: "text/csv", bytes: encoder.encode(text), now, ...options});
}

async function createRelease(id: string, title: string) {
  return prisma.release.create({data: {id, slug: id, title, primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, createdOn: now, updatedOn: now}});
}

async function cleanup() {
  const createdImports = await prisma.analyticsImport.findMany({where: {originalFilename: {startsWith: prefix}}, select: {id: true}});
  const importIds = createdImports.map(({id}) => id);
  await prisma.mappingAuditEvent.deleteMany({where: {importId: {in: importIds}}});
  await prisma.playlistPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.songPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImportRow.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImport.updateMany({where: {id: {in: importIds}}, data: {replacedByImportId: null}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: {in: releaseIds}}});
  for (const asset of await listStoredAssetReferences("analytics-preview")) {
    if (!previewAssetsBefore.has(asset.storedPath)) await deleteAsset("analytics-preview", asset.storedPath);
  }
  for (const asset of await listStoredAssetReferences("analytics-raw")) {
    if (!rawAssetsBefore.has(asset.storedPath)) await deleteAsset("analytics-raw", asset.storedPath);
  }
}

async function main() {
  const admin = await prisma.adminUser.findFirst();
  assert.ok(admin, "A local admin user is required for workflow tests.");
  const actor = {userId: admin.id, username: admin.username};
  const otherActor = {userId: `other-${runId}`, username: "other-admin"};
  for (let index = 0; index < releaseIds.length; index += 1) await createRelease(releaseIds[index], `Stage 3 Release ${index + 1}`);
  previewAssetsBefore = new Set((await listStoredAssetReferences("analytics-preview")).map(({storedPath}) => storedPath));
  rawAssetsBefore = new Set((await listStoredAssetReferences("analytics-raw")).map(({storedPath}) => storedPath));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("Stage 3 test attempted production network contact."); }) as typeof fetch;

  const observationCountsBefore = {
    imports: await prisma.analyticsImport.count(),
    artist: await prisma.artistMetricObservation.count(),
    track: await prisma.trackMetricObservation.count(),
    songs: await prisma.songPeriodSnapshot.count(),
    playlists: await prisma.playlistPeriodSnapshot.count()
  };
  const artistText = audienceCsv();
  const artistPreview = await preview(actor, "artist", artistText);
  assert.equal(artistPreview.code, "PREVIEW_READY");
  assert.equal(artistPreview.detectedType, "ARTIST_AUDIENCE_TIMELINE");
  assert.ok(artistPreview.previewToken);
  assert.equal(JSON.stringify(artistPreview).includes("analytics-preview"), false);
  assert.equal(artistPreview.previewToken!.includes(artistPreview.fileHash!), false);
  assert.equal(artistPreview.previewToken!.includes(artistPreview.originalFilename), false);
  assert.equal(await prisma.analyticsImport.count(), observationCountsBefore.imports);
  assert.equal(await prisma.artistMetricObservation.count(), observationCountsBefore.artist);

  const tampered = `${artistPreview.previewToken!.slice(0, -2)}xx`;
  await expectCode(() => commitSpotifyImport({actor, previewToken: tampered, clientIdempotencyKey: `${prefix}-tampered`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "INVALID_PREVIEW");
  await expectCode(() => commitSpotifyImport({actor: otherActor, previewToken: artistPreview.previewToken!, clientIdempotencyKey: `${prefix}-other`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "FORBIDDEN");
  await expectCode(() => commitSpotifyImport({actor, previewToken: artistPreview.previewToken!, clientIdempotencyKey: `${prefix}-bad-artist`, artistProfileId: `missing-${runId}`, now}), "INVALID_MAPPING");

  const artistCommit = await commitSpotifyImport({actor, previewToken: artistPreview.previewToken!, clientIdempotencyKey: `${prefix}-artist-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now});
  assert.equal(artistCommit.code, "IMPORT_COMMITTED");
  const artistImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: artistCommit.importId}});
  assert.equal(artistImport.status, "IMPORTED");
  assert.equal(artistImport.rawFileExpiresAt?.toISOString(), "2026-09-02T19:00:00.000Z");
  assert.equal(await prisma.artistMetricObservation.count({where: {importId: artistCommit.importId}}), 1);
  const replay = await commitSpotifyImport({actor, previewToken: artistPreview.previewToken!, clientIdempotencyKey: `${prefix}-artist-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now});
  assert.equal(replay.code, "IMPORT_COMMIT_REPLAYED");
  assert.equal(replay.importId, artistCommit.importId);
  await expectCode(() => commitSpotifyImport({actor, previewToken: artistPreview.previewToken!, clientIdempotencyKey: `${prefix}-artist-different-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "DUPLICATE_FILE");

  const duplicate = await preview(actor, "artist-duplicate", artistText);
  assert.equal(duplicate.code, "DUPLICATE_FILE");
  assert.equal(duplicate.existingImport?.id, artistCommit.importId);
  const overlap = await preview(actor, "artist-overlap", audienceCsv("2026-08-01"));
  assert.ok(overlap.overlaps.some(({classification}) => classification === "CONFIRMED"));

  const expiredPreview = await createSpotifyImportPreview({actor, fileName: `${prefix}-expired.csv`, mimeType: "text/csv", bytes: encoder.encode(audienceCsv("2026-07-30")), now: new Date(now.getTime() - 16 * 60 * 1000)});
  await expectCode(() => commitSpotifyImport({actor, previewToken: expiredPreview.previewToken!, clientIdempotencyKey: `${prefix}-expired-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "EXPIRED_PREVIEW");

  const trackPreview = await preview(actor, "track", trackCsv(), {releaseId: releaseIds[0]});
  await expectCode(() => commitSpotifyImport({actor, previewToken: trackPreview.previewToken!, clientIdempotencyKey: `${prefix}-track-missing`, acknowledgeWarnings: true, acknowledgeFilenameNotIdentity: true, acknowledgeTrackStreamsNotRetention: true, now}), "MISSING_CONFIRMATION");
  await expectCode(() => commitSpotifyImport({actor, previewToken: trackPreview.previewToken!, clientIdempotencyKey: `${prefix}-track-invalid`, releaseId: `missing-${runId}`, acknowledgeWarnings: true, acknowledgeFilenameNotIdentity: true, acknowledgeTrackStreamsNotRetention: true, now}), "INVALID_MAPPING");
  const trackCommit = await commitSpotifyImport({actor, previewToken: trackPreview.previewToken!, clientIdempotencyKey: `${prefix}-track-key`, releaseId: releaseIds[0], acknowledgeWarnings: true, acknowledgeFilenameNotIdentity: true, acknowledgeTrackStreamsNotRetention: true, now});
  assert.equal(await prisma.trackMetricObservation.count({where: {importId: trackCommit.importId, releaseId: releaseIds[0]}}), 1);
  const potentialTrack = await preview(actor, "track-potential", trackCsv(), {artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID});
  assert.ok(potentialTrack.overlaps.some(({classification}) => classification === "POTENTIAL"));

  const songsAllPreview = await preview(actor, "songs-all", songsCsv("all"), {previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}});
  const songRowNumbers = songsAllPreview.rowPreview.map(({originalRowNumber}) => originalRowNumber);
  await expectCode(() => commitSpotifyImport({actor, previewToken: songsAllPreview.previewToken!, clientIdempotencyKey: `${prefix}-songs-no-period`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, acknowledgeWarnings: true, songMappings: [], now}), "MISSING_CONFIRMATION");
  const songsAllCommit = await commitSpotifyImport({actor, previewToken: songsAllPreview.previewToken!, clientIdempotencyKey: `${prefix}-songs-all-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", acknowledgeWarnings: true, songMappings: [{originalRowNumber: songRowNumbers[0], releaseId: releaseIds[0]}, {originalRowNumber: songRowNumbers[1], releaseId: releaseIds[1]}], now});
  assert.equal(await prisma.songPeriodSnapshot.count({where: {importId: songsAllCommit.importId}}), 2);
  const songsAllImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: songsAllCommit.importId}});
  assert.equal(songsAllImport.acceptedRowCount, 2);
  assert.equal(songsAllImport.unmatchedRowCount, 0);

  const songsPartialPreview = await preview(actor, "songs-partial", songsCsv("partial"), {previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}});
  const partialRows = songsPartialPreview.rowPreview.map(({originalRowNumber}) => originalRowNumber);
  const songsPartialCommit = await commitSpotifyImport({actor, previewToken: songsPartialPreview.previewToken!, clientIdempotencyKey: `${prefix}-songs-partial-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", acknowledgeWarnings: true, songMappings: [{originalRowNumber: partialRows[0], releaseId: releaseIds[2]}, {originalRowNumber: partialRows[1], leaveUnmatched: true}], now});
  assert.equal(await prisma.songPeriodSnapshot.count({where: {importId: songsPartialCommit.importId}}), 1);
  const partialImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: songsPartialCommit.importId}});
  assert.equal(partialImport.acceptedRowCount, 1);
  assert.equal(partialImport.unmatchedRowCount, 1);
  assert.equal(partialImport.acceptedRowCount + partialImport.unmatchedRowCount, partialImport.rowCount);
  assert.equal(await prisma.analyticsImportRow.count({where: {importId: songsPartialCommit.importId}}), 2);
  assert.match(partialImport.metadata, /NORMALIZED_ROWS_WITH_SCOPED_ALIAS_REUSE/);
  assert.match(partialImport.metadata, /UNMATCHED/);

  const formulaSongsText = 'song,listeners,streams,saves,release_date\n"=SUM(1,1)",1,2,3,2026-07-03';
  const formulaSongsPreview = await preview(actor, "songs-formula", formulaSongsText, {previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}});
  const formulaSongsCommit = await commitSpotifyImport({actor, previewToken: formulaSongsPreview.previewToken!, clientIdempotencyKey: `${prefix}-songs-formula-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", acknowledgeWarnings: true, songMappings: [{originalRowNumber: formulaSongsPreview.rowPreview[0].originalRowNumber, leaveUnmatched: true}], now});
  const formulaMetadata = (await prisma.analyticsImport.findUniqueOrThrow({where: {id: formulaSongsCommit.importId}})).metadata;
  assert.match(formulaMetadata, /'=SUM\(1,1\)/);
  assert.match(formulaMetadata, /"exportedTitle":"=SUM\(1,1\)"/);

  const playlistPreview = await preview(actor, "playlists", playlistsCsv("one"), {previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}});
  await expectCode(() => commitSpotifyImport({actor, previewToken: playlistPreview.previewToken!, clientIdempotencyKey: `${prefix}-playlist-no-warning`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", now}), "MISSING_CONFIRMATION");
  const playlistCommit = await commitSpotifyImport({actor, previewToken: playlistPreview.previewToken!, clientIdempotencyKey: `${prefix}-playlist-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, periodStart: "2026-07-01", periodEnd: "2026-07-28", acknowledgeWarnings: true, now});
  const playlistRows = await prisma.playlistPeriodSnapshot.findMany({where: {importId: playlistCommit.importId}, orderBy: {playlistTitle: "asc"}});
  assert.equal(playlistRows.length, 8);
  assert.equal(playlistRows.filter(({dateAdded}) => dateAdded === null).length, 7);
  assert.ok(playlistRows.every(({playlistSpotifyId}) => playlistSpotifyId === null));
  const playlistImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: playlistCommit.importId}});
  assert.equal(playlistImport.rowCount, 8);
  assert.equal(playlistImport.acceptedRowCount, 8);
  assert.equal(playlistImport.rejectedRowCount, 0);
  assert.equal(playlistImport.acceptedRowCount + playlistImport.rejectedRowCount, playlistImport.rowCount);

  const keyConflictPreview = await preview(actor, "different-key-file", audienceCsv("2026-08-02"));
  await expectCode(() => commitSpotifyImport({actor, previewToken: keyConflictPreview.previewToken!, clientIdempotencyKey: `${prefix}-artist-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "CONFLICT");

  const replacementBasePreview = await preview(actor, "replace-base", audienceCsv("2026-07-20"));
  const replacementBase = await commitSpotifyImport({actor, previewToken: replacementBasePreview.previewToken!, clientIdempotencyKey: `${prefix}-replace-base-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now});
  const replacementPreview = await preview(actor, "replace-new", audienceCsv("2026-07-20"));
  const replacement = await commitSpotifyImport({actor, previewToken: replacementPreview.previewToken!, clientIdempotencyKey: `${prefix}-replace-new-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, replacementTargetImportId: replacementBase.importId, now});
  const replaced = await prisma.analyticsImport.findUniqueOrThrow({where: {id: replacementBase.importId}});
  assert.equal(replaced.status, "REPLACED");
  assert.equal(replaced.replacedByImportId, replacement.importId);
  const replacementRacePreview = await preview(actor, "replace-race", audienceCsv("2026-07-20"));
  await expectCode(() => commitSpotifyImport({actor, previewToken: replacementRacePreview.previewToken!, clientIdempotencyKey: `${prefix}-replace-race-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, replacementTargetImportId: replacementBase.importId, now}), "CONFLICT");
  await expectCode(() => withdrawSpotifyImport(replacementBase.importId, actor, "Cannot withdraw replaced", now), "CONFLICT");

  const withdrawal = await withdrawSpotifyImport(artistCommit.importId, actor, "Test withdrawal", now);
  assert.equal(withdrawal.code, "IMPORT_WITHDRAWN");
  assert.equal((await withdrawSpotifyImport(artistCommit.importId, actor, "Repeated", now)).code, "IMPORT_ALREADY_WITHDRAWN");
  assert.equal(await prisma.artistMetricObservation.count({where: {importId: artistCommit.importId}}), 1);
  assert.equal((await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID)).imports.some(({id}) => id === artistCommit.importId), false);
  const withdrawnDuplicate = await preview(actor, "withdrawn-duplicate", artistText);
  assert.equal(withdrawnDuplicate.existingImport?.withdrawn, true);
  assert.equal(withdrawnDuplicate.duplicateRecommendation, "REVIEW_WITHDRAWN_IMPORT");

  const reprocess = await reprocessSpotifyImport(trackCommit.importId, actor, now);
  assert.equal(reprocess.code, "PREVIEW_READY");
  assert.ok(reprocess.previewToken);
  assert.equal((await prisma.analyticsImport.findUniqueOrThrow({where: {id: trackCommit.importId}})).status, "IMPORTED");
  await prisma.analyticsImport.update({where: {id: trackCommit.importId}, data: {rawFileExpiresAt: new Date(now.getTime() - 1)}});
  await expectCode(() => reprocessSpotifyImport(trackCommit.importId, actor, now), "RAW_FILE_UNAVAILABLE");
  await prisma.analyticsImport.update({where: {id: trackCommit.importId}, data: {rawFileExpiresAt: new Date(now.getTime() + 86_400_000), rawFileDeletedAt: now}});
  await expectCode(() => reprocessSpotifyImport(trackCommit.importId, actor, now), "RAW_FILE_UNAVAILABLE");

  const listing = await listSpotifyImports({page: 1, pageSize: 2, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID});
  assert.equal(listing.pageSize, 2);
  assert.equal(listing.items.length, 2);
  assert.equal("rawFileStorageKey" in listing.items[0], false);
  assert.equal((await listSpotifyImports({page: Number.NaN, pageSize: 1000})).pageSize, 100);
  const withdrawnList = await listSpotifyImports({withdrawn: true, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID});
  assert.ok(withdrawnList.items.some(({id}) => id === artistCommit.importId));
  const detail = await readSpotifyImportDetail(songsPartialCommit.importId);
  assert.equal("rawFileStorageKey" in detail, false);
  assert.equal("commitIdempotencyKey" in detail, false);
  assert.equal(detail._count.songPeriodSnapshots, 1);
  assert.ok((detail.validationSummary as {reconciliation?: unknown}).reconciliation);

  const rollbackPreview = await preview(otherActor, "rollback", audienceCsv("2026-07-10"));
  const importsBeforeRollback = await prisma.analyticsImport.count();
  await expectCode(() => commitSpotifyImport({actor: otherActor, previewToken: rollbackPreview.previewToken!, clientIdempotencyKey: `${prefix}-rollback-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "TRANSACTION_FAILURE");
  assert.equal(await prisma.analyticsImport.count(), importsBeforeRollback);

  const concurrentPreview = await preview(actor, "concurrent", audienceCsv("2026-07-11"));
  const concurrentResults = await Promise.all([
    commitSpotifyImport({actor, previewToken: concurrentPreview.previewToken!, clientIdempotencyKey: `${prefix}-concurrent-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}),
    commitSpotifyImport({actor, previewToken: concurrentPreview.previewToken!, clientIdempotencyKey: `${prefix}-concurrent-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now})
  ]);
  assert.equal(concurrentResults[0].importId, concurrentResults[1].importId);
  assert.equal(await prisma.analyticsImport.count({where: {commitIdempotencyKey: `${prefix}-concurrent-key`}}), 1);
  const concurrentWithdrawals = await Promise.all([
    withdrawSpotifyImport(concurrentResults[0].importId, actor, "Concurrent withdrawal", now),
    withdrawSpotifyImport(concurrentResults[0].importId, actor, "Concurrent withdrawal", now)
  ]);
  assert.ok(concurrentWithdrawals.some(({code}) => code === "IMPORT_WITHDRAWN"));
  assert.ok(concurrentWithdrawals.some(({code}) => code === "IMPORT_ALREADY_WITHDRAWN"));

  const rejectedText = "date,listeners,monthly listeners,monthly active listeners,streams,playlist adds,saves,followers\ninvalid,1,1,1,1,1,1,1";
  const rejectedResult = parseSpotifyExport({fileName: `${prefix}-rejected.csv`, bytes: encoder.encode(rejectedText), mimeType: "text/csv"});
  const rejectedStored = await storeAsset({kind: "analytics-preview", fileName: `${randomUUID()}.csv`, data: Buffer.from(rejectedText), access: "private", contentType: "text/csv"});
  const rejectedToken = createSpotifyPreviewToken({userId: actor.userId, fileHash: rejectedResult.fileMetadata.sha256!, parserVersion: rejectedResult.parserVersion, normalizationVersion: rejectedResult.normalizationVersion, detectedType: "ARTIST_AUDIENCE_TIMELINE", parsedResultChecksum: checksumSpotifyPreviewResult(rejectedResult), temporaryRawFileReference: rejectedStored.storedPath, originalFileName: `${prefix}-rejected.csv`, mimeType: "text/csv", sizeBytes: Buffer.byteLength(rejectedText), previewPeriod: null, candidateArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, candidateReleaseId: null, reprocessSourceImportId: null}, {now});
  await expectCode(() => commitSpotifyImport({actor, previewToken: rejectedToken.token, clientIdempotencyKey: `${prefix}-rejected-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "INVALID_FILE");

  const mismatchPreview = await preview(actor, "hash-mismatch", audienceCsv("2026-07-12"));
  const mismatchPayload = readSpotifyPreviewToken(mismatchPreview.previewToken!)!;
  if (process.env.PRIVATE_STORAGE_DRIVER === "vercel-blob") {
    await put(mismatchPayload.temporaryRawFileReference, Buffer.from("changed"), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN
    });
  } else {
    fs.writeFileSync(
      path.join(process.cwd(), "storage", "analytics-preview", path.basename(mismatchPayload.temporaryRawFileReference)),
      "changed"
    );
  }
  await expectCode(() => commitSpotifyImport({actor, previewToken: mismatchPreview.previewToken!, clientIdempotencyKey: `${prefix}-hash-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "INVALID_PREVIEW");

  const versionText = audienceCsv("2026-07-13");
  const versionResult = parseSpotifyExport({fileName: `${prefix}-version.csv`, bytes: encoder.encode(versionText), mimeType: "text/csv"});
  const versionStored = await storeAsset({kind: "analytics-preview", fileName: `${randomUUID()}.csv`, data: Buffer.from(versionText), access: "private", contentType: "text/csv"});
  const versionToken = createSpotifyPreviewToken({userId: actor.userId, fileHash: versionResult.fileMetadata.sha256!, parserVersion: "0.0.0", normalizationVersion: versionResult.normalizationVersion, detectedType: "ARTIST_AUDIENCE_TIMELINE", parsedResultChecksum: checksumSpotifyPreviewResult(versionResult), temporaryRawFileReference: versionStored.storedPath, originalFileName: `${prefix}-version.csv`, mimeType: "text/csv", sizeBytes: Buffer.byteLength(versionText), previewPeriod: null, candidateArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, candidateReleaseId: null, reprocessSourceImportId: null}, {now});
  await expectCode(() => commitSpotifyImport({actor, previewToken: versionToken.token, clientIdempotencyKey: `${prefix}-version-key`, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, now}), "INVALID_PREVIEW");

  const malicious = await createSpotifyImportPreview({actor, fileName: "../../=SUM(1,1).csv", mimeType: "text/csv", bytes: encoder.encode(audienceCsv("2026-07-14")), now});
  assert.equal(malicious.originalFilename.includes(".."), false);
  assert.equal(malicious.safeDisplayFilename.startsWith("'="), true);
  assert.equal(JSON.stringify(malicious).includes("analytics-preview"), false);
  const oversized = await createSpotifyImportPreview({actor, fileName: `${prefix}-large.csv`, mimeType: "text/csv", bytes: new Uint8Array(SPOTIFY_IMPORT_MAX_FILE_BYTES + 1), now});
  assert.equal(oversized.code, "PREVIEW_BLOCKED");

  const expiredImports = await listExpiredSpotifyImportFiles(new Date("2100-01-01T00:00:00Z"));
  assert.ok(expiredImports.some(({id}) => id === artistCommit.importId));
  assert.ok(Array.isArray(await listExpiredSpotifyPreviewFiles(new Date("2100-01-01T00:00:00Z"))));
  assert.ok(Array.isArray(await listOrphanedSpotifyRawFiles(new Date("2100-01-01T00:00:00Z"), 0)));

  const routeFiles = [
    "app/api/analytics/imports/route.ts",
    "app/api/analytics/imports/preview/route.ts",
    "app/api/analytics/imports/commit/route.ts",
    "app/api/analytics/imports/[id]/route.ts",
    "app/api/analytics/imports/[id]/withdraw/route.ts",
    "app/api/analytics/imports/[id]/reprocess/route.ts"
  ];
  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8");
    assert.match(source, /requireAuthenticatedApiRequest\(request\)/, `${routeFile} must enforce admin authentication`);
    assert.match(source, /adminErrorResponse/, `${routeFile} must use standardized admin errors`);
  }
  assert.match(fs.readFileSync(path.join(process.cwd(), "app/api/analytics/imports/preview/route.ts"), "utf8"), /file\.size > SPOTIFY_IMPORT_MAX_FILE_BYTES/);
  const publicAssetRoute = fs.readFileSync(path.join(process.cwd(), "app/api/assets/[kind]/[file]/route.ts"), "utf8");
  assert.equal(publicAssetRoute.includes('kind !== "analytics-preview"'), false);
  assert.equal(publicAssetRoute.includes('kind !== "analytics-raw"'), false);

  globalThis.fetch = originalFetch;
  console.log("Spotify preview and transactional import workflow tests passed.");

}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => console.error("Stage 3 test cleanup failed:", error));
    await prisma.$disconnect();
  });
