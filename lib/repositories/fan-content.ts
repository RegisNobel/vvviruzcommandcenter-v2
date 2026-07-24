import "server-only";

import type {Prisma} from "@prisma/client";
import {unstable_cache} from "next/cache";

import {prisma} from "@/lib/db/prisma";
import type {
  PublicFanUpdate,
  PublicReleaseAnnotation,
  ReleaseAnnotationRecord,
  PublicVaultItem
} from "@/lib/types";
import {createId, slugify} from "@/lib/utils";
import {LATEST_INTEL_PUBLIC_LIMIT} from "@/lib/latest-intel";
import {
  createReleaseAnnotationAnchor,
  rebaseReleaseAnnotationAnchor,
  validateReleaseAnnotationAnchor
} from "@/lib/server/release-annotation-anchors";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const ANNOTATION_TYPES = new Set([
  "punchline",
  "double_meaning",
  "anime_reference",
  "game_reference",
  "character_lore",
  "language_translation",
  "personal_context",
  "production_detail",
  "sample",
  "collaborator_note",
  "lyric_note",
  "reference",
  "story",
  "language"
]);
const ANNOTATION_CONFIDENCE = new Set([
  "verified",
  "official_context",
  "interpretive",
  "needs_review"
]);
const ANNOTATION_ACTIONS = new Set(["draft", "publish", "archive"]);
export const PUBLIC_LATEST_INTEL_CACHE_TAG = "latest-intel-public";

function requirePublicUrl(value: string, field: string) {
  const normalized = value.trim();
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      throw new Error(`${field} must use an internal path or an http/https URL.`);
    }
    return normalized;
  }

  const parsed = new URL(normalized);
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${field} must use http or https.`);
  }
  return normalized;
}

function requireExternalSourceUrl(value: string, field: string) {
  const parsed = new URL(value.trim());
  if (!HTTP_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${field} must be a safe http or https URL without credentials.`);
  }
  return parsed.toString();
}

const annotationInclude = {
  sources: {orderBy: {sortOrder: "asc" as const}}
};

type AnnotationRow = Prisma.ReleaseAnnotationGetPayload<{
  include: typeof annotationInclude;
}>;

function toAnnotationRecord(row: AnnotationRow, lyrics: string): ReleaseAnnotationRecord {
  const validation = validateReleaseAnnotationAnchor(lyrics, row);
  return {
    id: row.id,
    release_id: row.releaseId,
    type: row.type,
    lyric_excerpt: row.excerptSnapshot || row.lyricExcerpt,
    summary: row.summary,
    title: row.title,
    explanation: row.explanation,
    confidence: row.confidence,
    anchor_version: row.anchorVersion ?? 0,
    section_key: row.sectionKey ?? "",
    section_occurrence: row.sectionOccurrence ?? 0,
    start_line_index: row.startLineIndex ?? 0,
    end_line_index: row.endLineIndex ?? 0,
    sources: row.sources.map((source) => ({label: source.label, url: source.url})),
    status: (["draft", "ready", "needs_reanchoring", "archived"].includes(row.status)
      ? row.status
      : "needs_reanchoring") as ReleaseAnnotationRecord["status"],
    is_public: row.isPublic,
    sort_order: row.sortOrder,
    anchor_error: validation.valid ? "" : validation.reason,
    updated_at: row.updatedAt.toISOString()
  };
}

export async function listAdminFanContent() {
  const [annotations, fanUpdates, vaultItems, releases] = await Promise.all([
    prisma.releaseAnnotation.findMany({include: {release: {select: {title: true}}, sources: {orderBy: {sortOrder: "asc"}}}, orderBy: [{releaseId: "asc"}, {sortOrder: "asc"}]}),
    prisma.fanUpdate.findMany({include: {release: {select: {title: true}}}, orderBy: [{publishedAt: "desc"}, {updatedAt: "desc"}]}),
    prisma.vaultItem.findMany({include: {release: {select: {title: true}}}, orderBy: [{sortOrder: "asc"}, {updatedAt: "desc"}]}),
    prisma.release.findMany({select: {id: true, title: true, slug: true, isPublished: true}, orderBy: {title: "asc"}})
  ]);
  return {annotations, fanUpdates, vaultItems, releases};
}

