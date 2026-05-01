import type {Prisma} from "@prisma/client";
import {unstable_cache} from "next/cache";
import {prisma} from "@/lib/db/prisma";
import type {AppearsOnRecord} from "@/lib/types";
import {createId} from "@/lib/utils";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";

type AppearsOnModel = Prisma.AppearsOnGetPayload<{}>;

function toAppearsOnRecord(record: AppearsOnModel): AppearsOnRecord {
  return {
    id: record.id,
    title: record.title,
    artists: record.artists,
    cover_art_url: record.coverArtUrl,
    spotify_url: record.spotifyUrl,
    apple_music_url: record.appleMusicUrl,
    youtube_music_url: record.youtubeMusicUrl,
    youtube_url: record.youtubeUrl,
    is_published: record.isPublished,
    sort_order: record.sortOrder,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString()
  };
}

export async function readAllAppearsOn(): Promise<AppearsOnRecord[]> {
  const records = await prisma.appearsOn.findMany({
    orderBy: [
      {sortOrder: "asc"},
      {createdAt: "desc"}
    ]
  });

  return records.map(toAppearsOnRecord);
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

  await prisma.appearsOn.upsert({
    where: {id},
    create: {
      id,
      title: record.title,
      artists: record.artists,
      coverArtUrl: record.cover_art_url,
      spotifyUrl: record.spotify_url,
      appleMusicUrl: record.apple_music_url,
      youtubeMusicUrl: record.youtube_music_url,
      youtubeUrl: record.youtube_url,
      isPublished: record.is_published,
      sortOrder: record.sort_order,
      createdAt: now,
      updatedAt: now
    },
    update: {
      title: record.title,
      artists: record.artists,
      coverArtUrl: record.cover_art_url,
      spotifyUrl: record.spotify_url,
      appleMusicUrl: record.apple_music_url,
      youtubeMusicUrl: record.youtube_music_url,
      youtubeUrl: record.youtube_url,
      isPublished: record.is_published,
      sortOrder: record.sort_order,
      updatedAt: now
    }
  });

  return id;
}

export async function deleteAppearsOn(id: string) {
  await prisma.appearsOn.delete({
    where: {id}
  });
}

const getCachedPublicAppearsOn = unstable_cache(
  async () => {
    const records = await prisma.appearsOn.findMany({
      where: {isPublished: true},
      orderBy: [
        {sortOrder: "asc"},
        {createdAt: "desc"}
      ]
    });
    return records.map(toAppearsOnRecord);
  },
  ["public-appears-on"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublicAppearsOn() {
  return getCachedPublicAppearsOn();
}
