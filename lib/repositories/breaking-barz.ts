import "server-only";

import type {Prisma, PrismaClient} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {consumeRateLimit} from "@/lib/public-rate-limit";
import {createId, slugify} from "@/lib/utils";

export const BREAKING_BARZ_PAGE_SIZE = 12;
export const BREAKING_BARZ_EXCERPT_MAX = 600;
export const BREAKING_BARZ_SUMMARY_MAX = 300;
export const BREAKING_BARZ_BREAKDOWN_MAX = 8000;

export const BREAKING_BARZ_VERIFICATION_STATUSES = [
  "interpretation",
  "verified_breakdown",
  "artist_breakdown"
] as const;

export type BreakingBarzVerificationStatus =
  (typeof BREAKING_BARZ_VERIFICATION_STATUSES)[number];

type BreakingBarzWriteClient = Prisma.TransactionClient | PrismaClient;

type SourceInput = {label: string; url: string};

export type BreakingBarzEditorInput = {
  id?: string;
  songTitle: string;
  artistNames: string[];
  lyricExcerpt: string;
  summary: string;
  breakdown: string;
  verificationStatus: string;
  verificationNote?: string;
  categorySlugs: string[];
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  sources?: SourceInput[];
  action: "draft" | "publish" | "archive" | "withdraw";
};

const publicEntryInclude = {
  currentPublishedVersion: {
    include: {sources: {orderBy: {sortOrder: "asc" as const}}}
  },
  categories: {
    include: {category: true},
    orderBy: {category: {sortOrder: "asc" as const}}
  },
  release: {
    select: {
      id: true,
      slug: true,
      coverArtPath: true,
      coverArtUrl: true,
      coverArtAltText: true,
      isPublished: true
    }
  }
};

type PublicEntryRow = Prisma.BreakingBarzEntryGetPayload<{
  include: typeof publicEntryInclude;
}>;

export function parseBreakingBarzArtistNames(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function normalizeArtistNames(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)
    .slice(0, 8);
}

function normalizeOptionalUrl(value: string | null | undefined, label: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
}

function normalizeSources(values: SourceInput[] = []) {
  return values
    .filter((source) => source.label.trim() || source.url.trim())
    .map((source) => ({
      label: (source.label.trim() || "Source").slice(0, 120),
      url: normalizeOptionalUrl(source.url, "Source URL")
    }))
    .filter((source) => source.url)
    .slice(0, 8);
}

function normalizeVerificationStatus(value: string): BreakingBarzVerificationStatus {
  return BREAKING_BARZ_VERIFICATION_STATUSES.includes(
    value as BreakingBarzVerificationStatus
  )
    ? (value as BreakingBarzVerificationStatus)
    : "interpretation";
}

function normalizeEntryInput(input: BreakingBarzEditorInput) {
  const songTitle = input.songTitle.trim();
  const artistNames = normalizeArtistNames(input.artistNames);
  const lyricExcerpt = input.lyricExcerpt.trim();
  const summary = input.summary.trim();
  const breakdown = input.breakdown.trim();
  if (!songTitle || songTitle.length > 160) {
    throw new Error("Song title is required and must be 160 characters or fewer.");
  }
  if (!artistNames.length) throw new Error("Add at least one artist.");
  if (!lyricExcerpt || lyricExcerpt.length > BREAKING_BARZ_EXCERPT_MAX) {
    throw new Error(`Lyric excerpt is required and must be ${BREAKING_BARZ_EXCERPT_MAX} characters or fewer.`);
  }
  if (!summary || summary.length > BREAKING_BARZ_SUMMARY_MAX) {
    throw new Error(`Summary is required and must be ${BREAKING_BARZ_SUMMARY_MAX} characters or fewer.`);
  }
  if (!breakdown || breakdown.length > BREAKING_BARZ_BREAKDOWN_MAX) {
    throw new Error(`Breakdown is required and must be ${BREAKING_BARZ_BREAKDOWN_MAX.toLocaleString()} characters or fewer.`);
  }
  return {
    songTitle,
    artistNames,
    lyricExcerpt,
    summary,
    breakdown,
    verificationStatus: normalizeVerificationStatus(input.verificationStatus),
    verificationNote: input.verificationNote?.trim().slice(0, 2000) || "",
    categorySlugs: input.categorySlugs.map(slugify).filter(Boolean).slice(0, 8),
    spotifyUrl: normalizeOptionalUrl(input.spotifyUrl, "Spotify URL"),
    appleMusicUrl: normalizeOptionalUrl(input.appleMusicUrl, "Apple Music URL"),
    youtubeUrl: normalizeOptionalUrl(input.youtubeUrl, "YouTube URL"),
    sources: normalizeSources(input.sources)
  };
}

