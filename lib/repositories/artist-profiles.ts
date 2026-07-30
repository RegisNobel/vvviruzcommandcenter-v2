import {createHash, randomBytes} from "node:crypto";
import type {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {toDateInputValue} from "@/lib/db/serialization";
import {
  parseArtistProfileSnapshot,
  DEFAULT_ARTIST_EXPANSION_CONFIG,
  DEFAULT_ARTIST_PAGE_COPY,
  normalizeArtistFeaturedItems,
  normalizeArtistFeaturedStories,
  normalizeArtistThemeFamily,
  normalizeCountryCode,
  type ArtistEditorialReleaseSnapshot,
  type ArtistProfileEditorRecord,
  type ArtistProfileExpansionConfig,
  type ArtistProfileFeaturedItem,
  type ArtistProfileLink,
  type ArtistProfilePageCopy,
  type ArtistProfileSnapshot
} from "@/lib/artist-profiles";
import {parseStoredReleaseContext} from "@/lib/release-context";
import {createEmptyRelease} from "@/lib/releases";
import {saveRelease} from "@/lib/repositories/releases";
import {parseCollaborators} from "@/lib/public-utils";
import {createId} from "@/lib/utils";

export type SaveArtistProfileInput = {
  id?: string;
  slug: string;
  displayName: string;
  privateContactEmail?: string;
  location?: string;
  locationCountryCode?: string;
  themeFamily?: string;
  longBio?: string;
  differentiator?: string;
  genres?: string[];
  primaryCtaLabel?: string;
  primaryCtaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  profileImagePath?: string;
  profileImageAlt?: string;
  pageCopy?: ArtistProfilePageCopy;
  seoTitle?: string;
  seoDescription?: string;
  socialImageUrl?: string;
  expansion?: ArtistProfileExpansionConfig;
  links?: ArtistProfileLink[];
  featuredItems?: ArtistProfileFeaturedItem[];
  featuredStories?: ArtistProfileFeaturedItem[];
};

const editorialReleaseInclude = {
  primaryArtistProfile: {select: {displayName: true}},
  artistCredits: {
    select: {
      role: true,
      artistProfile: {select: {displayName: true}}
    },
    orderBy: [{displayOrder: "asc" as const}]
  },
  annotations: {
    where: {status: "ready", isPublic: true},
    include: {sources: {orderBy: {sortOrder: "asc" as const}}},
    orderBy: [{sortOrder: "asc" as const}, {updatedAt: "desc" as const}]
  }
} satisfies Prisma.ReleaseInclude;

type EditorialReleaseModel = Prisma.ReleaseGetPayload<{
  include: typeof editorialReleaseInclude;
}>;

const editorInclude = {
  links: {orderBy: {sortOrder: "asc" as const}},
  featuredItems: {
    orderBy: {sortOrder: "asc" as const},
    include: {release: {include: editorialReleaseInclude}}
  },
  primaryReleases: {
    include: editorialReleaseInclude,
    orderBy: [{updatedOn: "desc" as const}, {title: "asc" as const}]
  },
  releaseCredits: {
    select: {
      release: {include: editorialReleaseInclude}
    },
    orderBy: [{displayOrder: "asc" as const}]
  },
  versions: {
    orderBy: {version: "desc" as const},
    take: 1,
    include: {
      approvals: {
        orderBy: {decidedAt: "desc" as const},
        take: 1
      }
    }
  }
} satisfies Prisma.ArtistProfileInclude;

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseStringList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parsePageCopy(value: string): ArtistProfilePageCopy {
  try {
    const parsed = JSON.parse(value) as Partial<ArtistProfilePageCopy>;
    return {...DEFAULT_ARTIST_PAGE_COPY, ...parsed};
  } catch {
    return DEFAULT_ARTIST_PAGE_COPY;
  }
}

function toEditorialReleaseSnapshot(
  release: EditorialReleaseModel,
  fallbackArtistName: string,
  editorialEnabled: boolean
): ArtistEditorialReleaseSnapshot {
  const linkedCredits = release.artistCredits.map((credit) => ({
    name: credit.artistProfile.displayName,
    role: credit.role
  }));
  const linkedNames = new Set(
    linkedCredits.map((credit) => credit.name.trim().toLowerCase())
  );
  const legacyCollaboratorCredits = release.collaborator
    ? parseCollaborators(release.collaboratorName)
        .filter((name) => !linkedNames.has(name.toLowerCase()))
        .map((name) => ({name, role: "COLLABORATOR"}))
    : [];

  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    catalogScope: release.catalogScope === "ARTIST" ? "ARTIST" : "VVVIRUZ",
    primaryArtistProfileId: release.primaryArtistProfileId || "",
    primaryArtistName:
      release.primaryArtistProfile?.displayName ||
      (release.catalogScope === "ARTIST" ? fallbackArtistName : "vvviruz"),
    credits: [...linkedCredits, ...legacyCollaboratorCredits],
    releaseDate: toDateInputValue(release.releaseDate),
    type: release.type,
    coverArtUrl: release.coverArtPath || release.coverArtUrl || "",
    coverArtAlt: release.coverArtAltText,
    description: release.publicDescription,
    story: release.publicLongDescription,
    context: release.inspirationContext,
    languages: parseStoredReleaseContext(release.languages),
    genres: parseStoredReleaseContext(release.genres),
    moods: parseStoredReleaseContext(release.moods),
    themes: parseStoredReleaseContext(release.themes),
    listenerContexts: parseStoredReleaseContext(release.listenerContexts),
    streamingLinks: {
      spotify: release.spotifyUrl,
      appleMusic: release.appleMusicUrl,
      youtube: release.youtubeUrl
    },
    featuredVideoUrl: release.featuredVideoUrl,
    lyrics: release.lyrics,
    publicLyricsEnabled: release.publicLyricsEnabled,
    lyricsRightsConfirmed: Boolean(release.lyricsRightsConfirmedAt),
    editorialEnabled,
    annotations: release.annotations.map((annotation) => ({
      id: annotation.id,
      type: annotation.type,
      lyric_excerpt: annotation.excerptSnapshot || annotation.lyricExcerpt,
      summary: annotation.summary,
      title: annotation.title,
      explanation: annotation.explanation,
      confidence: annotation.confidence,
      anchor_version: annotation.anchorVersion ?? 0,
      section_key: annotation.sectionKey ?? "",
      section_occurrence: annotation.sectionOccurrence ?? 0,
      start_line_index: annotation.startLineIndex ?? 0,
      end_line_index: annotation.endLineIndex ?? 0,
      sources: annotation.sources.map((source) => ({
        label: source.label,
        url: source.url
      }))
    }))
  };
}

