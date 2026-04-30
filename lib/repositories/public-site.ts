import type {Prisma} from "@prisma/client";
import {unstable_cache} from "next/cache";

import {prisma} from "@/lib/db/prisma";
import {toDateInputValue} from "@/lib/db/serialization";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import type {PublicReleaseRecord, ReleaseType, SiteSettingsRecord} from "@/lib/types";

import {listPublicReleaseCategories} from "@/lib/repositories/release-categories";
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
    categories: {
      select: {
        category: {
          select: {
            id: true;
            name: true;
            slug: true;
            description: true;
          };
        };
      };
      orderBy: [{sortOrder: "asc"}];
    };
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
  updatedOn: true,
  categories: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true
        }
      }
    },
    orderBy: [{sortOrder: "asc"}]
  }
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
    categories: release.categories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      slug: assignment.category.slug,
      description: assignment.category.description,
      release_count: 0
    })),
    created_on: release.createdOn.toISOString(),
    updated_on: release.updatedOn.toISOString()
  };
}

export async function getSiteSettings(): Promise<SiteSettingsRecord> {
  return getCachedSiteSettings();
}

const getCachedSiteSettings = unstable_cache(
  async () => readSiteSettings(),
  ["public-site-settings"],
  {
    tags: [PUBLIC_CACHE_TAGS.siteSettings]
  }
);

const getCachedFeaturedRelease = unstable_cache(
  async () => {
  const release = await prisma.release.findFirst({
    where: {
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: [{isFeatured: "desc"}, ...newestPublicReleaseOrder]
  });

  return release ? toPublicRelease(release) : null;
  },
  ["public-featured-release"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getFeaturedRelease() {
  return getCachedFeaturedRelease();
}

const getCachedLinksPageRelease = unstable_cache(
  async (selectedReleaseId: string) => {
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

  return getCachedFeaturedRelease();
  },
  ["public-links-page-release"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getLinksPageRelease(selectedReleaseId: string) {
  return getCachedLinksPageRelease(selectedReleaseId.trim());
}

const getCachedPublishedFeaturedReleasesByIds = unstable_cache(
  async (releaseIdsKey: string) => {
  const normalizedIds = releaseIdsKey.split("|").filter(Boolean).slice(0, 3);

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
  },
  ["public-featured-releases-by-id"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublishedFeaturedReleasesByIds(releaseIds: string[]) {
  const releaseIdsKey = releaseIds.map((value) => value.trim()).filter(Boolean).slice(0, 3).join("|");

  return getCachedPublishedFeaturedReleasesByIds(releaseIdsKey);
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

const getCachedHomepageFeaturedReleases = unstable_cache(
  async (selectedReleaseIdsKey: string) => {
  const selected = await getCachedPublishedFeaturedReleasesByIds(selectedReleaseIdsKey);

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
  },
  ["public-homepage-featured-releases"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getHomepageFeaturedReleases(selectedReleaseIds: string[]) {
  const selectedReleaseIdsKey = selectedReleaseIds
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("|");

  return getCachedHomepageFeaturedReleases(selectedReleaseIdsKey);
}

const getCachedPublishedReleases = unstable_cache(
  async (
    normalizedCategorySlug: string,
    type: ReleaseType | "all",
    limit: number
  ) => {
  const releases = await prisma.release.findMany({
    where: {
      isPublished: true,
      ...(normalizedCategorySlug
        ? {
            categories: {
              some: {
                category: {
                  slug: normalizedCategorySlug
                }
              }
            }
          }
        : type !== "all"
          ? {type}
          : {})
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder,
    ...(limit > 0 ? {take: limit} : {})
  });

  return releases.map(toPublicRelease);
  },
  ["public-published-releases"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases, PUBLIC_CACHE_TAGS.releaseCategories]
  }
);

export async function getPublishedReleases(options?: {
  categorySlug?: string;
  limit?: number;
  type?: ReleaseType | "all";
}) {
  const normalizedCategorySlug = options?.categorySlug?.trim();
  const type = options?.type ?? "all";
  const limit = options?.limit ?? 0;

  return getCachedPublishedReleases(normalizedCategorySlug || "", type, limit);
}

const getCachedPublicReleaseCategories = unstable_cache(
  async () => listPublicReleaseCategories(),
  ["public-release-categories"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases, PUBLIC_CACHE_TAGS.releaseCategories]
  }
);

export async function getPublicReleaseCategories() {
  return getCachedPublicReleaseCategories();
}

const getCachedPublishedReleaseBySlug = unstable_cache(
  async (slug: string) => {
  const release = await prisma.release.findFirst({
    where: {
      slug,
      isPublished: true
    },
    select: publicReleaseSelect
  });

  return release ? toPublicRelease(release) : null;
  },
  ["public-release-by-slug"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublishedReleaseBySlug(slug: string) {
  return getCachedPublishedReleaseBySlug(slug);
}

const getCachedRelatedPublishedReleases = unstable_cache(
  async (releaseId: string, type: ReleaseType) => {
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
  },
  ["public-related-releases"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getRelatedPublishedReleases(releaseId: string, type: ReleaseType) {
  return getCachedRelatedPublishedReleases(releaseId, type);
}

const getCachedPublishedReleaseSlugs = unstable_cache(
  async () => prisma.release.findMany({
    where: {
      isPublished: true
    },
    select: {
      slug: true
    }
  }),
  ["public-release-slugs"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublishedReleaseSlugs() {
  return getCachedPublishedReleaseSlugs();
}

const getCachedCanPubliclyReadCoverAsset = unstable_cache(
  async (fileName: string) => {
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
  },
  ["public-readable-cover-asset"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function canPubliclyReadCoverAsset(fileName: string) {
  return getCachedCanPubliclyReadCoverAsset(fileName);
}