function categorySlugsForLegacyType(value: string) {
  const map: Record<string, string[]> = {
    punchline: ["punchline"],
    double_meaning: ["double-meaning"],
    metaphor_wordplay: ["metaphor", "wordplay"],
    anime_reference: ["anime-reference", "lore-reference"],
    game_reference: ["gaming-reference", "lore-reference"],
    character_lore: ["lore-reference"],
    story: ["storytelling"],
    reference: ["lore-reference"]
  };
  return map[value] ?? ["other"];
}

function verificationForLegacyConfidence(value: string): BreakingBarzVerificationStatus {
  if (value === "interpretive" || value === "needs_review") return "interpretation";
  return "verified_breakdown";
}

async function replaceEntryCategories(
  client: BreakingBarzWriteClient,
  entryId: string,
  slugs: string[]
) {
  const normalized = [...new Set(slugs.map(slugify).filter(Boolean))];
  const categories = normalized.length
    ? await client.breakingBarzCategory.findMany({
        where: {slug: {in: normalized}, isActive: true},
        select: {id: true}
      })
    : [];
  await client.breakingBarzEntryCategory.deleteMany({where: {entryId}});
  if (categories.length) {
    await client.breakingBarzEntryCategory.createMany({
      data: categories.map((category) => ({entryId, categoryId: category.id}))
    });
  }
}

