import "server-only";

import {createHash, randomBytes} from "node:crypto";

import {
  artistIntakeResponseSchema,
  artistIntakeSubmissionSchema,
  createEmptyArtistIntakeResponse,
  parseArtistIntakeResponse,
  type ArtistIntakeResponse
} from "@/lib/artist-intake";
import {
  DEFAULT_ARTIST_EXPANSION_CONFIG,
  DEFAULT_ARTIST_PAGE_COPY,
  type ArtistProfileFeaturedItem
} from "@/lib/artist-profiles";
import {getCountryName} from "@/lib/countries";
import {prisma} from "@/lib/db/prisma";
import {createEmptyRelease} from "@/lib/releases";
import {saveArtistProfile} from "@/lib/repositories/artist-profiles";
import {saveRelease} from "@/lib/repositories/releases";
import {deleteAsset} from "@/lib/server/asset-storage";
import {createId} from "@/lib/utils";

export type ArtistIntakeAdminRecord = {
  id: string;
  artistName: string;
  inviteeEmail: string;
  tokenHint: string;
  status: string;
  expiresAt: string;
  submittedAt: string | null;
  lastOpenedAt: string | null;
  reviewedAt: string | null;
  convertedAt: string | null;
  archivedAt: string | null;
  submissionNotificationStatus: string;
  submissionNotificationError: string;
  submissionNotificationAttemptedAt: string | null;
  linkedArtistProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  response: ArtistIntakeResponse;
};

export type ArtistIntakePublicRecord = {
  artistName: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  response: ArtistIntakeResponse;
};

function hashArtistIntakeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseStoredAssetPaths(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeDraftSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artist";
}

function intakeReleaseItemType(type: string): ArtistProfileFeaturedItem["itemType"] {
  const normalized = type.trim().toLowerCase();
  if (normalized === "ep") return "ep";
  if (normalized === "album" || normalized === "mixtape") return "album";
  if (normalized === "collaboration") return "collaboration";
  return "single";
}