function toSnapshot(
  profile: Awaited<ReturnType<typeof readArtistProfileModel>>
): ArtistProfileSnapshot | null {
  if (!profile) return null;
  const homepageModels = profile.featuredItems.filter(
    (item) => item.placement !== "FEATURED_STORY"
  );
  const featuredStoryModels = profile.featuredItems.filter(
    (item) => item.placement === "FEATURED_STORY"
  );
  const explicitEditorialIds = parseStringList(profile.editorialReleaseIds);
  const editorialEnabledIds = new Set([
    ...explicitEditorialIds,
    ...homepageModels.flatMap((item) => (item.releaseId ? [item.releaseId] : [])),
    ...featuredStoryModels.flatMap((item) => (item.releaseId ? [item.releaseId] : []))
  ]);
  const mapPlacement = (item: (typeof profile.featuredItems)[number]) => ({
    placementId: item.id,
    releaseId: item.releaseId || undefined,
    itemType: item.itemType as ArtistProfileFeaturedItem["itemType"],
    eyebrow: item.eyebrow,
    title: item.title || item.release?.title || "",
    subtitle: item.subtitle || toDateInputValue(item.release?.releaseDate),
    description: item.description || item.release?.publicDescription || "",
    url: item.url,
    coverArtUrl:
      item.coverArtUrl ||
      item.release?.coverArtPath ||
      item.release?.coverArtUrl ||
      "",
    coverArtAlt:
      item.coverArtAlt ||
      item.release?.coverArtAltText ||
      (item.release ? `${item.release.title} cover artwork` : ""),
    isStartHere: item.isStartHere,
    editorialRelease: item.release
      ? toEditorialReleaseSnapshot(
          item.release,
          profile.displayName,
          editorialEnabledIds.has(item.release.id)
        )
      : undefined
  });
  const expansion: ArtistProfileExpansionConfig = {
    catalogEnabled: profile.catalogEnabled,
    catalogTitle: profile.catalogTitle,
    catalogIntro: profile.catalogIntro,
    catalogCtaLabel: profile.catalogCtaLabel,
    catalogReleaseIds: parseStringList(profile.catalogReleaseIds),
    editorialReleaseIds: explicitEditorialIds,
    featuredStoriesEnabled: profile.featuredStoriesEnabled,
    featuredStoriesLabel: profile.featuredStoriesLabel,
    featuredStoriesHeading: profile.featuredStoriesHeading
  };
  const releaseLibraryModels = Array.from(
    new Map(
      [
        ...profile.primaryReleases,
        ...profile.releaseCredits.map((credit) => credit.release),
        ...profile.featuredItems.flatMap((item) =>
          item.release ? [item.release] : []
        )
      ].map((release) => [release.id, release])
    ).values()
  );
  return {
    schemaVersion: 5,
    artistProfileId: profile.id,
    slug: profile.slug,
    displayName: profile.displayName,
    location: profile.location,
    locationCountryCode: profile.locationCountryCode,
    themeFamily: normalizeArtistThemeFamily(profile.themeFamily),
    longBio: profile.longBio,
    differentiator: profile.differentiator,
    genres: parseStringList(profile.genres),
    primaryCta: {label: profile.primaryCtaLabel, url: profile.primaryCtaUrl},
    secondaryCta: {label: profile.secondaryCtaLabel, url: profile.secondaryCtaUrl},
    profileImage: {url: profile.profileImagePath, alt: profile.profileImageAlt},
    pageCopy: parsePageCopy(profile.presentationCopy),
    seo: {
      title: profile.seoTitle,
      description: profile.seoDescription,
      socialImageUrl: profile.socialImageUrl
    },
    links: profile.links.map((link) => ({
      platform: link.platform,
      label: link.label,
      url: link.url,
      isPrimary: link.isPrimary
    })),
    featuredItems: normalizeArtistFeaturedItems(homepageModels.map(mapPlacement)),
    featuredStories: normalizeArtistFeaturedStories(
      featuredStoryModels.map(mapPlacement)
    ),
    expansion,
    releaseLibrary: releaseLibraryModels.map((release) =>
      toEditorialReleaseSnapshot(
        release,
        profile.displayName,
        editorialEnabledIds.has(release.id)
      )
    ),
    updatedAt: profile.updatedAt.toISOString()
  };
}

