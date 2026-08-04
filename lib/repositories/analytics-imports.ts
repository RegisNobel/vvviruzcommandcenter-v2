import {Prisma, type PrismaClient} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";

export {CURRENT_OBSERVATION_RESOLUTION_VERSION} from "@/lib/analytics/analytics-resolution-version";

export const CANONICAL_ANALYTICS_ARTIST_ID = "artist-profile-vvviruz";
export const RAW_ANALYTICS_FILE_RETENTION_DAYS = 30;

export function getRawAnalyticsFileRetentionDays() {
  const configured = Number(process.env.ANALYTICS_RAW_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 365
    ? configured
    : RAW_ANALYTICS_FILE_RETENTION_DAYS;
}
export const ANALYTICS_IMPORT_STATUSES = [
  "PENDING",
  "PREVIEWED",
  "IMPORTED",
  "FAILED",
  "WITHDRAWN",
  "REPLACED"
] as const;

type AnalyticsImportStatus = (typeof ANALYTICS_IMPORT_STATUSES)[number];
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const currentImportWhere = {
  status: "IMPORTED",
  acceptedAt: {not: null},
  withdrawnAt: null,
  replacedByImportId: null
} satisfies Prisma.AnalyticsImportWhereInput;

const newestImportFirst = [
  {acceptedAt: "desc"},
  {createdAt: "desc"},
  {id: "desc"}
] satisfies Prisma.AnalyticsImportOrderByWithRelationInput[];

function assertSha256(fileHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(fileHash)) {
    throw new Error("Analytics import fileHash must be a 64-character SHA-256 hex digest.");
  }
}