function serializeAdminRecord(record: {
  id: string;
  artistName: string;
  inviteeEmail: string;
  tokenHint: string;
  status: string;
  content: string;
  expiresAt: Date;
  submittedAt: Date | null;
  lastOpenedAt: Date | null;
  reviewedAt: Date | null;
  convertedAt: Date | null;
  archivedAt: Date | null;
  submissionNotificationStatus: string;
  submissionNotificationError: string;
  submissionNotificationAttemptedAt: Date | null;
  linkedArtistProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ArtistIntakeAdminRecord {
  return {
    id: record.id,
    artistName: record.artistName,
    inviteeEmail: record.inviteeEmail,
    tokenHint: record.tokenHint,
    status:
      record.status === "DRAFT" && record.expiresAt <= new Date()
        ? "EXPIRED"
        : record.status,
    expiresAt: record.expiresAt.toISOString(),
    submittedAt: record.submittedAt?.toISOString() || null,
    lastOpenedAt: record.lastOpenedAt?.toISOString() || null,
    reviewedAt: record.reviewedAt?.toISOString() || null,
    convertedAt: record.convertedAt?.toISOString() || null,
    archivedAt: record.archivedAt?.toISOString() || null,
    submissionNotificationStatus: record.submissionNotificationStatus,
    submissionNotificationError: record.submissionNotificationError,
    submissionNotificationAttemptedAt:
      record.submissionNotificationAttemptedAt?.toISOString() || null,
    linkedArtistProfileId: record.linkedArtistProfileId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    response: parseArtistIntakeResponse(
      record.content,
      record.artistName,
      record.inviteeEmail
    )
  };
}

export async function createArtistIntakeInvite(input: {
  artistName: string;
  inviteeEmail: string;
  expiresInDays?: number;
}) {
  const artistName = input.artistName.trim();
  const inviteeEmail = input.inviteeEmail.trim().toLowerCase();
  if (!artistName) throw new Error("Artist name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
    throw new Error("Enter a valid collaborator email.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresInDays = Math.min(Math.max(input.expiresInDays || 30, 1), 90);
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const response = createEmptyArtistIntakeResponse(artistName, inviteeEmail);

  const intake = await prisma.artistIntake.create({
    data: {
      id: createId(),
      artistName,
      inviteeEmail,
      tokenHash: hashArtistIntakeToken(token),
      tokenHint: token.slice(-6),
      status: "DRAFT",
      content: JSON.stringify(response),
      expiresAt,
      createdAt: now,
      updatedAt: now
    }
  });

  return {
    id: intake.id,
    token,
    path: `/artist-intake/${encodeURIComponent(token)}`,
    expiresAt: intake.expiresAt.toISOString()
  };
}

export async function listArtistIntakes() {
  const records = await prisma.artistIntake.findMany({
    orderBy: {createdAt: "desc"}
  });
  return records.map(serializeAdminRecord);
}

export async function readArtistIntakeForAdmin(id: string) {
  const record = await prisma.artistIntake.findUnique({where: {id}});
  return record ? serializeAdminRecord(record) : null;
}

export async function readArtistIntakeByToken(
  token: string,
  options: {recordOpen?: boolean} = {}
): Promise<ArtistIntakePublicRecord | null> {
  if (!token.trim()) return null;
  const tokenHash = hashArtistIntakeToken(token);
  const record = await prisma.artistIntake.findUnique({where: {tokenHash}});
  if (!record) return null;

  const isExpired = record.status === "DRAFT" && record.expiresAt <= new Date();
  if (options.recordOpen && !isExpired && record.status === "DRAFT") {
    await prisma.artistIntake.update({
      where: {id: record.id},
      data: {lastOpenedAt: new Date(), updatedAt: new Date()}
    });
  }

  return {
    artistName: record.artistName,
    inviteeEmail: record.inviteeEmail,
    status: isExpired ? "EXPIRED" : record.status,
    expiresAt: record.expiresAt.toISOString(),
    response: parseArtistIntakeResponse(
      record.content,
      record.artistName,
      record.inviteeEmail
    )
  };
}

export async function saveArtistIntakeResponse(input: {
  token: string;
  response: unknown;
  submit: boolean;
}) {
  const tokenHash = hashArtistIntakeToken(input.token);
  const record = await prisma.artistIntake.findUnique({where: {tokenHash}});
  if (!record) throw new Error("This intake link is invalid.");
  if (record.expiresAt <= new Date()) throw new Error("This intake link has expired.");
  if (record.status !== "DRAFT") {
    throw new Error("This intake is no longer accepting changes.");
  }

  const response = input.submit
    ? artistIntakeSubmissionSchema.parse(input.response)
    : artistIntakeResponseSchema.parse(input.response);
  const now = new Date();
  const updated = await prisma.artistIntake.update({
    where: {id: record.id},
    data: {
      artistName: response.artist.displayName,
      inviteeEmail: response.artist.contactEmail.toLowerCase(),
      content: JSON.stringify(response),
      status: input.submit ? "SUBMITTED" : "DRAFT",
      submittedAt: input.submit ? now : null,
      updatedAt: now
    }
  });

  return {
    id: updated.id,
    artistName: updated.artistName,
    inviteeEmail: updated.inviteeEmail,
    status: updated.status,
    submittedAt: updated.submittedAt?.toISOString() || null
  };
}

export async function registerArtistIntakeAsset(token: string, assetUrl: string) {
  const tokenHash = hashArtistIntakeToken(token);
  const record = await prisma.artistIntake.findUnique({
    where: {tokenHash},
    select: {id: true, status: true, uploadedAssetPaths: true}
  });
  if (!record || record.status !== "DRAFT") {
    throw new Error("This intake is no longer accepting uploads.");
  }
  const assetPaths = Array.from(
    new Set([...parseStoredAssetPaths(record.uploadedAssetPaths), assetUrl])
  );
  await prisma.artistIntake.update({
    where: {id: record.id},
    data: {
      uploadedAssetPaths: JSON.stringify(assetPaths),
      updatedAt: new Date()
    }
  });
}

export async function recordArtistIntakeNotificationResult(input: {
  id: string;
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
}) {
  await prisma.artistIntake.update({
    where: {id: input.id},
    data: {
      submissionNotificationStatus: input.status,
      submissionNotificationError: input.error?.slice(0, 1000) || "",
      submissionNotificationAttemptedAt: new Date(),
      updatedAt: new Date()
    }
  });
}

export async function markArtistIntakeReviewed(id: string) {
  const intake = await prisma.artistIntake.findUnique({where: {id}});
  if (!intake) throw new Error("Artist intake not found.");
  if (!["SUBMITTED", "REVIEWED"].includes(intake.status)) {
    throw new Error("Only a submitted intake can be marked reviewed.");
  }
  await prisma.artistIntake.update({
    where: {id},
    data: {
      status: "REVIEWED",
      reviewedAt: intake.reviewedAt || new Date(),
      updatedAt: new Date()
    }
  });
}

export async function reopenArtistIntake(id: string) {
  const intake = await prisma.artistIntake.findUnique({where: {id}});
  if (!intake) throw new Error("Artist intake not found.");
  if (intake.linkedArtistProfileId) {
    throw new Error("A converted intake cannot be reopened.");
  }
  const now = new Date();
  await prisma.artistIntake.update({
    where: {id},
    data: {
      status: "DRAFT",
      submittedAt: null,
      reviewedAt: null,
      archivedAt: null,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      submissionNotificationStatus: "NOT_SENT",
      submissionNotificationError: "",
      submissionNotificationAttemptedAt: null,
      updatedAt: now
    }
  });
}

export async function rotateArtistIntakeInvite(id: string) {
  const intake = await prisma.artistIntake.findUnique({where: {id}});
  if (!intake) throw new Error("Artist intake not found.");
  if (intake.status !== "DRAFT" || intake.linkedArtistProfileId) {
    throw new Error("Only an open draft invitation can be regenerated.");
  }
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.artistIntake.update({
    where: {id},
    data: {
      tokenHash: hashArtistIntakeToken(token),
      tokenHint: token.slice(-6),
      expiresAt,
      updatedAt: now
    }
  });
  return {
    token,
    path: `/artist-intake/${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString()
  };
}

export async function archiveArtistIntake(id: string) {
  const intake = await prisma.artistIntake.findUnique({where: {id}});
  if (!intake) throw new Error("Artist intake not found.");
  const now = new Date();
  if (!intake.linkedArtistProfileId) {
    await Promise.all(
      parseStoredAssetPaths(intake.uploadedAssetPaths).map((asset) =>
        deleteAsset("artist-intake-image", asset)
      )
    );
  }
  await prisma.artistIntake.update({
    where: {id},
    data: {
      status: "ARCHIVED",
      archivedAt: now,
      uploadedAssetPaths: intake.linkedArtistProfileId
        ? intake.uploadedAssetPaths
        : "[]",
      updatedAt: now
    }
  });
}

export async function archiveExpiredArtistIntakes() {
  const expired = await prisma.artistIntake.findMany({
    where: {
      status: "DRAFT",
      expiresAt: {lte: new Date()},
      linkedArtistProfileId: null
    },
    select: {id: true}
  });
  for (const intake of expired) {
    await archiveArtistIntake(intake.id);
  }
  return expired.length;
}

async function uniqueArtistSlug(baseValue: string, profileId: string) {
  const base = normalizeDraftSlug(baseValue);
  const existingProfile = await prisma.artistProfile.findUnique({
    where: {id: profileId},
    select: {slug: true}
  });
  if (existingProfile) return existingProfile.slug;
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const match = await prisma.artistProfile.findUnique({
      where: {slug: candidate},
      select: {id: true}
    });
    if (!match || match.id === profileId) return candidate;
  }
  throw new Error("A unique artist slug could not be generated.");
}

async function uniqueReleaseSlug(
  baseValue: string,
  artistSlug: string,
  releaseId: string
) {
  const base = normalizeDraftSlug(baseValue);
  const existingRelease = await prisma.release.findUnique({
    where: {id: releaseId},
    select: {slug: true}
  });
  if (existingRelease) return existingRelease.slug;
  const candidates = [
    `${base}-${artistSlug}`,
    ...Array.from({length: 99}, (_, index) => `${base}-${artistSlug}-${index + 2}`)
  ];
  for (const candidate of candidates) {
    const match = await prisma.release.findUnique({
      where: {slug: candidate},
      select: {id: true}
    });
    if (!match || match.id === releaseId) return candidate;
  }
  throw new Error("A unique release slug could not be generated.");
}

export async function convertArtistIntakeToDraft(id: string) {
  const intake = await prisma.artistIntake.findUnique({where: {id}});
  if (!intake) throw new Error("Artist intake not found.");
  if (intake.linkedArtistProfileId) return intake.linkedArtistProfileId;
  if (!["SUBMITTED", "REVIEWED"].includes(intake.status)) {
    throw new Error("Review the submitted intake before creating a draft.");
  }

  const response = parseArtistIntakeResponse(
    intake.content,
    intake.artistName,
    intake.inviteeEmail
  );
  const artistProfileId = `artist-intake-${intake.id}`;
  const artistSlug = await uniqueArtistSlug(
    response.artist.displayName,
    artistProfileId
  );
  const profileLinks = response.links
    .filter((link) => link.url)
    .map((link, index) => ({
      platform: link.platform,
      label: link.label,
      url: link.url,
      isPrimary: index === 0
    }));

  await saveArtistProfile({
    id: artistProfileId,
    slug: artistSlug,
    displayName: response.artist.displayName,
    privateContactEmail: response.artist.contactEmail,
    location:
      getCountryName(response.artist.countryCode) || response.artist.countryCode,
    locationCountryCode: response.artist.countryCode,
    themeFamily: response.artist.themeFamily,
    longBio: response.artist.soundDescription,
    differentiator: response.artist.differentiator,
    genres: response.artist.genres,
    profileImagePath: response.artist.profileImageUrl,
    profileImageAlt: response.artist.profileImageAlt,
    pageCopy: DEFAULT_ARTIST_PAGE_COPY,
    expansion: DEFAULT_ARTIST_EXPANSION_CONFIG,
    links: profileLinks,
    featuredItems: [],
    featuredStories: []
  });

  const importedReleases: Array<{
    id: string;
    item: ArtistProfileFeaturedItem;
    isFeatured: boolean;
  }> = [];

  for (const [index, sourceRelease] of response.releases.entries()) {
    const releaseId = `artist-intake-${intake.id}-${sourceRelease.id}`;
    const releaseSlug = await uniqueReleaseSlug(
      sourceRelease.title,
      artistSlug,
      releaseId
    );
    const primaryListenUrl =
      sourceRelease.spotifyUrl ||
      sourceRelease.appleMusicUrl ||
      sourceRelease.youtubeUrl;
    const release = createEmptyRelease({
      title: sourceRelease.title,
      slug: releaseSlug,
      catalog_scope: "ARTIST",
      primary_artist_profile_id: artistProfileId,
      release_date: sourceRelease.releaseDate,
      collaborator: Boolean(sourceRelease.collaborators.trim()),
      collaborator_name: sourceRelease.collaborators,
      streaming_links: {
        spotify: sourceRelease.spotifyUrl,
        apple_music: sourceRelease.appleMusicUrl,
        youtube: sourceRelease.youtubeUrl
      },
      public_description: sourceRelease.isFeatured
        ? sourceRelease.trackSummary
        : "",
      languages: sourceRelease.languages,
      genres: sourceRelease.genres,
      moods: sourceRelease.moods,
      themes: sourceRelease.themes,
      listener_contexts: sourceRelease.listenerContexts,
      cover_art_alt_text:
        sourceRelease.coverArtAlt ||
        `${sourceRelease.title} cover artwork`,
      featured_video_url: sourceRelease.featuredVideoUrl,
      public_lyrics_enabled:
        Boolean(sourceRelease.lyrics) &&
        sourceRelease.lyricsRightsConfirmed,
      lyrics_rights_confirmed_at: sourceRelease.lyricsRightsConfirmed
        ? new Date().toISOString()
        : ""
    });
    release.id = releaseId;
    release.cover_art_path = sourceRelease.coverArtUrl;
    release.lyrics = sourceRelease.lyrics;
    await saveRelease(release);

    for (const [breakdownIndex, breakdown] of sourceRelease.breakdowns.entries()) {
      const annotationId = `${releaseId}-breakdown-${breakdown.id}`;
      await prisma.releaseAnnotation.upsert({
        where: {id: annotationId},
        create: {
          id: annotationId,
          releaseId,
          type: "lyric_note",
          lyricExcerpt: breakdown.lyricExcerpt,
          excerptSnapshot: breakdown.lyricExcerpt,
          title: `Breakdown suggestion ${breakdownIndex + 1}`,
          summary: breakdown.explanation.slice(0, 300),
          explanation: breakdown.explanation,
          status: "draft",
          confidence: "official_context",
          isPublic: false,
          sortOrder: breakdownIndex,
          sources: breakdown.referenceUrl
            ? {
                create: {
                  id: createId(),
                  label: "Artist reference",
                  url: breakdown.referenceUrl,
                  sortOrder: 0
                }
              }
            : undefined
        },
        update: {
          lyricExcerpt: breakdown.lyricExcerpt,
          excerptSnapshot: breakdown.lyricExcerpt,
          summary: breakdown.explanation.slice(0, 300),
          explanation: breakdown.explanation,
          sortOrder: breakdownIndex
        }
      });
    }

    importedReleases.push({
      id: releaseId,
      isFeatured: sourceRelease.isFeatured,
      item: {
        releaseId,
        itemType: intakeReleaseItemType(sourceRelease.type),
        eyebrow: sourceRelease.isFeatured ? "Start here" : "More from the artist",
        title: sourceRelease.title,
        subtitle: sourceRelease.releaseDate,
        description: sourceRelease.isFeatured
          ? sourceRelease.trackSummary
          : "",
        url: primaryListenUrl,
        coverArtUrl: sourceRelease.coverArtUrl,
        coverArtAlt:
          sourceRelease.coverArtAlt ||
          `${sourceRelease.title} cover artwork`,
        isStartHere: sourceRelease.isFeatured
      }
    });
  }

  const featuredRelease = importedReleases.find((release) => release.isFeatured);
  await saveArtistProfile({
    id: artistProfileId,
    slug: artistSlug,
    displayName: response.artist.displayName,
    privateContactEmail: response.artist.contactEmail,
    location:
      getCountryName(response.artist.countryCode) || response.artist.countryCode,
    locationCountryCode: response.artist.countryCode,
    themeFamily: response.artist.themeFamily,
    longBio: response.artist.soundDescription,
    differentiator: response.artist.differentiator,
    genres: response.artist.genres,
    primaryCtaLabel: featuredRelease ? "Listen now" : "",
    primaryCtaUrl: featuredRelease?.item.url || "",
    profileImagePath: response.artist.profileImageUrl,
    profileImageAlt: response.artist.profileImageAlt,
    pageCopy: DEFAULT_ARTIST_PAGE_COPY,
    expansion: {
      ...DEFAULT_ARTIST_EXPANSION_CONFIG,
      catalogReleaseIds: importedReleases.map((release) => release.id),
      editorialReleaseIds: featuredRelease ? [featuredRelease.id] : []
    },
    links: profileLinks,
    featuredItems: importedReleases.map((release) => release.item),
    featuredStories: []
  });

  const now = new Date();
  await prisma.artistIntake.update({
    where: {id},
    data: {
      status: "CONVERTED",
      reviewedAt: intake.reviewedAt || now,
      convertedAt: now,
      linkedArtistProfileId: artistProfileId,
      updatedAt: now
    }
  });

  return artistProfileId;
}