async function readArtistProfileModel(id: string) {
  return prisma.artistProfile.findUnique({where: {id}, include: editorInclude});
}

function toEditorRecord(
  profile: NonNullable<Awaited<ReturnType<typeof readArtistProfileModel>>>
): ArtistProfileEditorRecord {
  const snapshot = toSnapshot(profile)!;
  const latestVersion = profile.versions[0];
  const releaseOptionsById = new Map(
    [
      ...profile.primaryReleases,
      ...profile.releaseCredits.map((credit) => credit.release),
      ...profile.featuredItems.flatMap((item) =>
        item.release
          ? [
              {
                id: item.release.id,
                title: item.release.title,
                slug: item.release.slug,
                catalogScope: item.release.catalogScope,
                primaryArtistProfileId: item.release.primaryArtistProfileId
              }
            ]
          : []
      )
    ].map((release) => [release.id, release])
  );
  return {
    ...snapshot,
    privateContactEmail: profile.privateContactEmail,
    workflowStatus: profile.workflowStatus,
    publishedVersionId: profile.publishedVersionId,
    latestVersion: latestVersion
      ? {
          id: latestVersion.id,
          version: latestVersion.version,
          approvalStatus: latestVersion.approvalStatus,
          createdAt: latestVersion.createdAt.toISOString(),
          approvedAt: latestVersion.approvedAt?.toISOString() ?? null,
          publishedAt: latestVersion.publishedAt?.toISOString() ?? null,
          previewExpiresAt: latestVersion.previewExpiresAt?.toISOString() ?? null,
          previewRevokedAt: latestVersion.previewRevokedAt?.toISOString() ?? null,
          previewSupersededAt:
            latestVersion.previewSupersededAt?.toISOString() ?? null,
          previewIsExpired: Boolean(
            latestVersion.previewExpiresAt &&
              latestVersion.previewExpiresAt <= new Date()
          ),
          approval: latestVersion.approvals[0]
            ? {
                decidedByEmail: latestVersion.approvals[0].decidedByEmail,
                notes: latestVersion.approvals[0].notes,
                decidedAt: latestVersion.approvals[0].decidedAt.toISOString()
              }
            : null
        }
      : null,
    releaseOptions: Array.from(releaseOptionsById.values()).map((release) => ({
      id: release.id,
      title: release.title,
      slug: release.slug,
      catalogScope: release.catalogScope === "ARTIST" ? "ARTIST" : "VVVIRUZ",
      primaryArtistProfileId: release.primaryArtistProfileId || ""
    }))
  };
}

export async function listArtistProfiles() {
  return prisma.artistProfile.findMany({
    orderBy: [{updatedAt: "desc"}, {displayName: "asc"}],
    select: {
      id: true,
      slug: true,
      displayName: true,
      location: true,
      workflowStatus: true,
      themeFamily: true,
      publishedAt: true,
      updatedAt: true,
      _count: {select: {versions: true, releaseCredits: true, appearsOnCredits: true}}
    }
  });
}

export async function readArtistProfileForAdmin(id: string) {
  const profile = await readArtistProfileModel(id);
  return profile ? toEditorRecord(profile) : null;
}

