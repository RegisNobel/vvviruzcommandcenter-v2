import type {Prisma} from "@prisma/client";
import {unstable_cache} from "next/cache";

import {prisma} from "@/lib/db/prisma";
import {toDateInputValue} from "@/lib/db/serialization";
import {HOMEPAGE_PROJECT_LIMIT} from "@/lib/homepage-brand";
import {
  evaluatePublicProjectEligibility,
  normalizeApprovedPublicProjectSlugs,
  type PublicProjectRecord
} from "@/lib/public-projects";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import type {PublicReleaseRecord, ReleaseType, SiteSettingsRecord} from "@/lib/types";
import {parseStoredReleaseContext} from "@/lib/release-context";

import {listPublicReleaseCategories} from "@/lib/repositories/release-categories";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import {getBlobOrigin, rewriteAssetUrlToBlob} from "@/lib/server/blob-origin";

type PublicReleaseModel = Prisma.ReleaseGetPayload<{
  select: {
    id: true;
    slug: true;
    title: true;
    catalogScope: true;
    primaryArtistProfileId: true;
    collaborator: true;
    collaboratorName: true;
    artistCredits: {
      select: {
        artistProfile: {
          select: {
            displayName: true;
            slug: true;
            workflowStatus: true;
            publishedVersionId: true;
          };
        };
      };
      orderBy: [{displayOrder: "asc"}];
    };
    releaseDate: true;
    type: true;
    coverArtPath: true;
    coverArtUrl: true;
    lyrics: true;
    publicDescription: true;
    publicLongDescription: true;
    languages: true;
    genres: true;
    moods: true;
    inspirationContext: true;
    themes: true;
    listenerContexts: true;
    seoTitle: true;
    metaDescription: true;
    coverArtAltText: true;
    socialShareTitle: true;
    socialShareDescription: true;
    contextualCtaLabel: true;
    contextualCtaUrl: true;
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
            projectType: true;
            artworkPath: true;
            artworkAltText: true;
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
  catalogScope: true,
  primaryArtistProfileId: true,
  collaborator: true,
  collaboratorName: true,
  artistCredits: {
    select: {
      artistProfile: {
        select: {
          displayName: true,
          slug: true,
          workflowStatus: true,
          publishedVersionId: true
        }
      }
    },
    orderBy: [{displayOrder: "asc"}]
  },
  releaseDate: true,
  type: true,
  coverArtPath: true,
  coverArtUrl: true,
  lyrics: true,
  publicDescription: true,
  publicLongDescription: true,
  languages: true,
  genres: true,
  moods: true,
  inspirationContext: true,
  themes: true,
  listenerContexts: true,
  seoTitle: true,
  metaDescription: true,
  coverArtAltText: true,
  socialShareTitle: true,
  socialShareDescription: true,
  contextualCtaLabel: true,
  contextualCtaUrl: true,
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
          description: true,
          projectType: true,
          artworkPath: true,
          artworkAltText: true
        }
      }
    },
    orderBy: [{sortOrder: "asc"}]
  }
} satisfies Prisma.ReleaseSelect;

const publicProjectReleaseSelect = {
  ...publicReleaseSelect,
  lyrics: false
} satisfies Prisma.ReleaseSelect;

type PublicProjectReleaseModel = Prisma.ReleaseGetPayload<{
  select: typeof publicProjectReleaseSelect;
}>;

async function toPublicRelease(release: PublicReleaseModel): Promise<PublicReleaseRecord> {
  const blobOrigin = await getBlobOrigin();
  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    catalog_scope: release.catalogScope === "ARTIST" ? "ARTIST" : "VVVIRUZ",
    primary_artist_profile_id: release.primaryArtistProfileId || "",
    collaborator: release.collaborator,
    collaborator_name: release.collaboratorName,
    collaborator_profiles: release.artistCredits
      .filter(
        (credit) =>
          credit.artistProfile.workflowStatus === "PUBLISHED" &&
          Boolean(credit.artistProfile.publishedVersionId)
      )
      .map((credit) => ({
        name: credit.artistProfile.displayName,
        slug: credit.artistProfile.slug
      })),
    release_date: toDateInputValue(release.releaseDate),
    type: release.type as ReleaseType,
    cover_art_path: rewriteAssetUrlToBlob(release.coverArtPath || release.coverArtUrl || "", blobOrigin),
    public_description: release.publicDescription || release.title,
    public_long_description: release.publicLongDescription || "",
    languages: parseStoredReleaseContext(release.languages),
    genres: parseStoredReleaseContext(release.genres),
    moods: parseStoredReleaseContext(release.moods),
    inspiration_context: release.inspirationContext || "",
    themes: parseStoredReleaseContext(release.themes),
    listener_contexts: parseStoredReleaseContext(release.listenerContexts),
    seo_title: release.seoTitle || "",
    meta_description: release.metaDescription || "",
    cover_art_alt_text: release.coverArtAltText || "",
    social_share_title: release.socialShareTitle || "",
    social_share_description: release.socialShareDescription || "",
    contextual_cta_label: release.contextualCtaLabel || "",
    contextual_cta_url: release.contextualCtaUrl || "",
    spotify_url: release.spotifyUrl || "",
    apple_music_url: release.appleMusicUrl || "",
    youtube_url: release.youtubeUrl || "",
    is_published: release.isPublished,
    is_featured: release.isFeatured,
    featured_video_url: release.featuredVideoUrl || "",
    public_lyrics_enabled: release.publicLyricsEnabled,
    lyrics: release.lyrics || "",
    categories: release.categories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      slug: assignment.category.slug,
      description: assignment.category.description,
      project_type: assignment.category.projectType as PublicReleaseRecord["categories"][number]["project_type"],
      artwork_path: rewriteAssetUrlToBlob(assignment.category.artworkPath, blobOrigin),
      artwork_alt_text: assignment.category.artworkAltText,
      release_count: 0
    })),
    created_on: release.createdOn.toISOString(),
    updated_on: release.updatedOn.toISOString()
  };
}