export async function listReleaseAnnotations(releaseId: string) {
  const [release, rows] = await Promise.all([
    prisma.release.findUnique({where: {id: releaseId}, select: {lyrics: true}}),
    prisma.releaseAnnotation.findMany({
      where: {releaseId},
      include: annotationInclude,
      orderBy: [{sortOrder: "asc"}, {updatedAt: "desc"}]
    })
  ]);
  if (!release) throw new Error("Release not found.");
  return rows.map((row) => toAnnotationRecord(row, release.lyrics));
}

export async function saveReleaseAnnotation(input: {
  id?: string;
  releaseId: string;
  type: string;
  title: string;
  summary: string;
  explanation: string;
  confidence: string;
  sectionKey: string;
  sectionOccurrence: number;
  startLineIndex: number;
  endLineIndex: number;
  action: string;
  sources: Array<{label: string; url: string}>;
}) {
  if (!input.releaseId) throw new Error("Release is required.");
  if (!ANNOTATION_ACTIONS.has(input.action)) throw new Error("Unsupported annotation action.");
  const title = input.title.trim();
  const summary = input.summary.trim();
  const explanation = input.explanation.trim();
  if (!title || title.length > 80) throw new Error("Title is required and must be 80 characters or fewer.");
  if (!summary || summary.length > 300) throw new Error("Summary is required and must be 300 characters or fewer.");
  if (!explanation || explanation.length > 8000) throw new Error("Breakdown is required and must be 8,000 characters or fewer.");

  const type = ANNOTATION_TYPES.has(input.type) ? input.type : "lyric_note";
  const confidence = ANNOTATION_CONFIDENCE.has(input.confidence)
    ? input.confidence
    : "official_context";
  const sources = input.sources
    .filter((source) => source.label.trim() || source.url.trim())
    .map((source) => {
      const label = source.label.trim() || "Source";
      if (label.length > 120) throw new Error("Source labels must be 120 characters or fewer.");
      if (!source.url.trim()) throw new Error("Each source needs a URL.");
      return {label, url: requireExternalSourceUrl(source.url, "Source URL")};
    });

  return prisma.$transaction(async (tx) => {
    const [release, existingAnnotation] = await Promise.all([
      tx.release.findUnique({
        where: {id: input.releaseId},
        select: {lyrics: true}
      }),
      input.id
        ? tx.releaseAnnotation.findUnique({
            where: {id: input.id},
            select: {releaseId: true, status: true}
          })
        : null
    ]);
    if (!release) throw new Error("Release not found.");
    if (input.id && (!existingAnnotation || existingAnnotation.releaseId !== input.releaseId)) {
      throw new Error("Annotation not found for this release.");
    }

    if (input.action === "archive") {
      if (!input.id) throw new Error("Choose an annotation to archive.");
      return tx.releaseAnnotation.update({
        where: {id: input.id},
        data: {status: "archived", isPublic: false, updatedAt: new Date()}
      });
    }
    if (input.action === "publish" && existingAnnotation?.status === "needs_reanchoring") {
      throw new Error(
        "Re-anchor this annotation privately before publishing it again."
      );
    }

    const anchor = createReleaseAnnotationAnchor({
      lyrics: release.lyrics,
      sectionKey: input.sectionKey,
      sectionOccurrence: input.sectionOccurrence,
      startLineIndex: input.startLineIndex,
      endLineIndex: input.endLineIndex
    });
    const conflicts = await tx.releaseAnnotation.findMany({
      where: {
        releaseId: input.releaseId,
        status: {in: ["draft", "ready"]},
        ...(input.id ? {id: {not: input.id}} : {}),
        sectionKey: anchor.sectionKey,
        sectionOccurrence: anchor.sectionOccurrence,
        startLineIndex: {not: null},
        endLineIndex: {not: null}
      },
      select: {id: true, title: true, startLineIndex: true, endLineIndex: true}
    });
    const overlap = conflicts.find(
      (candidate) =>
        (candidate.startLineIndex ?? Number.MAX_SAFE_INTEGER) <= anchor.endLineIndex &&
        (candidate.endLineIndex ?? Number.MIN_SAFE_INTEGER) >= anchor.startLineIndex
    );
    if (overlap) throw new Error(`This range overlaps "${overlap.title}".`);

    const now = new Date();
    const status = input.action === "draft" ? "draft" : "ready";
    const isPublic = input.action === "publish";
    const data = {
      type,
      title,
      summary,
      explanation,
      confidence,
      lyricExcerpt: anchor.excerptSnapshot,
      ...anchor,
      status,
      isPublic,
      lastReviewedAt: isPublic ? now : null,
      updatedAt: now
    };

    const annotation = input.id
      ? await tx.releaseAnnotation.update({where: {id: input.id}, data})
      : await tx.releaseAnnotation.create({
          data: {id: createId(), releaseId: input.releaseId, ...data, createdAt: now}
        });
    await tx.releaseAnnotationSource.deleteMany({where: {annotationId: annotation.id}});
    if (sources.length) {
      await tx.releaseAnnotationSource.createMany({
        data: sources.map((source, index) => ({
          id: createId(),
          annotationId: annotation.id,
          ...source,
          sortOrder: index,
          createdAt: now,
          updatedAt: now
        }))
      });
    }
    return annotation;
  });
}