export async function saveArtistProfile(input: SaveArtistProfileInput) {
  const now = new Date();
  const id = input.id || createId();
  const slug = normalizeSlug(input.slug);
  const themeFamily = normalizeArtistThemeFamily(input.themeFamily || "");
  const locationCountryCode = normalizeCountryCode(input.locationCountryCode || "");
  const featuredItems = normalizeArtistFeaturedItems(input.featuredItems ?? []);
  const featuredStories = normalizeArtistFeaturedStories(input.featuredStories ?? []);
  const expansion = {...DEFAULT_ARTIST_EXPANSION_CONFIG, ...input.expansion};
  if (!slug || !input.displayName.trim()) throw new Error("Artist name and slug are required.");

  await prisma.$transaction(async (tx) => {
    await tx.artistProfile.upsert({
      where: {id},
      create: {
        id,
        slug,
        displayName: input.displayName.trim(),
        privateContactEmail: input.privateContactEmail?.trim() || "",
        location: input.location?.trim() || "",
        locationCountryCode,
        themeFamily,
        tagline: "",
        shortBio: "",
        longBio: input.longBio?.trim() || "",
        differentiator: input.differentiator?.trim() || "",
        genres: JSON.stringify(input.genres ?? []),
        primaryCtaLabel: input.primaryCtaLabel?.trim() || "",
        primaryCtaUrl: input.primaryCtaUrl?.trim() || "",
        secondaryCtaLabel: input.secondaryCtaLabel?.trim() || "",
        secondaryCtaUrl: input.secondaryCtaUrl?.trim() || "",
        profileImagePath: input.profileImagePath?.trim() || "",
        profileImageAlt: input.profileImageAlt?.trim() || "",
        presentationCopy: JSON.stringify(input.pageCopy ?? DEFAULT_ARTIST_PAGE_COPY),
        catalogEnabled: Boolean(expansion.catalogEnabled),
        catalogTitle: expansion.catalogTitle.trim() || DEFAULT_ARTIST_EXPANSION_CONFIG.catalogTitle,
        catalogIntro: expansion.catalogIntro.trim(),
        catalogCtaLabel:
          expansion.catalogCtaLabel.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.catalogCtaLabel,
        catalogReleaseIds: JSON.stringify(expansion.catalogReleaseIds),
        editorialReleaseIds: JSON.stringify(expansion.editorialReleaseIds),
        featuredStoriesEnabled: Boolean(expansion.featuredStoriesEnabled),
        featuredStoriesLabel:
          expansion.featuredStoriesLabel.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.featuredStoriesLabel,
        featuredStoriesHeading:
          expansion.featuredStoriesHeading.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.featuredStoriesHeading,
        seoTitle: input.seoTitle?.trim() || "",
        seoDescription: input.seoDescription?.trim() || "",
        socialImageUrl: input.socialImageUrl?.trim() || "",
        draftUpdatedAt: now,
        createdAt: now,
        updatedAt: now
      },
      update: {
        slug,
        displayName: input.displayName.trim(),
        privateContactEmail: input.privateContactEmail?.trim() || "",
        location: input.location?.trim() || "",
        locationCountryCode,
        themeFamily,
        tagline: "",
        shortBio: "",
        longBio: input.longBio?.trim() || "",
        differentiator: input.differentiator?.trim() || "",
        genres: JSON.stringify(input.genres ?? []),
        primaryCtaLabel: input.primaryCtaLabel?.trim() || "",
        primaryCtaUrl: input.primaryCtaUrl?.trim() || "",
        secondaryCtaLabel: input.secondaryCtaLabel?.trim() || "",
        secondaryCtaUrl: input.secondaryCtaUrl?.trim() || "",
        profileImagePath: input.profileImagePath?.trim() || "",
        profileImageAlt: input.profileImageAlt?.trim() || "",
        presentationCopy: JSON.stringify(input.pageCopy ?? DEFAULT_ARTIST_PAGE_COPY),
        catalogEnabled: Boolean(expansion.catalogEnabled),
        catalogTitle: expansion.catalogTitle.trim() || DEFAULT_ARTIST_EXPANSION_CONFIG.catalogTitle,
        catalogIntro: expansion.catalogIntro.trim(),
        catalogCtaLabel:
          expansion.catalogCtaLabel.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.catalogCtaLabel,
        catalogReleaseIds: JSON.stringify(expansion.catalogReleaseIds),
        editorialReleaseIds: JSON.stringify(expansion.editorialReleaseIds),
        featuredStoriesEnabled: Boolean(expansion.featuredStoriesEnabled),
        featuredStoriesLabel:
          expansion.featuredStoriesLabel.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.featuredStoriesLabel,
        featuredStoriesHeading:
          expansion.featuredStoriesHeading.trim() ||
          DEFAULT_ARTIST_EXPANSION_CONFIG.featuredStoriesHeading,
        seoTitle: input.seoTitle?.trim() || "",
        seoDescription: input.seoDescription?.trim() || "",
        socialImageUrl: input.socialImageUrl?.trim() || "",
        draftUpdatedAt: now,
        updatedAt: now
      }
    });

    await tx.artistLink.deleteMany({where: {artistProfileId: id}});
    if (input.links?.length) {
      await tx.artistLink.createMany({
        data: input.links
          .filter((link) => link.url.trim())
          .map((link, index) => ({
            id: createId(),
            artistProfileId: id,
            platform: link.platform.trim().toLowerCase(),
            label: link.label.trim(),
            url: link.url.trim(),
            isPrimary: Boolean(link.isPrimary),
            sortOrder: index,
            createdAt: now,
            updatedAt: now
          }))
      });
    }

    await tx.artistFeaturedItem.deleteMany({where: {artistProfileId: id}});
    if (featuredItems.length) {
      await tx.artistFeaturedItem.createMany({
        data: featuredItems
          .filter((item) => item.title.trim() && (item.url.trim() || item.releaseId))
          .map((item, index) => ({
            id: createId(),
            artistProfileId: id,
            releaseId: item.releaseId || null,
            itemType: item.itemType,
            eyebrow: item.eyebrow.trim(),
            title: item.title.trim(),
            subtitle: item.subtitle.trim(),
            description: item.description.trim(),
            url: item.url.trim(),
            coverArtUrl: item.coverArtUrl.trim(),
            coverArtAlt: item.coverArtAlt.trim(),
            placement: "HOME",
            isStartHere: Boolean(item.isStartHere),
            sortOrder: index,
            createdAt: now,
            updatedAt: now
          }))
      });
    }
    if (featuredStories.length) {
      await tx.artistFeaturedItem.createMany({
        data: featuredStories
          .filter((item) => item.title.trim() && (item.url.trim() || item.releaseId))
          .map((item, index) => ({
            id: createId(),
            artistProfileId: id,
            releaseId: item.releaseId || null,
            itemType: item.itemType,
            eyebrow: item.eyebrow.trim(),
            title: item.title.trim(),
            subtitle: item.subtitle.trim(),
            description: item.description.trim(),
            url: item.url.trim(),
            coverArtUrl: item.coverArtUrl.trim(),
            coverArtAlt: item.coverArtAlt.trim(),
            placement: "FEATURED_STORY",
            isStartHere: false,
            sortOrder: index,
            createdAt: now,
            updatedAt: now
          }))
      });
    }
  });

  return id;
}