async function toPublicProjectRelease(
  release: PublicProjectReleaseModel
): Promise<PublicReleaseRecord> {
  return toPublicRelease({...release, lyrics: ""});
}

async function rewriteSiteSettingsUrls(settings: SiteSettingsRecord): Promise<SiteSettingsRecord> {
  const blobOrigin = await getBlobOrigin();
  const content = settings.site_content;
  return {
    ...settings,
    site_content: {
      ...content,
      chrome: {
        ...content.chrome,
        brand_mark_file: rewriteAssetUrlToBlob(content.chrome.brand_mark_file, blobOrigin)
      },
      about: {
        ...content.about,
        artist_image_file: rewriteAssetUrlToBlob(content.about.artist_image_file, blobOrigin)
      },
      home: {
        ...content.home,
        brand_pillars: content.home.brand_pillars.map((pillar) => ({
          ...pillar,
          imageFile: rewriteAssetUrlToBlob(pillar.imageFile, blobOrigin)
        }))
      },
      exclusive: {
        ...content.exclusive,
        exclusive_track_art_path: rewriteAssetUrlToBlob(content.exclusive.exclusive_track_art_path, blobOrigin)
      }
    }
  };
}

export async function getSiteSettings(): Promise<SiteSettingsRecord> {
  return getCachedSiteSettings();
}

const getCachedSiteSettings = unstable_cache(
  async () => {
    const settings = await readSiteSettings();
    return rewriteSiteSettingsUrls(settings);
  },
  ["public-site-settings-v8"],
  {
    tags: [PUBLIC_CACHE_TAGS.siteSettings]
  }
);