export async function revalidateReleaseAnnotationsInTransaction(
  tx: Prisma.TransactionClient,
  input: {releaseId: string; oldLyrics: string; newLyrics: string}
) {
  const annotations = await tx.releaseAnnotation.findMany({
    where: {releaseId: input.releaseId, status: {not: "archived"}}
  });
  let needsReanchoring = 0;

  for (const annotation of annotations) {
    const validation = rebaseReleaseAnnotationAnchor({
      oldLyrics: input.oldLyrics,
      newLyrics: input.newLyrics,
      anchor: annotation
    });
    if (!validation.valid) {
      needsReanchoring += 1;
      await tx.releaseAnnotation.update({
        where: {id: annotation.id},
        data: {status: "needs_reanchoring", isPublic: false, updatedAt: new Date()}
      });
      continue;
    }
    await tx.releaseAnnotation.update({
      where: {id: annotation.id},
      data: {
        ...validation.anchor,
        lyricExcerpt: validation.anchor.excerptSnapshot,
        updatedAt: new Date()
      }
    });
  }

  return {needsReanchoring};
}

function normalizeFanUpdate(input: {releaseId?: string; type: string; title: string; summary: string; href: string}) {
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (!title || title.length > 140) throw new Error("Update title is required and must be 140 characters or fewer.");
  if (summary.length > 300) throw new Error("Update summary must be 300 characters or fewer.");
  const href = input.href.trim() ? requirePublicUrl(input.href, "Update link") : "";
  return {
    releaseId: input.releaseId || null,
    type: input.type.trim() || "release",
    title,
    summary,
    href
  };
}

export async function createFanUpdate(input: {releaseId?: string; type: string; title: string; summary: string; href: string; isPublished: boolean}) {
  const data = normalizeFanUpdate(input);
  const now = new Date();
  return prisma.fanUpdate.create({data: {
    id: createId(), ...data, isPublished: input.isPublished,
    publishedAt: input.isPublished ? now : null, createdAt: now, updatedAt: now
  }});
}

export async function updateFanUpdate(input: {id: string; releaseId?: string; type: string; title: string; summary: string; href: string}) {
  const existing = await prisma.fanUpdate.findUnique({where: {id: input.id}, select: {id: true}});
  if (!existing) throw new Error("Latest Intel entry not found.");
  return prisma.fanUpdate.update({
    where: {id: input.id},
    data: {...normalizeFanUpdate(input), updatedAt: new Date()}
  });
}

export async function setFanUpdatePublished(id: string, isPublished: boolean) {
  const existing = await prisma.fanUpdate.findUnique({
    where: {id},
    select: {publishedAt: true}
  });
  if (!existing) throw new Error("Latest Intel entry not found.");
  return prisma.fanUpdate.update({
    where: {id},
    data: {
      isPublished,
      // Republishing keeps the original ordering; only the first publish sets this date.
      publishedAt: isPublished ? existing.publishedAt || new Date() : existing.publishedAt,
      updatedAt: new Date()
    }
  });
}