async function saveVersion(
  client: BreakingBarzWriteClient,
  entry: {id: string; currentPublishedVersionId: string | null},
  content: ReturnType<typeof normalizeEntryInput>,
  publish: boolean
) {
  const latest = await client.breakingBarzVersion.findFirst({
    where: {entryId: entry.id},
    orderBy: {version: "desc"},
    include: {sources: {orderBy: {sortOrder: "asc"}}}
  });
  const now = new Date();
  const sameContent = Boolean(
    latest &&
      latest.songTitle === content.songTitle &&
      latest.artistNames === JSON.stringify(content.artistNames) &&
      latest.spotifyUrl === content.spotifyUrl &&
      latest.appleMusicUrl === content.appleMusicUrl &&
      latest.youtubeUrl === content.youtubeUrl &&
      latest.categorySlugs === JSON.stringify(content.categorySlugs) &&
      latest.lyricExcerpt === content.lyricExcerpt &&
      latest.summary === content.summary &&
      latest.breakdown === content.breakdown &&
      latest.verificationStatus === content.verificationStatus &&
      latest.verificationNote === content.verificationNote &&
      JSON.stringify(latest.sources.map(({label, url}) => ({label, url}))) ===
        JSON.stringify(content.sources)
  );
  let versionId = latest?.id || "";

  if (latest?.editorialStatus === "draft") {
    versionId = latest.id;
    await client.breakingBarzVersion.update({
      where: {id: latest.id},
      data: {
        songTitle: content.songTitle,
        artistNames: JSON.stringify(content.artistNames),
        spotifyUrl: content.spotifyUrl,
        appleMusicUrl: content.appleMusicUrl,
        youtubeUrl: content.youtubeUrl,
        categorySlugs: JSON.stringify(content.categorySlugs),
        lyricExcerpt: content.lyricExcerpt,
        summary: content.summary,
        breakdown: content.breakdown,
        verificationStatus: content.verificationStatus,
        verificationNote: content.verificationNote,
        editorialStatus: publish ? "published" : "draft",
        publishedAt: publish ? now : null
      }
    });
    await client.breakingBarzVersionSource.deleteMany({where: {versionId: latest.id}});
  } else if (!sameContent || !latest) {
    versionId = createId();
    await client.breakingBarzVersion.create({
      data: {
        id: versionId,
        entryId: entry.id,
        version: (latest?.version ?? 0) + 1,
        songTitle: content.songTitle,
        artistNames: JSON.stringify(content.artistNames),
        spotifyUrl: content.spotifyUrl,
        appleMusicUrl: content.appleMusicUrl,
        youtubeUrl: content.youtubeUrl,
        categorySlugs: JSON.stringify(content.categorySlugs),
        lyricExcerpt: content.lyricExcerpt,
        summary: content.summary,
        breakdown: content.breakdown,
        verificationStatus: content.verificationStatus,
        verificationNote: content.verificationNote,
        editorialStatus: publish ? "published" : "draft",
        publishedAt: publish ? now : null
      }
    });
  }

  if (content.sources.length && versionId && (!sameContent || latest?.editorialStatus === "draft")) {
    await client.breakingBarzVersionSource.createMany({
      data: content.sources.map((source, index) => ({
        id: createId(),
        versionId,
        ...source,
        sortOrder: index
      }))
    });
  }

  if (publish && versionId) {
    if (entry.currentPublishedVersionId && entry.currentPublishedVersionId !== versionId) {
      await client.breakingBarzVersion.update({
        where: {id: entry.currentPublishedVersionId},
        data: {editorialStatus: "superseded"}
      });
    }
    await replaceEntryCategories(client, entry.id, content.categorySlugs);
    await client.breakingBarzEntry.update({
      where: {id: entry.id},
      data: {
        currentPublishedVersionId: versionId,
        songTitle: content.songTitle,
        artistNames: JSON.stringify(content.artistNames),
        spotifyUrl: content.spotifyUrl,
        appleMusicUrl: content.appleMusicUrl,
        youtubeUrl: content.youtubeUrl,
        status: "published",
        publishedAt: now,
        archivedAt: null,
        withdrawnAt: null
      }
    });
  }
  return versionId;
}

function toPublicEntry(row: PublicEntryRow) {
  const version = row.currentPublishedVersion;
  if (!version) return null;
  return {
    id: row.id,
    slug: row.slug,
    releaseId: row.releaseId,
    releaseSlug: row.release?.slug || "",
    songTitle: version.songTitle,
    artistNames: parseBreakingBarzArtistNames(version.artistNames),
    spotifyUrl: version.spotifyUrl,
    appleMusicUrl: version.appleMusicUrl,
    youtubeUrl: version.youtubeUrl,
    coverArtUrl: row.release?.coverArtPath || row.release?.coverArtUrl || "",
    coverArtAlt: row.release?.coverArtAltText || `${row.songTitle} cover art`,
    publishedAt: (version.publishedAt || row.publishedAt || row.updatedAt).toISOString(),
    version: {
      id: version.id,
      number: version.version,
      lyricExcerpt: version.lyricExcerpt,
      summary: version.summary,
      breakdown: version.breakdown,
      verificationStatus: normalizeVerificationStatus(version.verificationStatus),
      sources: version.sources.map(({label, url}) => ({label, url}))
    },
    categories: row.categories.map(({category}) => ({
      id: category.id,
      name: category.name,
      slug: category.slug
    }))
  };
}

export type PublicBreakingBarzEntry = NonNullable<ReturnType<typeof toPublicEntry>>;

