import type {Prisma} from "@prisma/client";
import {unstable_cache} from "next/cache";
import {prisma} from "@/lib/db/prisma";
import type {AppearsOnRecord} from "@/lib/types";
import {createId} from "@/lib/utils";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {getBlobOrigin, rewriteAssetUrlToBlob} from "@/lib/server/blob-origin";

type AppearsOnModel = Prisma.AppearsOnGetPayload<{}>;
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function safeHttpUrl(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) return "";

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${field} must be a valid web address.`);
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${field} must be a safe http or https URL without credentials.`);
  }
  return parsed.toString();
}

function optionalDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Release date is invalid.");
  }
  return parsed;
}

async function toAppearsOnRecord(record: AppearsOnModel): Promise<AppearsOnRecord> {
  const blobOrigin = await getBlobOrigin();
  return {
    id: record.id,
    title: record.title,
    artists: record.artists,
    cover_art_url: rewriteAssetUrlToBlob(record.coverArtUrl, blobOrigin),
    spotify_url: record.spotifyUrl,
    apple_music_url: record.appleMusicUrl,
    youtube_music_url: record.youtubeMusicUrl,
    youtube_url: record.youtubeUrl,
    release_date: record.releaseDate?.toISOString().slice(0, 10) || null,
    is_published: record.isPublished,
    archived_at: record.archivedAt?.toISOString() || null,
    sort_order: record.sortOrder,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString()
  };
}

export async function readAllAppearsOn(): Promise<AppearsOnRecord[]> {
  const records = await prisma.appearsOn.findMany({
    orderBy: [
      {archivedAt: "asc"},
      {sortOrder: "asc"},
      {releaseDate: "desc"},
      {createdAt: "desc"}
    ]
  });

  return Promise.all(records.map(toAppearsOnRecord));
}

export async function readAppearsOn(id: string): Promise<AppearsOnRecord | null> {
  const record = await prisma.appearsOn.findUnique({
    where: {id}
  });

  return record ? toAppearsOnRecord(record) : null;
}

export async function saveAppearsOn(record: Omit<AppearsOnRecord, "created_at" | "updated_at"> & {id?: string}) {
  const id = record.id || createId();
  const now = new Date();
  const title = record.title.trim();
  const artists = record.artists.trim();
  const coverArtUrl = safeHttpUrl(record.cover_art_url, "Cover art URL");
  const spotifyUrl = safeHttpUrl(record.spotify_url, "Spotify URL");
  const appleMusicUrl = safeHttpUrl(record.apple_music_url, "Apple Music URL");
  const youtubeMusicUrl = safeHttpUrl(record.youtube_music_url, "YouTube Music URL");
  const youtubeUrl = safeHttpUrl(record.youtube_url, "YouTube URL");
  const releaseDate = optionalDate(record.release_date);
  const isPublished = Boolean(record.is_published) && !record.archived_at;

  if (!title) throw new Error("Track title is required.");
  if (!artists) throw new Error("Artist credit is required.");
  if (isPublished && (!coverArtUrl || !spotifyUrl)) {
    throw new Error(
      "Published Appears On entries need resolved cover art and a Spotify URL."
    );
  }

  await prisma.appearsOn.upsert({
    where: {id},
    create: {
      id,
      title,
      artists,
      coverArtUrl,
      spotifyUrl,
      appleMusicUrl,
      youtubeMusicUrl,
      youtubeUrl,
      releaseDate,
      isPublished,
      archivedAt: null,
      sortOrder: record.sort_order,
      createdAt: now,
      updatedAt: now
    },
    update: {
      title,
      artists,
      coverArtUrl,
      spotifyUrl,
      appleMusicUrl,
      youtubeMusicUrl,
      youtubeUrl,
      releaseDate,
      isPublished,
      sortOrder: record.sort_order,
      updatedAt: now
    }
  });

  return id;
}

export async function setAppearsOnArchived(id: string, archived: boolean) {
  return prisma.appearsOn.update({
    where: {id},
    data: {
      archivedAt: archived ? new Date() : null,
      isPublished: false,
      updatedAt: new Date()
    }
  });
}

export async function deleteAppearsOn(id: string) {
  await prisma.appearsOn.delete({
    where: {id}
  });
}

const getCachedPublicAppearsOn = unstable_cache(
  async () => {
    const records = await prisma.appearsOn.findMany({
      where: {isPublished: true, archivedAt: null},
      orderBy: [
        {sortOrder: "asc"},
        {releaseDate: "desc"},
        {createdAt: "desc"}
      ]
    });
    return Promise.all(records.map(toAppearsOnRecord));
  },
  ["public-appears-on"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublicAppearsOn() {
  return getCachedPublicAppearsOn();
}