function assertNonnegative(values: Record<string, number | null | undefined>) {
  for (const [field, value] of Object.entries(values)) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${field} must be a nonnegative integer.`);
    }
  }
}

function rawFileExpiresAt(acceptedAt: Date, hasRawFile: boolean) {
  if (!hasRawFile) return null;
  return new Date(
    acceptedAt.getTime() + getRawAnalyticsFileRetentionDays() * 24 * 60 * 60 * 1000
  );
}

export async function readCanonicalAnalyticsArtist(db: DatabaseClient = prisma) {
  const artist = await db.artistProfile.findUnique({
    where: {id: CANONICAL_ANALYTICS_ARTIST_ID}
  });

  if (
    !artist ||
    artist.slug !== "vvviruz" ||
    artist.displayName !== "vvviruz" ||
    artist.publishedAt !== null ||
    artist.publishedVersionId !== null ||
    artist.workflowStatus !== "DRAFT"
  ) {
    throw new Error("The canonical vvviruz analytics artist is missing or is not private and unpublished.");
  }

  return artist;
}

export async function createAnalyticsImport(
  data: Omit<Prisma.AnalyticsImportUncheckedCreateInput, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
  db: DatabaseClient = prisma
) {
  assertSha256(data.fileHash);
  assertNonnegative({
    rowCount: data.rowCount,
    acceptedRowCount: data.acceptedRowCount,
    rejectedRowCount: data.rejectedRowCount,
    unmatchedRowCount: data.unmatchedRowCount,
    warningCount: data.warningCount,
    rawFileSizeBytes: data.rawFileSizeBytes
  });

  const now = new Date();
  return db.analyticsImport.create({
    data: {id: data.id ?? createId(), createdAt: now, updatedAt: now, ...data}
  });
}

export async function appendArtistMetricObservations(
  rows: Array<Omit<Prisma.ArtistMetricObservationUncheckedCreateInput, "id" | "createdAt"> & {id?: string}>,
  db: DatabaseClient = prisma
) {
  const now = new Date();
  for (const row of rows) {
    assertNonnegative({
      listeners: row.listeners,
      monthlyListeners: row.monthlyListeners,
      monthlyActiveListeners: row.monthlyActiveListeners,
      streams: row.streams,
      playlistAdds: row.playlistAdds,
      saves: row.saves,
      followers: row.followers
    });
  }
  return db.artistMetricObservation.createMany({
    data: rows.map((row) => ({id: row.id ?? createId(), createdAt: now, ...row}))
  });
}

export async function appendTrackMetricObservations(
  rows: Array<Omit<Prisma.TrackMetricObservationUncheckedCreateInput, "id" | "createdAt"> & {id?: string}>,
  db: DatabaseClient = prisma
) {
  const now = new Date();
  for (const row of rows) {
    assertNonnegative({streams: row.streams, listeners: row.listeners, saves: row.saves, playlistAdds: row.playlistAdds});
  }
  return db.trackMetricObservation.createMany({
    data: rows.map((row) => ({id: row.id ?? createId(), createdAt: now, ...row}))
  });
}

export async function appendSongPeriodSnapshots(
  rows: Array<Omit<Prisma.SongPeriodSnapshotUncheckedCreateInput, "id" | "createdAt"> & {id?: string}>,
  db: DatabaseClient = prisma
) {
  const now = new Date();
  for (const row of rows) {
    if (row.periodEnd < row.periodStart) throw new Error("Song snapshot periodEnd must not precede periodStart.");
    assertNonnegative({listeners: row.listeners, streams: row.streams, saves: row.saves});
  }
  return db.songPeriodSnapshot.createMany({
    data: rows.map((row) => ({id: row.id ?? createId(), createdAt: now, ...row}))
  });
}

export async function appendPlaylistPeriodSnapshots(
  rows: Array<Omit<Prisma.PlaylistPeriodSnapshotUncheckedCreateInput, "id" | "createdAt"> & {id?: string}>,
  db: DatabaseClient = prisma
) {
  const now = new Date();
  for (const row of rows) {
    if (row.periodEnd < row.periodStart) throw new Error("Playlist snapshot periodEnd must not precede periodStart.");
    assertNonnegative({listeners: row.listeners, streams: row.streams});
  }
  return db.playlistPeriodSnapshot.createMany({
    data: rows.map((row) => ({id: row.id ?? createId(), createdAt: now, ...row}))
  });
}

export async function acceptAnalyticsImport(importId: string, acceptedAt = new Date()) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.analyticsImport.findUniqueOrThrow({where: {id: importId}});
    if (current.status !== "PENDING" && current.status !== "PREVIEWED") {
      throw new Error(`Only pending or previewed imports can be accepted; found ${current.status}.`);
    }
    return tx.analyticsImport.update({
      where: {id: importId},
      data: {
        status: "IMPORTED",
        acceptedAt,
        rawFileExpiresAt: rawFileExpiresAt(acceptedAt, Boolean(current.rawFileStorageKey)),
        updatedAt: new Date()
      }
    });
  });
}

export async function withdrawAnalyticsImport(
  importId: string,
  reason: string,
  withdrawnById?: string,
  withdrawnAt = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.analyticsImport.findUniqueOrThrow({where: {id: importId}});
    if (current.status !== "IMPORTED") throw new Error("Only a current imported dataset can be withdrawn.");
    return tx.analyticsImport.update({
      where: {id: importId},
      data: {status: "WITHDRAWN", withdrawnAt, withdrawnById, withdrawalReason: reason, updatedAt: new Date()}
    });
  });
}

export async function replaceAnalyticsImport(replacedImportId: string, replacementImportId: string) {
  return prisma.$transaction(async (tx) => {
    const [oldImport, replacement] = await Promise.all([
      tx.analyticsImport.findUniqueOrThrow({where: {id: replacedImportId}}),
      tx.analyticsImport.findUniqueOrThrow({where: {id: replacementImportId}})
    ]);
    if (oldImport.status !== "IMPORTED" || replacement.status !== "IMPORTED") {
      throw new Error("Both imports must be accepted before a replacement can be recorded.");
    }
    if (
      oldImport.artistProfileId !== replacement.artistProfileId ||
      oldImport.source !== replacement.source ||
      oldImport.importType !== replacement.importType
    ) {
      throw new Error("Replacement imports must have the same artist, source, and import type.");
    }
    return tx.analyticsImport.update({
      where: {id: replacedImportId},
      data: {status: "REPLACED", replacedByImportId: replacementImportId, updatedAt: new Date()}
    });
  });
}

export function findAnalyticsImportByHash(fileHash: string) {
  assertSha256(fileHash);
  return prisma.analyticsImport.findUnique({where: {fileHash}});
}

export async function listCurrentAnalyticsImports(
  artistProfileId: string,
  importType?: string
) {
  return prisma.analyticsImport.findMany({
    where: {...currentImportWhere, artistProfileId, ...(importType ? {importType} : {})},
    orderBy: newestImportFirst
  });
}

function newestByKey<T extends {importId: string}>(
  rows: T[],
  importRank: Map<string, number>,
  key: (row: T) => string
) {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => (importRank.get(a.importId) ?? Number.MAX_SAFE_INTEGER) - (importRank.get(b.importId) ?? Number.MAX_SAFE_INTEGER))
    .filter((row) => {
      const resolvedKey = key(row);
      if (seen.has(resolvedKey)) return false;
      seen.add(resolvedKey);
      return true;
    });
}

export async function readCurrentAnalyticsDataset(artistProfileId: string) {
  const imports = await listCurrentAnalyticsImports(artistProfileId);
  const importIds = imports.map(({id}) => id);
  const rank = new Map(importIds.map((id, index) => [id, index]));
  const [artistRows, trackRows, songRows, playlistRows] = await Promise.all([
    prisma.artistMetricObservation.findMany({where: {importId: {in: importIds}}}),
    prisma.trackMetricObservation.findMany({where: {importId: {in: importIds}}}),
    prisma.songPeriodSnapshot.findMany({
      where: {importId: {in: importIds}},
      include: {mappingRow: {select: {mappingStatus: true, confirmedReleaseId: true}}}
    }),
    prisma.playlistPeriodSnapshot.findMany({where: {importId: {in: importIds}}})
  ]);
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const resolvedSongRows = songRows.flatMap(({mappingRow, ...row}) => {
    if (mappingRow && (mappingRow.mappingStatus !== "CONFIRMED" || !mappingRow.confirmedReleaseId)) {
      return [];
    }
    return [{...row, releaseId: mappingRow?.confirmedReleaseId ?? row.releaseId}];
  });
  return {
    imports,
    artistMetricObservations: newestByKey(artistRows, rank, (row) => `${row.artistProfileId}:${day(row.metricDate)}`),
    trackMetricObservations: newestByKey(trackRows, rank, (row) => `${row.releaseId}:${day(row.metricDate)}`),
    songPeriodSnapshots: newestByKey(resolvedSongRows, rank, (row) => `${row.releaseId}:${day(row.periodStart)}:${day(row.periodEnd)}`),
    playlistPeriodSnapshots: newestByKey(playlistRows, rank, (row) => `${row.playlistSpotifyId ?? `${row.playlistTitle}:${row.playlistAuthor}`}:${day(row.periodStart)}:${day(row.periodEnd)}`)
  };
}

export function isAnalyticsImportStatus(value: string): value is AnalyticsImportStatus {
  return ANALYTICS_IMPORT_STATUSES.includes(value as AnalyticsImportStatus);
}