export async function syncReleaseAnnotationToBreakingBarz(
  client: BreakingBarzWriteClient,
  input: {
    annotationId: string;
    release: {
      id: string;
      title: string;
      catalogScope: string;
      collaborator: boolean;
      collaboratorName: string;
      spotifyUrl: string;
      appleMusicUrl: string;
      youtubeUrl: string;
      primaryArtistProfile: {displayName: string} | null;
      artistCredits: Array<{artistProfile: {displayName: string}}>;
    };
    annotation: {
      title: string;
      type: string;
      excerpt: string;
      summary: string;
      breakdown: string;
      confidence: string;
      sources: SourceInput[];
    };
    action: "draft" | "publish" | "archive";
  }
) {
  const existing = await client.breakingBarzEntry.findUnique({
    where: {releaseAnnotationId: input.annotationId},
    select: {id: true, slug: true, currentPublishedVersionId: true}
  });
  if (input.action === "archive") {
    if (existing) {
      await client.breakingBarzEntry.update({
        where: {id: existing.id},
        data: {status: "archived", archivedAt: new Date()}
      });
    }
    return existing;
  }

  const artists = normalizeArtistNames([
    input.release.primaryArtistProfile?.displayName ||
      (input.release.catalogScope === "ARTIST" ? "" : "vvviruz"),
    ...input.release.artistCredits.map((credit) => credit.artistProfile.displayName),
    ...(input.release.collaborator ? input.release.collaboratorName.split(/\s*(?:,|&|\bfeat\.?\b)\s*/i) : [])
  ]);
  const content = normalizeEntryInput({
    songTitle: input.release.title,
    artistNames: artists.length ? artists : ["vvviruz"],
    lyricExcerpt: input.annotation.excerpt,
    summary: input.annotation.summary,
    breakdown: input.annotation.breakdown,
    verificationStatus: verificationForLegacyConfidence(input.annotation.confidence),
    verificationNote: "",
    categorySlugs: categorySlugsForLegacyType(input.annotation.type),
    spotifyUrl: input.release.spotifyUrl,
    appleMusicUrl: input.release.appleMusicUrl,
    youtubeUrl: input.release.youtubeUrl,
    sources: input.annotation.sources,
    action: input.action
  });
  const entryId = existing?.id || createId();
  const entry = existing
    ? await client.breakingBarzEntry.findUniqueOrThrow({
        where: {id: entryId},
        select: {id: true, currentPublishedVersionId: true}
      })
    : await client.breakingBarzEntry.create({
        data: {
          id: entryId,
          slug: `${slugify(input.annotation.title || input.release.title) || "bar"}-${input.annotationId.slice(0, 8)}`,
          releaseId: input.release.id,
          releaseAnnotationId: input.annotationId,
          songTitle: content.songTitle,
          artistNames: JSON.stringify(content.artistNames),
          spotifyUrl: content.spotifyUrl,
          appleMusicUrl: content.appleMusicUrl,
          youtubeUrl: content.youtubeUrl,
          status: "draft"
        },
        select: {id: true, currentPublishedVersionId: true}
      });
  if (!entry.currentPublishedVersionId) {
    await replaceEntryCategories(client, entry.id, content.categorySlugs);
  }
  await saveVersion(client, entry, content, input.action === "publish");
  return entry;
}

export async function listPublicBreakingBarz(input: {
  page?: number;
  artist?: string;
  release?: string;
  song?: string;
  category?: string;
}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const where: Prisma.BreakingBarzEntryWhereInput = {
    status: "published",
    archivedAt: null,
    withdrawnAt: null,
    currentPublishedVersionId: {not: null},
    OR: [{releaseId: null}, {release: {isPublished: true}}],
    ...(input.artist?.trim()
      ? {artistNames: {contains: input.artist.trim()}}
      : {}),
    ...(input.release?.trim() ? {release: {slug: input.release.trim(), isPublished: true}} : {}),
    ...(input.song?.trim() ? {songTitle: input.song.trim()} : {}),
    ...(input.category?.trim()
      ? {categories: {some: {category: {slug: input.category.trim(), isActive: true}}}}
      : {})
  };
  const [rows, total] = await Promise.all([
    prisma.breakingBarzEntry.findMany({
      where,
      include: publicEntryInclude,
      orderBy: [{publishedAt: "desc"}, {id: "asc"}],
      skip: (page - 1) * BREAKING_BARZ_PAGE_SIZE,
      take: BREAKING_BARZ_PAGE_SIZE
    }),
    prisma.breakingBarzEntry.count({where})
  ]);
  return {
    entries: rows.flatMap((row) => {
      const entry = toPublicEntry(row);
      return entry ? [entry] : [];
    }),
    page,
    pageSize: BREAKING_BARZ_PAGE_SIZE,
    total,
    hasMore: page * BREAKING_BARZ_PAGE_SIZE < total
  };
}