export async function createArtistRelease(artistProfileId: string) {
  const artist = await prisma.artistProfile.findUnique({
    where: {id: artistProfileId},
    select: {displayName: true}
  });
  if (!artist) throw new Error("Artist profile not found.");

  const release = createEmptyRelease({
    title: `Untitled ${artist.displayName} release`,
    catalog_scope: "ARTIST",
    primary_artist_profile_id: artistProfileId
  });
  await saveRelease(release);
  return release.id;
}

export type PromoteArtistHomepageItemInput = {
  artistProfileId: string;
  featuredItemId?: string;
  featuredItemIndex: number;
  title: string;
  description: string;
  url: string;
  coverArtUrl: string;
  coverArtAlt: string;
};

function getPromotedReleaseLinks(urlValue: string) {
  const url = urlValue.trim();
  const links = {spotify: "", apple_music: "", youtube: ""};
  if (!url) return {links, contextualLabel: "", contextualUrl: ""};

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("spotify.com")) links.spotify = url;
    else if (hostname.includes("music.apple.com")) links.apple_music = url;
    else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      links.youtube = url;
    } else {
      return {links, contextualLabel: "Listen", contextualUrl: url};
    }
  } catch {
    return {links, contextualLabel: "", contextualUrl: ""};
  }

  return {links, contextualLabel: "", contextualUrl: ""};
}

export async function promoteArtistHomepageItemToEditorial(
  input: PromoteArtistHomepageItemInput
) {
  const item = await prisma.artistFeaturedItem.findFirst({
    where: {
      artistProfileId: input.artistProfileId,
      placement: "HOME",
      OR: [
        ...(input.featuredItemId ? [{id: input.featuredItemId}] : []),
        {sortOrder: input.featuredItemIndex}
      ]
    },
    include: {
      artistProfile: {select: {displayName: true}}
    }
  });
  if (!item) {
    throw new Error(
      "Save the artist profile before promoting this homepage release."
    );
  }
  if (item.releaseId) return item.releaseId;

  const title = input.title.trim() || item.title.trim();
  if (!title) throw new Error("Add a release title before promoting it.");

  const destination = getPromotedReleaseLinks(input.url || item.url);
  const release = createEmptyRelease({
    title,
    catalog_scope: "ARTIST",
    primary_artist_profile_id: input.artistProfileId,
    public_description: input.description.trim() || item.description,
    streaming_links: destination.links,
    contextual_cta_label: destination.contextualLabel,
    contextual_cta_url: destination.contextualUrl,
    cover_art_alt_text:
      input.coverArtAlt.trim() ||
      item.coverArtAlt ||
      `${title} cover artwork`
  });
  release.cover_art_path = input.coverArtUrl.trim() || item.coverArtUrl;

  await saveRelease(release);

  const now = new Date();
  await prisma.$transaction([
    prisma.artistFeaturedItem.update({
      where: {id: item.id},
      data: {
        releaseId: release.id,
        title,
        description: input.description.trim() || item.description,
        url: input.url.trim() || item.url,
        coverArtUrl: input.coverArtUrl.trim() || item.coverArtUrl,
        coverArtAlt:
          input.coverArtAlt.trim() ||
          item.coverArtAlt ||
          `${title} cover artwork`,
        updatedAt: now
      }
    }),
    prisma.artistProfile.update({
      where: {id: input.artistProfileId},
      data: {draftUpdatedAt: now, updatedAt: now}
    })
  ]);

  return release.id;
}