export async function createVaultItem(input: {
  releaseId?: string; title: string; slug?: string; itemType: string; description: string;
  coverArtUrl: string; previewUrl: string; priceLabel: string; checkoutUrl: string; status: string;
}) {
  if (!input.title.trim()) throw new Error("Vault item title is required.");
  const slug = slugify(input.slug || input.title);
  if (!slug) throw new Error("Vault item slug is required.");
  const previewUrl = input.previewUrl.trim() ? requirePublicUrl(input.previewUrl, "Preview URL") : "";
  const checkoutUrl = input.checkoutUrl.trim() ? requirePublicUrl(input.checkoutUrl, "Checkout URL") : "";
  const status = input.status === "public" ? "public" : input.status === "archived" ? "archived" : "draft";
  if (status === "public" && !checkoutUrl) throw new Error("Public Vault items need an external checkout URL.");
  const now = new Date();
  return prisma.vaultItem.create({data: {
    id: createId(), releaseId: input.releaseId || null, title: input.title.trim(), slug,
    itemType: input.itemType.trim() || "track", description: input.description.trim(), coverArtUrl: input.coverArtUrl.trim(),
    previewUrl, priceLabel: input.priceLabel.trim(), checkoutUrl, status, publishedAt: status === "public" ? now : null,
    createdAt: now, updatedAt: now
  }});
}

export async function deleteFanContent(kind: string, id: string) {
  if (kind === "annotation") return prisma.releaseAnnotation.update({where: {id}, data: {status: "archived", isPublic: false}});
  if (kind === "update") return prisma.fanUpdate.delete({where: {id}});
  if (kind === "vault") return prisma.vaultItem.delete({where: {id}});
  throw new Error("Unsupported content type.");
}

export async function listPublicAnnotations(releaseId: string): Promise<PublicReleaseAnnotation[]> {
  const [release, rows] = await Promise.all([
    prisma.release.findUnique({where: {id: releaseId}, select: {lyrics: true}}),
    prisma.releaseAnnotation.findMany({
      where: {releaseId, status: "ready", isPublic: true},
      include: annotationInclude,
      orderBy: [
        {sectionKey: "asc"},
        {sectionOccurrence: "asc"},
        {startLineIndex: "asc"},
        {sortOrder: "asc"}
      ]
    })
  ]);
  if (!release) return [];
  return rows.flatMap((row) => {
    const validation = validateReleaseAnnotationAnchor(release.lyrics, row);
    if (!validation.valid) return [];
    return [{
      id: row.id,
      type: row.type,
      lyric_excerpt: row.excerptSnapshot,
      summary: row.summary,
      title: row.title,
      explanation: row.explanation,
      confidence: row.confidence,
      anchor_version: validation.anchor.anchorVersion,
      section_key: validation.anchor.sectionKey,
      section_occurrence: validation.anchor.sectionOccurrence,
      start_line_index: validation.anchor.startLineIndex,
      end_line_index: validation.anchor.endLineIndex,
      sources: row.sources.map((source) => ({label: source.label, url: source.url}))
    }];
  });
}

const queryPublicFanUpdates = unstable_cache(async (limit: number): Promise<PublicFanUpdate[]> => {
  const rows = await prisma.fanUpdate.findMany({where: {isPublished: true, publishedAt: {not: null}}, orderBy: {publishedAt: "desc"}, take: limit});
  return rows.map((row) => ({id: row.id, type: row.type, title: row.title, summary: row.summary, href: row.href, published_at: row.publishedAt?.toISOString() || row.updatedAt.toISOString()}));
}, ["public-latest-intel"], {revalidate: 300, tags: [PUBLIC_LATEST_INTEL_CACHE_TAG]});

export async function listPublicFanUpdates(limit = LATEST_INTEL_PUBLIC_LIMIT): Promise<PublicFanUpdate[]> {
  const safeLimit = Math.max(1, Math.min(limit, LATEST_INTEL_PUBLIC_LIMIT));
  return queryPublicFanUpdates(safeLimit);
}

export async function listPublicVaultItems(): Promise<PublicVaultItem[]> {
  const rows = await prisma.vaultItem.findMany({where: {status: "public"}, orderBy: [{sortOrder: "asc"}, {publishedAt: "desc"}]});
  return rows.map((row) => ({id: row.id, release_id: row.releaseId, title: row.title, slug: row.slug, item_type: row.itemType, description: row.description, cover_art_url: row.coverArtUrl, preview_url: row.previewUrl, price_label: row.priceLabel, checkout_url: row.checkoutUrl}));
}