export async function getPublicBreakingBarzEntry(slug: string) {
  const row = await prisma.breakingBarzEntry.findFirst({
    where: {
      slug,
      status: "published",
      archivedAt: null,
      withdrawnAt: null,
      currentPublishedVersionId: {not: null},
      OR: [{releaseId: null}, {release: {isPublished: true}}]
    },
    include: publicEntryInclude
  });
  return row ? toPublicEntry(row) : null;
}

export async function listBreakingBarzFilterOptions() {
  const [entries, categories] = await Promise.all([
    prisma.breakingBarzEntry.findMany({
      where: {
        status: "published",
        archivedAt: null,
        withdrawnAt: null,
        currentPublishedVersionId: {not: null},
        OR: [{releaseId: null}, {release: {isPublished: true}}]
      },
      select: {artistNames: true, songTitle: true}
    }),
    prisma.breakingBarzCategory.findMany({
      where: {
        isActive: true,
        entries: {
          some: {
            entry: {
              status: "published",
              archivedAt: null,
              withdrawnAt: null,
              currentPublishedVersionId: {not: null},
              OR: [{releaseId: null}, {release: {isPublished: true}}]
            }
          }
        }
      },
      orderBy: [{sortOrder: "asc"}, {name: "asc"}],
      select: {name: true, slug: true}
    })
  ]);
  return {
    artists: [
      ...new Set(entries.flatMap((entry) => parseBreakingBarzArtistNames(entry.artistNames)))
    ].sort(),
    categories,
    songs: [...new Set(entries.map((entry) => entry.songTitle))].sort()
  };
}

export async function createBreakingBarzSubmission(input: {
  songTitle: string;
  artistNames: string[];
  lyricExcerpt: string;
  summary?: string;
  breakdown?: string;
  songUrl?: string;
  submitterName?: string;
  submitterEmail?: string;
  ipAddress: string;
}) {
  const rateLimit = await consumeRateLimit({
    bucket: "breaking-barz-submission",
    key: input.ipAddress,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000
  });
  if (!rateLimit.allowed) throw new Error("Too many suggestions. Try again later.");
  const songTitle = input.songTitle.trim();
  const artistNames = normalizeArtistNames(input.artistNames);
  const lyricExcerpt = input.lyricExcerpt.trim();
  if (!songTitle || songTitle.length > 160) throw new Error("Add a valid song title.");
  if (!artistNames.length) throw new Error("Add at least one artist.");
  if (!lyricExcerpt || lyricExcerpt.length > BREAKING_BARZ_EXCERPT_MAX) {
    throw new Error(`The suggested lines must be ${BREAKING_BARZ_EXCERPT_MAX} characters or fewer.`);
  }
  return prisma.breakingBarzSubmission.create({
    data: {
      id: createId(),
      songTitle,
      artistNames: JSON.stringify(artistNames),
      lyricExcerpt,
      summary: input.summary?.trim().slice(0, BREAKING_BARZ_SUMMARY_MAX) || "",
      breakdown: input.breakdown?.trim().slice(0, 4000) || "",
      songUrl: normalizeOptionalUrl(input.songUrl, "Song link"),
      submitterName: input.submitterName?.trim().slice(0, 120) || "",
      submitterEmail: input.submitterEmail?.trim().toLowerCase().slice(0, 320) || ""
    }
  });
}