export type ArtistReleaseHomepagePlacement =
  | "NONE"
  | "SUPPORTING"
  | "START_HERE";

export async function setArtistReleaseHomepagePlacement(input: {
  artistProfileId: string;
  releaseId: string;
  placement: ArtistReleaseHomepagePlacement;
}) {
  const release = await prisma.release.findUnique({
    where: {id: input.releaseId},
    select: {
      id: true,
      title: true,
      type: true,
      releaseDate: true,
      publicDescription: true,
      coverArtPath: true,
      coverArtUrl: true,
      coverArtAltText: true,
      youtubeUrl: true,
      spotifyUrl: true,
      appleMusicUrl: true,
      primaryArtistProfileId: true,
      artistCredits: {
        where: {artistProfileId: input.artistProfileId},
        select: {id: true},
        take: 1
      }
    }
  });
  if (
    !release ||
    (release.primaryArtistProfileId !== input.artistProfileId &&
      release.artistCredits.length === 0)
  ) {
    throw new Error("This release is not connected to the managed artist.");
  }

  const homepageItems = await prisma.artistFeaturedItem.findMany({
    where: {artistProfileId: input.artistProfileId, placement: "HOME"},
    orderBy: {sortOrder: "asc"}
  });
  const existing = homepageItems.find((item) => item.releaseId === input.releaseId);
  const otherItems = homepageItems.filter((item) => item.id !== existing?.id);
  if (
    input.placement !== "NONE" &&
    !existing &&
    homepageItems.length >= 3
  ) {
    throw new Error(
      "This artist already has three homepage placements. Remove one before adding another."
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (input.placement === "NONE") {
      if (existing) {
        await tx.artistFeaturedItem.delete({where: {id: existing.id}});
        if (existing.isStartHere && otherItems[0]) {
          await tx.artistFeaturedItem.update({
            where: {id: otherItems[0].id},
            data: {isStartHere: true, updatedAt: now}
          });
        }
      }
    } else {
      const shouldStartHere =
        input.placement === "START_HERE" ||
        (!homepageItems.some((item) => item.isStartHere) && !existing);
      if (input.placement === "START_HERE") {
        await tx.artistFeaturedItem.updateMany({
          where: {artistProfileId: input.artistProfileId, placement: "HOME"},
          data: {isStartHere: false, updatedAt: now}
        });
      } else if (existing?.isStartHere && otherItems[0]) {
        await tx.artistFeaturedItem.update({
          where: {id: otherItems[0].id},
          data: {isStartHere: true, updatedAt: now}
        });
      }

      const placementData = {
        itemType: "track",
        eyebrow: "",
        title: release.title,
        subtitle: toDateInputValue(release.releaseDate),
        description: release.publicDescription,
        url:
          release.youtubeUrl ||
          release.spotifyUrl ||
          release.appleMusicUrl ||
          "",
        coverArtUrl: release.coverArtPath || release.coverArtUrl || "",
        coverArtAlt:
          release.coverArtAltText || `${release.title} cover artwork`,
        placement: "HOME",
        isStartHere:
          input.placement === "SUPPORTING" && existing?.isStartHere && !otherItems[0]
            ? true
            : shouldStartHere,
        updatedAt: now
      };
      if (existing) {
        await tx.artistFeaturedItem.update({
          where: {id: existing.id},
          data: placementData
        });
      } else {
        await tx.artistFeaturedItem.create({
          data: {
            id: createId(),
            artistProfileId: input.artistProfileId,
            releaseId: release.id,
            ...placementData,
            sortOrder: homepageItems.length,
            createdAt: now
          }
        });
      }
    }

    await tx.artistProfile.update({
      where: {id: input.artistProfileId},
      data: {draftUpdatedAt: now, updatedAt: now}
    });
  });
  return input.placement === "SUPPORTING" &&
    existing?.isStartHere &&
    !otherItems[0]
    ? ("START_HERE" as const)
    : input.placement;
}

