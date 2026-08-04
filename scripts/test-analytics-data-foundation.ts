import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {gunzipSync} from "node:zlib";

import {Prisma} from "@prisma/client";

import {createDatabaseSnapshotArtifact} from "../lib/backups/snapshot";
import {prisma} from "../lib/db/prisma";
import {
  acceptAnalyticsImport,
  appendArtistMetricObservations,
  appendPlaylistPeriodSnapshots,
  appendSongPeriodSnapshots,
  appendTrackMetricObservations,
  CANONICAL_ANALYTICS_ARTIST_ID,
  createAnalyticsImport,
  findAnalyticsImportByHash,
  readCanonicalAnalyticsArtist,
  readCurrentAnalyticsDataset,
  replaceAnalyticsImport,
  withdrawAnalyticsImport
} from "../lib/repositories/analytics-imports";

const runId = randomUUID();
const releaseId = `analytics-test-release-${runId}`;
const importIds = ["old", "new", "withdrawn"].map((label) => `analytics-test-${label}-${runId}`);
const hash = (label: string) => createHash("sha256").update(`${runId}:${label}`).digest("hex");
const metricDate = new Date("2026-07-01T00:00:00.000Z");
const periodStart = new Date("2026-07-01T00:00:00.000Z");
const periodEnd = new Date("2026-07-28T00:00:00.000Z");

async function expectForeignKeyRestriction(action: () => Promise<unknown>, label: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Prisma.PrismaClientKnownRequestError, `${label} should fail through Prisma`);
    assert.ok(["P2003", "P2014"].includes(error.code), `${label} should be blocked by a foreign key, got ${error.code}`);
    return true;
  });
}

async function cleanup() {
  await prisma.playlistPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.songPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImport.updateMany({where: {id: {in: importIds}}, data: {replacedByImportId: null}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: releaseId}});
}

