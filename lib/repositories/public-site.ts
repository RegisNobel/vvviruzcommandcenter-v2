import type {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {toDateInputValue} from "@/lib/db/serialization";
import type {PublicReleaseRecord, ReleaseType, SiteSettingsRecord} from "@/lib/types";

import {readSiteSettings} from "@/lib/repositories/site-settings";

type PublicReleaseModel = Prisma.ReleaseGetPayload<{
  select: {
    id: true;
    slug: true;
    title: true;
    collaborator: true;
    collaboratorName: true;
    releaseDate: true;
    type: true;
    coverArtPath: true;
    coverArtUrl: true;
    lyrics: true;
    publicDescription: true;
    publicLongDescription: true;
    spotifyUrl: true;
    appleMusicUrl: true;
    youtubeUrl: true;
    isPublished: true;
    isFeatured: true;
    featuredVideoUrl: true;
    publicLyricsEnabled: true;
    createdOn: true;
    updatedOn: true;
  };
}>;

const newestPublicReleaseOrder = [
  {releaseDate: {sort: "desc", nulls: "last"}},
  {updatedOn: "desc"},
  {title: "asc"}
] satisfies Prisma.ReleaseOrderByWithRelationInput[];

const publicReleaseSelect = {
  id: true,
  slug: true,
  title: true,
  collaborator: true,
  collaboratorName: true,
  releaseDate: true,
  type: true,
  coverArtPath: true,
  coverArtUrl: true,
  lyrics: true,
  publicDescription: true,
  publicLongDescription: true,
  spotifyUrl: true,
  appleMusicUrl: true,
  youtubeUrl: true,
  isPublished: true,
  isFeatured: true,
  featuredVideoUrl: true,
  publicLyricsEnabled: true,
  createdOn: true,
  updatedOn: true
} satisfies Prisma.ReleaseSelect;

function toPublicRelease(release: PublicReleaseModel): PublicReleaseRecord {
  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    collaborator: release.collaborator,
    collaborator_name: release.collaboratorName,
    release_date: toDateInputValue(release.releaseDate),
    type: release.type as ReleaseType,
    cover_art_path: release.coverArtPath || release.coverArtUrl || "",
    public_description: release.publicDescription || release.title,
    public_long_description: release.publicLongDescription,
    spotify_url: release.spotifyUrl,
    apple_music_url: release.appleMusicUrl,
    youtube_url: release.youtubeUrl,
    is_published: release.isPublished,
    is_featured: release.isFeatured,
    featured_video_url: release.featuredVideoUrl,
    public_lyrics_enabled: release.publicLyricsEnabled,
    lyrics: release.lyrics,
    created_on: release.createdOn.toISOString(),
    updated_on: release.updatedOn.toISOString()
  };
}

export async function getSiteSettings(): Promise<SiteSettingsRecord> {
  return readSiteSettings();
}

export async function getFeaturedRelease() {
  const release = await prisma.release.findFirst({
    where: {
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: [{isFeatured: "desc"}, ...newestPublicReleaseOrder]
  });

  return release ? toPublicRelease(release) : null;
}

export async function getLinksPageRelease(selectedReleaseId: string) {
  const normalizedId = selectedReleaseId.trim();

  if (normalizedId) {
    const selectedRelease = await prisma.release.findFirst({
      where: {
        id: normalizedId,
        isPublished: true
      },
      select: publicReleaseSelect
    });

    if (selectedRelease) {
      return toPublicRelease(selectedRelease);
    }
  }

  return getFeaturedRelease();
}

export async function getPublishedFeaturedReleasesByIds(releaseIds: string[]) {
  const normalizedIds = releaseIds.map((value) => value.trim()).filter(Boolean).slice(0, 3);

  if (normalizedIds.length === 0) {
    return [];
  }

  const releases = await prisma.release.findMany({
    where: {
      id: {
        in: normalizedIds
      },
      isPublished: true
    },
    select: publicReleaseSelect
  });

  const releasesById = new Map(releases.map((release) => [release.id, toPublicRelease(release)]));

  return normalizedIds
    .map((releaseId) => releasesById.get(releaseId))
    .filter((release): release is PublicReleaseRecord => Boolean(release));
}

function shuffleItems<T>(items: T[]) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = clone[index];

    clone[index] = clone[randomIndex];
    clone[randomIndex] = current;
  }

  return clone;
}

export async function getHomepageFeaturedReleases(selectedReleaseIds: string[]) {
  const selected = await getPublishedFeaturedReleasesByIds(selectedReleaseIds);

  if (selected.length >= 3) {
    return selected.slice(0, 3);
  }

  const selectedIds = new Set(selected.map((release) => release.id));
  const extraPool = await prisma.release.findMany({
    where: {
      isPublished: true,
      ...(selectedIds.size > 0
        ? {
            id: {
              notIn: Array.from(selectedIds)
            }
          }
        : {})
    },
    select: publicReleaseSelect
  });
  const randomExtras = shuffleItems(extraPool)
    .slice(0, Math.max(0, 3 - selected.length))
    .map(toPublicRelease);

  return [...selected, ...randomExtras].slice(0, 3);
}

export async function getPublishedReleases(options?: {
  limit?: number;
  type?: ReleaseType | "all";
}) {
  const releases = await prisma.release.findMany({
    where: {
      isPublished: true,
      ...(options?.type && options.type !== "all" ? {type: options.type} : {})
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder,
    ...(options?.limit ? {take: options.limit} : {})
  });

  return releases.map(toPublicRelease);
}

export async function getPublishedReleaseBySlug(slug: string) {
  const release = await prisma.release.findFirst({
    where: {
      slug,
      isPublished: true
    },
    select: publicReleaseSelect
  });

  return release ? toPublicRelease(release) : null;
}

export async function getRelatedPublishedReleases(releaseId: string, type: ReleaseType) {
  const sameType = await prisma.release.findMany({
    where: {
      id: {
        not: releaseId
      },
      type,
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder,
    take: 3
  });

  if (sameType.length >= 3) {
    return sameType.map(toPublicRelease);
  }

  const fallback = await prisma.release.findMany({
    where: {
      id: {
        notIn: [releaseId, ...sameType.map((release) => release.id)]
      },
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder,
    take: 3 - sameType.length
  });

  return [...sameType, ...fallback].map(toPublicRelease);
}

export async function getPublishedReleaseSlugs() {
  return prisma.release.findMany({
    where: {
      isPublished: true
    },
    select: {
      slug: true
    }
  });
}

export async function canPubliclyReadCoverAsset(fileName: string) {
  const release = await prisma.release.findFirst({
    where: {
      isPublished: true,
      OR: [
        {coverArtId: fileName},
        {coverArtFileName: fileName},
        {coverArtPath: {endsWith: `/${fileName}`}},
        {coverArtUrl: {endsWith: `/${fileName}`}}
      ]
    },
    select: {
      id: true
    }
  });

  return Boolean(release);
}