export async function createArtistPreviewVersion(artistProfileId: string) {
  const profile = await readArtistProfileModel(artistProfileId);
  const snapshot = toSnapshot(profile);
  if (!profile || !snapshot) throw new Error("Artist profile not found.");

  const latest = await prisma.artistProfileVersion.findFirst({
    where: {artistProfileId},
    orderBy: {version: "desc"},
    select: {version: true}
  });
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const previewExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const version = await prisma.$transaction(async (tx) => {
    await tx.artistProfileVersion.updateMany({
      where: {
        artistProfileId,
        previewTokenHash: {not: null},
        previewRevokedAt: null,
        previewSupersededAt: null
      },
      data: {previewSupersededAt: now}
    });
    const created = await tx.artistProfileVersion.create({
      data: {
        id: createId(),
        artistProfileId,
        version: (latest?.version ?? 0) + 1,
        content: JSON.stringify(snapshot),
        approvalStatus: "AWAITING_APPROVAL",
        previewTokenHash: tokenHash,
        previewExpiresAt,
        createdAt: now
      }
    });
    await tx.artistProfile.update({
      where: {id: artistProfileId},
      data: {workflowStatus: "AWAITING_APPROVAL", updatedAt: now}
    });
    return created;
  });

  return {
    token,
    version: version.version,
    previewExpiresAt: version.previewExpiresAt?.toISOString() || null
  };
}

export async function recordArtistProfileApproval(input: {
  artistProfileId: string;
  versionId: string;
  decidedByEmail: string;
  notes?: string;
}) {
  const now = new Date();
  const decidedByEmail = input.decidedByEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decidedByEmail)) {
    throw new Error("Enter a valid approver email.");
  }
  const version = await prisma.artistProfileVersion.findFirst({
    where: {
      id: input.versionId,
      artistProfileId: input.artistProfileId,
      approvalStatus: "AWAITING_APPROVAL",
      previewRevokedAt: null,
      previewSupersededAt: null,
      OR: [{previewExpiresAt: null}, {previewExpiresAt: {gt: now}}]
    },
    select: {id: true}
  });
  if (!version) {
    throw new Error(
      "Only the current, active preview version can be approved."
    );
  }
  await prisma.$transaction([
    prisma.artistProfileApproval.create({
      data: {
        id: createId(),
        artistProfileId: input.artistProfileId,
        versionId: input.versionId,
        decision: "APPROVED",
        decidedByEmail,
        notes: input.notes?.trim() || "",
        decidedAt: now,
        createdAt: now
      }
    }),
    prisma.artistProfileVersion.update({
      where: {id: input.versionId},
      data: {approvalStatus: "APPROVED", approvedAt: now}
    }),
    prisma.artistProfile.update({
      where: {id: input.artistProfileId},
      data: {workflowStatus: "APPROVED", updatedAt: now}
    })
  ]);
}

export async function revokeArtistPreviewVersion(input: {
  artistProfileId: string;
  versionId: string;
}) {
  const now = new Date();
  const version = await prisma.artistProfileVersion.findFirst({
    where: {
      id: input.versionId,
      artistProfileId: input.artistProfileId,
      previewTokenHash: {not: null},
      previewRevokedAt: null
    },
    select: {id: true, approvalStatus: true}
  });
  if (!version) throw new Error("This preview is already unavailable.");

  await prisma.$transaction([
    prisma.artistProfileVersion.update({
      where: {id: input.versionId},
      data: {
        previewRevokedAt: now,
        approvalStatus:
          version.approvalStatus === "AWAITING_APPROVAL"
            ? "REVOKED"
            : version.approvalStatus
      }
    }),
    prisma.artistProfile.update({
      where: {id: input.artistProfileId},
      data: {
        workflowStatus: "DRAFT",
        updatedAt: now
      }
    })
  ]);
}

export async function publishArtistProfile(artistProfileId: string, versionId: string) {
  const version = await prisma.artistProfileVersion.findFirst({
    where: {id: versionId, artistProfileId, approvalStatus: "APPROVED"}
  });
  if (!version) throw new Error("Only an approved artist profile version can be published.");
  const snapshot = parseArtistProfileSnapshot(version.content);
  if (!snapshot) throw new Error("The approved artist profile snapshot is invalid.");
  const publishedSlugConflict = await prisma.artistProfile.findFirst({
    where: {
      id: {not: artistProfileId},
      publishedSlug: snapshot.slug,
      publishedVersionId: {not: null}
    },
    select: {displayName: true}
  });
  if (publishedSlugConflict) {
    throw new Error(
      `The public artist slug is already used by ${publishedSlugConflict.displayName}.`
    );
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.artistProfileVersion.update({
      where: {id: versionId},
      data: {publishedAt: now, previewRevokedAt: now}
    }),
    prisma.artistProfile.update({
      where: {id: artistProfileId},
      data: {
        publishedVersionId: versionId,
        publishedSlug: snapshot.slug,
        workflowStatus: "PUBLISHED",
        publishedAt: now,
        pausedAt: null,
        updatedAt: now
      }
    })
  ]);
}