export async function listAdminBreakingBarz() {
  const [entries, submissions, categories] = await Promise.all([
    prisma.breakingBarzEntry.findMany({
      include: {
        versions: {orderBy: {version: "desc"}, take: 1, include: {sources: true}},
        currentPublishedVersion: true,
        categories: {include: {category: true}},
        release: {select: {title: true, slug: true}}
      },
      orderBy: {updatedAt: "desc"}
    }),
    prisma.breakingBarzSubmission.findMany({orderBy: {submittedAt: "desc"}}),
    prisma.breakingBarzCategory.findMany({where: {isActive: true}, orderBy: [{sortOrder: "asc"}, {name: "asc"}]})
  ]);
  return {entries, submissions, categories};
}

export async function saveExternalBreakingBarzEntry(input: BreakingBarzEditorInput) {
  return prisma.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.breakingBarzEntry.findUnique({
          where: {id: input.id},
          select: {id: true, slug: true, releaseAnnotationId: true, currentPublishedVersionId: true}
        })
      : null;
    if (input.id && !existing) throw new Error("Breaking Barz entry not found.");
    if (existing?.releaseAnnotationId) {
      throw new Error("Edit release-linked entries from the matching Release Detail page.");
    }
    if (input.action === "archive" || input.action === "withdraw") {
      if (!existing) throw new Error("Choose an entry first.");
      return tx.breakingBarzEntry.update({
        where: {id: existing.id},
        data:
          input.action === "archive"
            ? {status: "archived", archivedAt: new Date()}
            : {status: "withdrawn", withdrawnAt: new Date()}
      });
    }
    const content = normalizeEntryInput(input);
    const id = existing?.id || createId();
    const entry = existing
      ? await tx.breakingBarzEntry.findUniqueOrThrow({
          where: {id},
          select: {id: true, currentPublishedVersionId: true}
        })
      : await tx.breakingBarzEntry.create({
          data: {
            id,
            slug: `${slugify(content.songTitle) || "bar"}-${id.slice(0, 8)}`,
            songTitle: content.songTitle,
            artistNames: JSON.stringify(content.artistNames),
            spotifyUrl: content.spotifyUrl,
            appleMusicUrl: content.appleMusicUrl,
            youtubeUrl: content.youtubeUrl
          },
          select: {id: true, currentPublishedVersionId: true}
        });
    if (!entry.currentPublishedVersionId) {
      await replaceEntryCategories(tx, entry.id, content.categorySlugs);
    }
    await saveVersion(tx, entry, content, input.action === "publish");
    return entry;
  });
}

export async function reviewBreakingBarzSubmission(input: {
  id: string;
  action: "reject" | "publish";
  entry?: BreakingBarzEditorInput;
  reviewNote?: string;
}) {
  const submission = await prisma.breakingBarzSubmission.findUnique({where: {id: input.id}});
  if (!submission || submission.status !== "pending") throw new Error("Pending suggestion not found.");
  if (input.action === "reject") {
    return prisma.breakingBarzSubmission.update({
      where: {id: input.id},
      data: {status: "rejected", reviewNote: input.reviewNote?.trim().slice(0, 2000) || "", reviewedAt: new Date()}
    });
  }
  if (!input.entry) throw new Error("Complete the public entry before publishing.");
  const entry = await saveExternalBreakingBarzEntry({...input.entry, action: "publish"});
  return prisma.breakingBarzSubmission.update({
    where: {id: input.id},
    data: {status: "published", promotedEntryId: entry.id, reviewNote: input.reviewNote?.trim().slice(0, 2000) || "", reviewedAt: new Date()}
  });
}

export async function getPublishedBreakingBarzSitemapEntries() {
  return prisma.breakingBarzEntry.findMany({
    where: {
      status: "published",
      archivedAt: null,
      withdrawnAt: null,
      currentPublishedVersionId: {not: null},
      OR: [{releaseId: null}, {release: {isPublished: true}}]
    },
    select: {slug: true, updatedAt: true}
  });
}