async function main() {
  await cleanup();
  const artist = await readCanonicalAnalyticsArtist();
  assert.equal(artist.slug, "vvviruz");
  assert.equal(artist.displayName, "vvviruz");
  assert.equal(artist.publishedAt, null);
  assert.equal(artist.publishedVersionId, null);

  const now = new Date();
  await prisma.release.create({
    data: {id: releaseId, slug: releaseId, title: "Analytics foundation test", createdOn: now, updatedOn: now}
  });

  for (let index = 0; index < importIds.length; index += 1) {
    await createAnalyticsImport({
      id: importIds[index],
      importType: "AUDIENCE_TIMELINE",
      originalFilename: `${index}.csv`,
      fileHash: hash(String(index)),
      artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      uploadedAt: new Date(`2026-07-0${index + 1}T12:00:00.000Z`),
      rawFileStorageDriver: "local",
      rawFileStorageKey: `private/analytics/${runId}/${index}.csv`,
      rawFileSizeBytes: 100 + index
    });
  }

  const [oldImportId, newImportId, withdrawnImportId] = importIds;
  await appendArtistMetricObservations([
    {importId: oldImportId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate, listeners: 10, monthlyListeners: 20, monthlyActiveListeners: 15, streams: 30, playlistAdds: 1, saves: 2, followers: 3},
    {importId: newImportId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate, listeners: 11, monthlyListeners: 21, monthlyActiveListeners: 16, streams: 31, playlistAdds: 2, saves: 3, followers: 4},
    {importId: withdrawnImportId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate, listeners: 99, monthlyListeners: 99, monthlyActiveListeners: 99, streams: 99, playlistAdds: 9, saves: 9, followers: 9}
  ]);
  await appendTrackMetricObservations([
    {importId: newImportId, releaseId, metricDate, spotifyTrackId: "spotify-track-test", streams: 31, listeners: 11, saves: 3, playlistAdds: 2}
  ]);
  await appendSongPeriodSnapshots([
    {importId: newImportId, releaseId, periodStart, periodEnd, exportedTitle: "Export title", exportedReleaseDate: new Date("2026-06-01T00:00:00Z"), listeners: 20, streams: 40, saves: 5}
  ]);
  await appendPlaylistPeriodSnapshots([
    {importId: newImportId, playlistTitle: "Playlist", playlistAuthor: "Curator", playlistSpotifyId: "playlist-test", periodStart, periodEnd, listeners: 8, streams: 12}
  ]);

  await assert.rejects(
    appendArtistMetricObservations([{importId: oldImportId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate, listeners: 1, monthlyListeners: 1, monthlyActiveListeners: 1, streams: 1, playlistAdds: 1, saves: 1, followers: 1}]),
    /Unique constraint/
  );
  await assert.rejects(
    createAnalyticsImport({importType: "AUDIENCE_TIMELINE", originalFilename: "bad.csv", fileHash: "not-a-hash", artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, uploadedAt: now}),
    /SHA-256/
  );

  const oldAccepted = await acceptAnalyticsImport(oldImportId, new Date("2026-07-01T13:00:00Z"));
  const newAccepted = await acceptAnalyticsImport(newImportId, new Date("2026-07-02T13:00:00Z"));
  await acceptAnalyticsImport(withdrawnImportId, new Date("2026-07-03T13:00:00Z"));
  assert.equal(oldAccepted.rawFileExpiresAt?.toISOString(), "2026-07-31T13:00:00.000Z");
  assert.equal(newAccepted.rawFileExpiresAt?.toISOString(), "2026-08-01T13:00:00.000Z");
  assert.equal((await findAnalyticsImportByHash(hash("1")))?.id, newImportId);

  await replaceAnalyticsImport(oldImportId, newImportId);
  let current = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  assert.equal(current.artistMetricObservations[0]?.importId, withdrawnImportId, "newest overlapping import wins deterministically");
  await withdrawAnalyticsImport(withdrawnImportId, "Deterministic withdrawal test");
  current = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  assert.equal(current.artistMetricObservations[0]?.importId, newImportId, "withdrawn observations remain stored but are excluded from current data");
  assert.equal(await prisma.artistMetricObservation.count({where: {importId: withdrawnImportId}}), 1);

  await expectForeignKeyRestriction(() => prisma.analyticsImport.delete({where: {id: newImportId}}), "import deletion");
  await expectForeignKeyRestriction(() => prisma.release.delete({where: {id: releaseId}}), "release deletion");
  await expectForeignKeyRestriction(() => prisma.artistProfile.delete({where: {id: CANONICAL_ANALYTICS_ARTIST_ID}}), "artist deletion");

  // Release has no archive field; its established disable operation is to unpublish it.
  await prisma.release.update({where: {id: releaseId}, data: {published: false, isPublished: false}});
  assert.equal(await prisma.trackMetricObservation.count({where: {releaseId}}), 1);
  assert.equal(await prisma.songPeriodSnapshot.count({where: {releaseId}}), 1);

  await prisma.artistProfile.update({where: {id: CANONICAL_ANALYTICS_ARTIST_ID}, data: {workflowStatus: "ARCHIVED", archivedAt: new Date()}});
  assert.equal(await prisma.artistMetricObservation.count({where: {artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, importId: {in: importIds}}}), 3);
  await prisma.artistProfile.update({where: {id: CANONICAL_ANALYTICS_ARTIST_ID}, data: {workflowStatus: "DRAFT", archivedAt: null}});

  const artifact = await createDatabaseSnapshotArtifact();
  const snapshot = JSON.parse(gunzipSync(artifact.buffer).toString("utf8"));
  assert.equal(snapshot.schemaVersion, 12);
  assert.ok(snapshot.analyticsImports.some((row: {id: string}) => row.id === newImportId));
  assert.ok(snapshot.artistMetricObservations.some((row: {importId: string}) => row.importId === newImportId));
  assert.ok(snapshot.trackMetricObservations.some((row: {importId: string}) => row.importId === newImportId));
  assert.ok(snapshot.songPeriodSnapshots.some((row: {importId: string}) => row.importId === newImportId));
  assert.ok(snapshot.playlistPeriodSnapshots.some((row: {importId: string}) => row.importId === newImportId));
  assert.equal("rawFileContents" in snapshot.analyticsImports.find((row: {id: string}) => row.id === newImportId), false);

  console.log("Analytics data foundation tests passed.");
}

void main()
  .finally(cleanup)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