export async function readPublishedArtistProfile(slug: string) {
  const profile = await prisma.artistProfile.findFirst({
    where: {
      publishedSlug: slug,
      publishedVersionId: {not: null},
      pausedAt: null,
      archivedAt: null
    },
    select: {publishedVersion: {select: {content: true}}}
  });
  return profile?.publishedVersion ? parseArtistProfileSnapshot(profile.publishedVersion.content) : null;
}

export async function listPublishedArtistProfiles() {
  const profiles = await prisma.artistProfile.findMany({
    where: {
      publishedVersionId: {not: null},
      publishedSlug: {not: ""},
      pausedAt: null,
      archivedAt: null
    },
    orderBy: [{displayName: "asc"}, {createdAt: "asc"}],
    select: {
      publishedVersion: {select: {content: true}}
    }
  });

  return profiles.flatMap((profile) => {
    const snapshot = profile.publishedVersion
      ? parseArtistProfileSnapshot(profile.publishedVersion.content)
      : null;
    return snapshot ? [snapshot] : [];
  });
}

export async function readArtistPreviewByToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const version = await prisma.artistProfileVersion.findUnique({
    where: {previewTokenHash: tokenHash},
    select: {
      content: true,
      approvalStatus: true,
      version: true,
      previewExpiresAt: true,
      previewRevokedAt: true,
      previewSupersededAt: true
    }
  });
  if (!version) return null;
  const now = new Date();
  if (
    version.previewRevokedAt ||
    version.previewSupersededAt ||
    (version.previewExpiresAt && version.previewExpiresAt <= now)
  ) {
    return null;
  }
  const profile = parseArtistProfileSnapshot(version.content);
  return profile ? {profile, approvalStatus: version.approvalStatus, version: version.version} : null;
}

export async function readPublishedArtistEditorialRelease(
  artistSlug: string,
  releaseSlug: string
) {
  const profile = await readPublishedArtistProfile(artistSlug);
  if (!profile) return null;
  const release = profile.releaseLibrary.find(
    (item) =>
      item.editorialEnabled &&
      item.slug === releaseSlug
  );
  return release ? {profile, release} : null;
}

export async function readArtistPreviewEditorialRelease(
  token: string,
  releaseSlug: string
) {
  const preview = await readArtistPreviewByToken(token);
  if (!preview) return null;
  const release = preview.profile.releaseLibrary.find(
    (item) =>
      item.editorialEnabled &&
      item.slug === releaseSlug
  );
  return release ? {...preview, release} : null;
}

export async function getPublishedArtistSlugs() {
  return prisma.artistProfile.findMany({
    where: {
      publishedVersionId: {not: null},
      publishedSlug: {not: ""},
      pausedAt: null,
      archivedAt: null
    },
    select: {publishedSlug: true, updatedAt: true}
  });
}

export async function getPublishedArtistEditorialReleasePaths() {
  const profiles = await prisma.artistProfile.findMany({
    where: {
      publishedVersionId: {not: null},
      publishedSlug: {not: ""},
      pausedAt: null,
      archivedAt: null
    },
    select: {
      publishedSlug: true,
      updatedAt: true,
      publishedVersion: {select: {content: true}}
    }
  });
  return profiles.flatMap((profile) => {
    const snapshot = profile.publishedVersion
      ? parseArtistProfileSnapshot(profile.publishedVersion.content)
      : null;
    if (!snapshot) return [];
    return snapshot.releaseLibrary.flatMap((release) =>
      release.editorialEnabled
        ? [
            {
              artistSlug: profile.publishedSlug,
              releaseSlug: release.slug,
              updatedAt: profile.updatedAt
            }
          ]
        : []
    );
  });
}

export async function getPublishedArtistCatalogPaths() {
  const profiles = await prisma.artistProfile.findMany({
    where: {
      publishedVersionId: {not: null},
      publishedSlug: {not: ""},
      pausedAt: null,
      archivedAt: null
    },
    select: {
      publishedSlug: true,
      updatedAt: true,
      publishedVersion: {select: {content: true}}
    }
  });
  return profiles.flatMap((profile) => {
    const snapshot = profile.publishedVersion
      ? parseArtistProfileSnapshot(profile.publishedVersion.content)
      : null;
    return snapshot?.expansion.catalogEnabled &&
      snapshot.expansion.catalogReleaseIds.length
      ? [{artistSlug: profile.publishedSlug, updatedAt: profile.updatedAt}]
      : [];
  });
}