const getCachedLinksPageRelease = unstable_cache(
  async (selectedReleaseId: string) => {
  const normalizedId = selectedReleaseId.trim();

  if (normalizedId) {
    const selectedRelease = await prisma.release.findFirst({
      where: {
        id: normalizedId,
        catalogScope: "VVVIRUZ",
        isPublished: true
      },
      select: publicReleaseSelect
    });

    if (selectedRelease) {
      return toPublicRelease(selectedRelease);
    }
  }

  const latestRelease = await prisma.release.findFirst({
    where: {
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder
  });

  if (latestRelease) {
    return toPublicRelease(latestRelease);
  }

  return null;
  },
  ["public-links-page-release"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getLinksPageRelease(selectedReleaseId: string) {
  return getCachedLinksPageRelease(selectedReleaseId.trim());
}

const getCachedPublishedReleasesByIds = unstable_cache(
  async (releaseIdsKey: string) => {
  const normalizedIds = releaseIdsKey.split("|").filter(Boolean).slice(0, 6);

  if (normalizedIds.length === 0) {
    return [];
  }

  const releases = await prisma.release.findMany({
    where: {
      id: {
        in: normalizedIds
      },
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: publicReleaseSelect
  });

  const mappedReleases = await Promise.all(releases.map((release) => toPublicRelease(release)));
  const releasesById = new Map(mappedReleases.map((release) => [release.id, release]));

  return normalizedIds
    .map((releaseId) => releasesById.get(releaseId))
    .filter((release): release is PublicReleaseRecord => Boolean(release));
  },
  ["public-releases-by-id"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

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

type PublicProjectModel = Prisma.ReleaseCategoryGetPayload<{
  select: {
    appleMusicUrl: true;
    artworkAltText: true;
    artworkPath: true;
    description: true;
    id: true;
    name: true;
    projectReleaseDate: true;
    projectType: true;
    slug: true;
    sortOrder: true;
    spotifyUrl: true;
    updatedAt: true;
    youtubeUrl: true;
    releases: {
      select: {
        sortOrder: true;
        release: {select: typeof publicProjectReleaseSelect};
      };
    };
  };
}>;

function compareProjectAssignments(
  left: PublicProjectModel["releases"][number],
  right: PublicProjectModel["releases"][number]
) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const leftDate = left.release.releaseDate?.getTime() ?? 0;
  const rightDate = right.release.releaseDate?.getTime() ?? 0;

  if (leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return left.release.slug.localeCompare(right.release.slug);
}

function selectRepresentativeAssignment(category: PublicProjectModel) {
  const orderedAssignments = [...category.releases].sort(compareProjectAssignments);
  return orderedAssignments[0];
}

async function toPublicProject(
  category: PublicProjectModel,
  approvedProjectSlugs: ReadonlySet<string>
): Promise<PublicProjectRecord | null> {
  const eligibility = evaluatePublicProjectEligibility({
    description: category.description,
    name: category.name,
    publicReleaseSlugs: category.releases.map((assignment) => assignment.release.slug),
    slug: category.slug
  }, approvedProjectSlugs);

  if (!eligibility.eligible) {
    return null;
  }

  const orderedAssignments = [...category.releases].sort(compareProjectAssignments);
  const representativeAssignment = selectRepresentativeAssignment(category);

  if (!representativeAssignment) {
    return null;
  }

  const releases = await Promise.all(
    orderedAssignments.map((assignment) => toPublicProjectRelease(assignment.release))
  );
  const blobOrigin = await getBlobOrigin();
  const latestRelease = [...releases].sort((left, right) => {
    const leftDate = left.release_date ? new Date(left.release_date).getTime() : 0;
    const rightDate = right.release_date ? new Date(right.release_date).getTime() : 0;

    return rightDate - leftDate || left.slug.localeCompare(right.slug);
  })[0];
  const updatedAt = [category.updatedAt, ...category.releases.map((item) => item.release.updatedOn)]
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return {
    appleMusicUrl: category.appleMusicUrl,
    artworkAltText: category.artworkAltText.trim(),
    artworkPath: rewriteAssetUrlToBlob(category.artworkPath.trim(), blobOrigin),
    description: category.description.trim(),
    id: category.id,
    latestRelease,
    name: category.name.trim(),
    projectReleaseDate: toDateInputValue(category.projectReleaseDate),
    projectType: category.projectType as PublicProjectRecord["projectType"],
    releaseCount: releases.length,
    releases,
    representativeRelease: await toPublicProjectRelease(representativeAssignment.release),
    slug: eligibility.slug,
    spotifyUrl: category.spotifyUrl,
    updatedAt: updatedAt.toISOString(),
    youtubeUrl: category.youtubeUrl
  };
}

const getCachedEligiblePublicProjects = unstable_cache(
  async (approvedProjectSlugsKey: string): Promise<PublicProjectRecord[]> => {
    const approvedProjectSlugs = normalizeApprovedPublicProjectSlugs(
      approvedProjectSlugsKey.split("|").filter(Boolean)
    );

    if (approvedProjectSlugs.length === 0) {
      return [];
    }

    const approvedProjectSlugSet = new Set(approvedProjectSlugs);
    const categories = await prisma.releaseCategory.findMany({
      where: {
        slug: {in: approvedProjectSlugs}
      },
      select: {
        appleMusicUrl: true,
        artworkAltText: true,
        artworkPath: true,
        description: true,
        id: true,
        name: true,
        projectReleaseDate: true,
        projectType: true,
        sortOrder: true,
        spotifyUrl: true,
        updatedAt: true,
        releases: {
          where: {
            release: {
              catalogScope: "VVVIRUZ",
              isPublished: true
            }
          },
          select: {
            sortOrder: true,
            release: {
              select: publicProjectReleaseSelect
            }
          },
          orderBy: [{sortOrder: "asc"}]
        },
        slug: true,
        youtubeUrl: true
      },
      orderBy: [{sortOrder: "asc"}, {name: "asc"}]
    });

    const projects = await Promise.all(
      categories.map((category) => toPublicProject(category, approvedProjectSlugSet))
    );
    const projectBySlug = new Map(
      projects
        .filter((project): project is PublicProjectRecord => Boolean(project))
        .map((project) => [project.slug, project])
    );

    return approvedProjectSlugs
      .map((slug) => projectBySlug.get(slug))
      .filter((project): project is PublicProjectRecord => Boolean(project));
  },
  ["eligible-public-projects-v3"],
  {
    tags: [
      PUBLIC_CACHE_TAGS.releases,
      PUBLIC_CACHE_TAGS.releaseCategories,
      PUBLIC_CACHE_TAGS.siteSettings
    ]
  }
);

export async function getEligiblePublicProjects() {
  const siteSettings = await getSiteSettings();
  const approvedProjectSlugs = normalizeApprovedPublicProjectSlugs(
    siteSettings.site_content.projects?.approved_slugs
  );

  return getCachedEligiblePublicProjects(approvedProjectSlugs.join("|"));
}

export async function getEligiblePublicProjectSlugs() {
  const projects = await getEligiblePublicProjects();

  return projects.map((project) => project.slug);
}

export async function getPublicProjectBySlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const projects = await getEligiblePublicProjects();

  return projects.find((project) => project.slug === normalizedSlug) ?? null;
}

export async function getHomepageProjects() {
  const projects = await getEligiblePublicProjects();

  return projects.slice(0, HOMEPAGE_PROJECT_LIMIT);
}

export async function getLockInSpotlightRelease(spotlightReleaseId = "") {
  const normalizedSpotlightId = spotlightReleaseId.trim();

  if (normalizedSpotlightId) {
    const [selectedRelease] = await getCachedPublishedReleasesByIds(
      normalizedSpotlightId
    );

    if (selectedRelease) {
      return selectedRelease;
    }
  }

  return getCachedPublishedReleaseBySlug("beast-mode");
}

const getCachedPublishedReleases = unstable_cache(
  async (
    normalizedCategorySlug: string,
    type: ReleaseType | "all",
    limit: number
  ) => {
  const releases = await prisma.release.findMany({
    where: {
      catalogScope: "VVVIRUZ",
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

  return Promise.all(releases.map(toPublicRelease));
  },
  ["public-published-releases-v2"],
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

export async function getRandomPublishedReleases(limit: number = 3): Promise<PublicReleaseRecord[]> {
  const releases = await prisma.release.findMany({
    where: {
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: publicReleaseSelect
  });
  const mapped = await Promise.all(releases.map(toPublicRelease));
  return shuffleItems(mapped).slice(0, limit);
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
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: publicReleaseSelect
  });

  if (!release) return null;
  return toPublicRelease(release);
  },
  ["public-release-by-slug-v2"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases]
  }
);

export async function getPublishedReleaseBySlug(slug: string) {
  return getCachedPublishedReleaseBySlug(slug);
}

const getCachedRelatedPublishedReleases = unstable_cache(
  async (releaseId: string, type: ReleaseType) => {
  const categoryAssignments = await prisma.releaseCategoryAssignment.findMany({
    where: {
      releaseId
    },
    select: {
      categoryId: true
    }
  });
  const categoryIds = categoryAssignments.map((assignment) => assignment.categoryId);
  const relatedReleases: PublicReleaseModel[] = [];
  const relatedReleaseIds = new Set<string>([releaseId]);

  if (categoryIds.length > 0) {
    const sameCategory = await prisma.release.findMany({
      where: {
        id: {
          not: releaseId
        },
        catalogScope: "VVVIRUZ",
        isPublished: true,
        categories: {
          some: {
            categoryId: {
              in: categoryIds
            }
          }
        }
      },
      select: publicReleaseSelect,
      orderBy: newestPublicReleaseOrder,
      take: 3
    });

    for (const release of sameCategory) {
      relatedReleases.push(release);
      relatedReleaseIds.add(release.id);
    }
  }

  if (relatedReleases.length < 3) {
    const sameType = await prisma.release.findMany({
      where: {
        id: {
          notIn: Array.from(relatedReleaseIds)
        },
        catalogScope: "VVVIRUZ",
        type,
        isPublished: true
      },
      select: publicReleaseSelect,
      orderBy: newestPublicReleaseOrder,
      take: 3 - relatedReleases.length
    });

    for (const release of sameType) {
      relatedReleases.push(release);
      relatedReleaseIds.add(release.id);
    }
  }

  if (relatedReleases.length >= 3) {
    return Promise.all(relatedReleases.slice(0, 3).map(toPublicRelease));
  }

  const recentFallback = await prisma.release.findMany({
    where: {
      id: {
        notIn: Array.from(relatedReleaseIds)
      },
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: publicReleaseSelect,
    orderBy: newestPublicReleaseOrder,
    take: 3 - relatedReleases.length
  });

  return Promise.all([...relatedReleases, ...recentFallback].map(toPublicRelease));
  },
  ["public-related-releases-v2"],
  {
    tags: [PUBLIC_CACHE_TAGS.releases, PUBLIC_CACHE_TAGS.releaseCategories]
  }
);

export async function getRelatedPublishedReleases(releaseId: string, type: ReleaseType) {
  return getCachedRelatedPublishedReleases(releaseId, type);
}

const getCachedPublishedReleaseSlugs = unstable_cache(
  async () => prisma.release.findMany({
    where: {
      catalogScope: "VVVIRUZ",
      isPublished: true
    },
    select: {
      slug: true,
      updatedOn: true
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
