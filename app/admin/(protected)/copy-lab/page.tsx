export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, ChevronDown, PlusCircle, XCircle} from "lucide-react";

import {
  formatContentType,
  formatHookType,
  formatSongSection,
  getCopyHeading
} from "@/lib/copy";
import {prisma} from "@/lib/db/prisma";
import {CopyLabFilters} from "@/components/copy-lab-filters";
import {readCopySummaries} from "@/lib/server/copies";
import {readReleaseSummaries} from "@/lib/server/releases";
import {resolveEffectiveCopyLinksForRelease} from "@/lib/repositories/ads";
import type {CopySummary} from "@/lib/types";

type CopyGroupBy = "release" | "hook-type" | "content-type" | "song-section" | "flat";

type CopyGroup = {
  key: string;
  label: string;
  eyebrow: string;
  copies: CopySummary[];
};

type CopyVariantSet = {
  key: string;
  copies: CopySummary[];
  representative: CopySummary;
};

const copyGroupOptions: Array<{
  key: CopyGroupBy;
  label: string;
  description: string;
}> = [
  {
    key: "release",
    label: "Release",
    description: "Best for campaign planning and avoiding endless standalone scroll."
  },
  {
    key: "hook-type",
    label: "Copy Angle",
    description: "Compare Discovery Shock, Identity Callout, and Proof of Skill angles."
  },
  {
    key: "content-type",
    label: "Content Type",
    description: "Separate AMV, performance, and B-roll creative ideas."
  },
  {
    key: "song-section",
    label: "Song Section",
    description: "Sort copy by hook, verse 1, or verse 2."
  },
  {
    key: "flat",
    label: "Flat",
    description: "Show the full recently-updated list."
  }
];

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function truncate(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function normalizeGroupBy(value: string | undefined): CopyGroupBy {
  return copyGroupOptions.some((option) => option.key === value)
    ? (value as CopyGroupBy)
    : "release";
}

function getGroupHref(
  groupBy: CopyGroupBy,
  releaseId?: string,
  statusFilter?: string,
  archiveFilter?: string
) {
  const params = new URLSearchParams();
  if (groupBy !== "release") {
    params.set("groupBy", groupBy);
  }
  if (releaseId) {
    params.set("releaseId", releaseId);
  }
  if (statusFilter && statusFilter !== "all") {
    params.set("statusFilter", statusFilter);
  }
  if (archiveFilter && archiveFilter !== "active") {
    params.set("archiveFilter", archiveFilter);
  }
  const queryString = params.toString();
  return queryString ? `/admin/copy-lab?${queryString}` : "/admin/copy-lab";
}

function formatCopyCount(count: number) {
  return `${count} cop${count === 1 ? "y" : "ies"}`;
}

function normalizeIdeaText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCopyVariantScopeKey(copy: CopySummary) {
  return [
    copy.release_id ?? "standalone",
    copy.hook_type,
    copy.song_section
  ].join("|");
}

const ideaStopWords = new Set([
  "about",
  "after",
  "again",
  "ahead",
  "and",
  "are",
  "from",
  "for",
  "into",
  "just",
  "lowkey",
  "may",
  "new",
  "not",
  "off",
  "still",
  "that",
  "the",
  "this",
  "was",
  "went",
  "when",
  "while",
  "with",
  "would",
  "you",
  "your"
]);

function getIdeaTokens(value: string) {
  return normalizeIdeaText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length > 2 &&
        !ideaStopWords.has(token) &&
        !/^\d+(st|nd|rd|th)?$/.test(token)
    );
}

function getTokenOverlap(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const smallestSet = leftSet.size <= rightSet.size ? leftSet : rightSet;
  const largestSet = leftSet.size <= rightSet.size ? rightSet : leftSet;

  if (smallestSet.size === 0) {
    return {
      count: 0,
      ratio: 0
    };
  }

  let count = 0;

  for (const token of smallestSet) {
    if (largestSet.has(token)) {
      count += 1;
    }
  }

  return {
    count,
    ratio: count / smallestSet.size
  };
}

function isSameCopyIdea(left: CopySummary, right: CopySummary) {
  if (getCopyVariantScopeKey(left) !== getCopyVariantScopeKey(right)) {
    return false;
  }

  const leftHook = normalizeIdeaText(left.hook);
  const rightHook = normalizeIdeaText(right.hook);
  const leftCaption = normalizeIdeaText(left.caption);
  const rightCaption = normalizeIdeaText(right.caption);

  if (leftHook && leftHook === rightHook && leftCaption === rightCaption) {
    return true;
  }

  const hookOverlap = getTokenOverlap(getIdeaTokens(left.hook), getIdeaTokens(right.hook));
  const captionOverlap = getTokenOverlap(getIdeaTokens(left.caption), getIdeaTokens(right.caption));
  const combinedOverlap = getTokenOverlap(
    getIdeaTokens(`${left.hook} ${left.caption}`),
    getIdeaTokens(`${right.hook} ${right.caption}`)
  );

  return (
    (hookOverlap.count >= 4 && hookOverlap.ratio >= 0.8 && captionOverlap.ratio >= 0.6) ||
    (captionOverlap.count >= 5 && captionOverlap.ratio >= 0.85 && hookOverlap.ratio >= 0.45) ||
    (combinedOverlap.count >= 7 && combinedOverlap.ratio >= 0.82)
  );
}

function hasContentVariants(variantSet: CopyVariantSet) {
  return new Set(variantSet.copies.map((copy) => copy.content_type)).size > 1;
}

function groupCopyVariants(copies: CopySummary[]) {
  const variantSets: CopyVariantSet[] = [];

  for (const copy of copies) {
    const existingSet = variantSets.find((variantSet) =>
      isSameCopyIdea(copy, variantSet.representative)
    );

    if (existingSet) {
      existingSet.copies.push(copy);
      continue;
    }

    variantSets.push({
      key: `${getCopyVariantScopeKey(copy)}:${copy.id}`,
      copies: [copy],
      representative: copy
    });
  }

  return variantSets;
}

function getCopyGroup(
  copy: CopySummary,
  groupBy: CopyGroupBy,
  releaseTitleById: Map<string, string>
): Omit<CopyGroup, "copies"> {
  if (groupBy === "hook-type") {
    const label = formatHookType(copy.hook_type);

    return {
      eyebrow: "Copy angle",
      key: `hook-type:${copy.hook_type}`,
      label
    };
  }

  if (groupBy === "content-type") {
    const label = formatContentType(copy.content_type);

    return {
      eyebrow: "Content type (Legacy)",
      key: `content-type:${copy.content_type}`,
      label
    };
  }

  if (groupBy === "song-section") {
    const label = formatSongSection(copy.song_section);

    return {
      eyebrow: "Song section (Legacy)",
      key: `song-section:${copy.song_section}`,
      label
    };
  }

  if (groupBy === "flat") {
    return {
      eyebrow: "Recently updated",
      key: "flat:all",
      label: "All Copy"
    };
  }

  const label = copy.release_id
    ? (releaseTitleById.get(copy.release_id) ?? "Linked Release")
    : "Standalone";

  return {
    eyebrow: copy.release_id ? "Release" : "Reusable copy bank",
    key: `release:${copy.release_id ?? "standalone"}`,
    label
  };
}

function groupCopies(
  copies: CopySummary[],
  groupBy: CopyGroupBy,
  releaseTitleById: Map<string, string>
) {
  const groups = new Map<string, CopyGroup>();

  for (const copy of copies) {
    const group = getCopyGroup(copy, groupBy, releaseTitleById);
    const existingGroup = groups.get(group.key);

    if (existingGroup) {
      existingGroup.copies.push(copy);
      continue;
    }

    groups.set(group.key, {
      ...group,
      copies: [copy]
    });
  }

  return Array.from(groups.values());
}

function CopyRow({
  copy,
  copyNumber,
  releaseTitle,
  linkageStatus
}: {
  copy: CopySummary;
  copyNumber: number;
  releaseTitle: string;
  linkageStatus: "direct" | "carryover" | "unused";
}) {
  return (
    <Link
      className="command-row block cursor-pointer px-4 py-5 sm:px-6 sm:py-6"
      href={`/admin/copy-lab/${copy.id}`}
    >
      <div className="grid gap-5 lg:grid-cols-[110px_minmax(0,1.5fr)_1fr_1.2fr_120px] lg:items-start">
        <div className="status-badge-neutral w-fit tabular-nums">{copyNumber}</div>

        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">{getCopyHeading(copy)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {truncate(copy.caption, "No caption written yet.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {/* Archive State Badge */}
            {copy.archived_at && (
              <span className="status-badge-warning px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Archived
              </span>
            )}
            {copy.archived_at && copy.archive_reason?.toLowerCase().includes("legacy duplicate") && (
              <span className="status-badge-danger px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Legacy Duplicate
              </span>
            )}

            {/* Linkage Status Badge */}
            {linkageStatus === "direct" && (
              <span className="status-badge-ready px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Direct Link
              </span>
            )}
            {linkageStatus === "carryover" && (
              <span className="status-badge-warning px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Carried Link
              </span>
            )}
            {linkageStatus === "unused" && (
              <span className="status-badge-neutral px-2 py-0.5 text-[10px] uppercase tracking-wider">
                Unused
              </span>
            )}

            <span className="status-badge-neutral px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {formatContentType(copy.content_type)}
            </span>
            <span className="status-badge-neutral px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {formatSongSection(copy.song_section)}
            </span>
          </div>
        </div>

        <div>
          <p className="field-label">Copy Angle</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatHookType(copy.hook_type)}
          </p>
        </div>

        <div>
          <p className="field-label">Release</p>
          <p className="mt-2 text-sm font-semibold text-ink truncate">{releaseTitle}</p>
          <p className="mt-2.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            Updated {formatTimestamp(copy.updated_on)}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 text-sm font-semibold text-ink transition hover:text-brand-primary">
          Open
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

function CopyVariantRow({
  copyNumberById,
  releaseTitle,
  variantSet,
  getLinkageStatus
}: {
  copyNumberById: Map<string, number>;
  releaseTitle: string;
  variantSet: CopyVariantSet;
  getLinkageStatus: (id: string) => "direct" | "carryover" | "unused";
}) {
  const {representative} = variantSet;

  return (
    <div className="command-row bg-surface-elevated px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid gap-5 lg:grid-cols-[110px_minmax(0,1.5fr)_1fr_1.2fr_120px] lg:items-start">
        <div className="status-badge-info w-fit">{variantSet.copies.length} variants</div>

        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">
            {getCopyHeading(representative)}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {truncate(representative.caption, "No caption written yet.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted">
              Variants:
            </span>
            {variantSet.copies.map((copy) => {
              const status = getLinkageStatus(copy.id);
              let statusClasses = "status-badge-neutral hover:border-[rgba(246,201,69,0.45)] hover:text-ink";
              if (copy.archived_at) {
                statusClasses = "status-badge-danger line-through hover:border-[rgba(223,107,107,0.72)]";
              } else if (status === "direct") {
                statusClasses = "status-badge-ready hover:border-[rgba(79,191,136,0.72)]";
              } else if (status === "carryover") {
                statusClasses = "status-badge-warning hover:border-[rgba(246,201,69,0.72)]";
              }
              return (
                <Link
                  className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${statusClasses}`}
                  href={`/admin/copy-lab/${copy.id}`}
                  key={copy.id}
                  title={`Open copy #${copyNumberById.get(copy.id) ?? "?"} (${status.toUpperCase()})`}
                >
                  {formatContentType(copy.content_type)}
                </Link>
              );
            })}
            <span className="status-badge-neutral px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {formatSongSection(representative.song_section)}
            </span>
          </div>
        </div>

        <div>
          <p className="field-label">Copy Angle</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatHookType(representative.hook_type)}
          </p>
        </div>

        <div>
          <p className="field-label">Release</p>
          <p className="mt-2 text-sm font-semibold text-ink truncate">{releaseTitle}</p>
          <p className="mt-2.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            Updated {formatTimestamp(representative.updated_on)}
          </p>
        </div>

        <Link
          className="flex items-center justify-end gap-2 text-sm font-semibold text-ink transition hover:text-brand-primary"
          href={`/admin/copy-lab/${representative.id}`}
        >
          Open latest
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

export default async function AdminCopyLabPage({
  searchParams
}: {
  searchParams: Promise<{
    groupBy?: string;
    releaseId?: string;
    statusFilter?: string;
    archiveFilter?: string;
  }>;
}) {
  const [{groupBy, releaseId, statusFilter, archiveFilter}, copies, releases] = await Promise.all([
    searchParams,
    readCopySummaries(),
    readReleaseSummaries()
  ]);

  const activeArchiveFilter = archiveFilter || "active";

  const selectedGroupBy = normalizeGroupBy(groupBy);
  const activeStatusFilter = statusFilter || "all";

  // Validate releaseId
  const selectedRelease = releaseId
    ? (releases.find((r) => r.id === releaseId) || null)
    : null;
  const activeReleaseId = selectedRelease ? selectedRelease.id : null;

  // 1. Fetch batches and reports for active release or all releases
  const batches = await prisma.adImportBatch.findMany({
    where: activeReleaseId ? { releaseId: activeReleaseId } : undefined,
    include: {
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  // 2. Group reports by releaseId and resolve effective copy links
  const reportsByRelease = new Map<string | null, any[]>();
  for (const b of batches) {
    const rid = b.releaseId;
    if (!reportsByRelease.has(rid)) {
      reportsByRelease.set(rid, []);
    }
    reportsByRelease.get(rid)!.push(...b.reports);
  }

  for (const [rid, rpts] of reportsByRelease.entries()) {
    await resolveEffectiveCopyLinksForRelease(rid, rpts);
  }

  const allReports = Array.from(reportsByRelease.values()).flat();

  // 3. Build sets of direct linked copy IDs and carried linked copy IDs
  const directLinkedCopyIds = new Set<string>();
  const carriedLinkedCopyIds = new Set<string>();

  for (const report of allReports) {
    for (const link of report.effectiveCopyLinks || []) {
      const copyId = link.copyEntryId;
      if (report.copyLinkSource === "direct") {
        directLinkedCopyIds.add(copyId);
      } else if (report.copyLinkSource === "carryover") {
        carriedLinkedCopyIds.add(copyId);
      }
    }
  }

  // 4. Helper to determine the linkage status of a copy entry
  const getLinkageStatus = (copyId: string): "direct" | "carryover" | "unused" => {
    if (directLinkedCopyIds.has(copyId)) {
      return "direct";
    }
    if (carriedLinkedCopyIds.has(copyId)) {
      return "carryover";
    }
    return "unused";
  };

  // 5. Filter copy summaries based on the activeStatusFilter and activeArchiveFilter
  const filteredCopies = copies.filter((copy) => {
    // Release context filter
    if (activeReleaseId && copy.release_id !== activeReleaseId) {
      return false;
    }

    // Archive status filter
    if (activeArchiveFilter === "active" && copy.archived_at) {
      return false;
    }
    if (activeArchiveFilter === "archived" && !copy.archived_at) {
      return false;
    }

    const status = getLinkageStatus(copy.id);

    // Linkage status filter
    if (activeStatusFilter === "linked" && status === "unused") {
      return false;
    }
    if (activeStatusFilter === "direct" && status !== "direct") {
      return false;
    }
    if (activeStatusFilter === "carryover" && status !== "carryover") {
      return false;
    }
    if (activeStatusFilter === "unused" && status !== "unused") {
      return false;
    }

    return true;
  });

  const releaseTitleById = new Map(releases.map((release) => [release.id, release.title]));
  const copyNumberById = new Map(copies.map((copy, index) => [copy.id, index + 1]));
  const groupedCopies = groupCopies(filteredCopies, selectedGroupBy, releaseTitleById);
  const selectedGroupOption = copyGroupOptions.find((option) => option.key === selectedGroupBy);

  // Build release options list for the filter select dropdown:
  // Shows only releases with copies, plus the currently selected release if valid.
  const releasesWithCopiesIds = new Set(copies.map((c) => c.release_id).filter(Boolean));
  const filteredReleasesForDropdown = releases
    .filter((r) => releasesWithCopiesIds.has(r.id) || r.id === activeReleaseId)
    .map((r) => ({ id: r.id, title: r.title }));

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="command-surface overflow-hidden px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
                <Link className="transition hover:text-ink" href="/admin/ad-lab">Ad Lab</Link>
                <span>/</span>
                <span className="text-brand-primary">Copy Lab</span>
              </div>
              <div className="status-badge-neutral">Copy planning</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Copy Lab
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Build hook and caption pairs for releases, or keep reusable standalone
                copy ready for later.
              </p>
            </div>

            <Link
              className="action-button-primary"
              href={
                activeReleaseId
                  ? `/admin/copy-lab/new?releaseId=${activeReleaseId}`
                  : "/admin/copy-lab/new"
              }
            >
              <PlusCircle size={16} />
              Create Copy
            </Link>
          </div>
        </section>

        <section className="command-surface px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-3xl">
              <p className="field-label">Library view</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                <span className="font-semibold text-ink">Grouped by {selectedGroupOption?.label}.</span>{" "}
                <span className="text-secondary">
                  {selectedGroupOption?.description}
                </span>
              </p>
              {activeArchiveFilter !== "active" && (
                <p className="mt-2 text-xs text-amber-500 font-semibold">
                  Archived legacy copy records are hidden from the active planning workspace but preserved for history.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <CopyLabFilters
                releases={filteredReleasesForDropdown}
                activeReleaseId={activeReleaseId}
                activeGroupBy={selectedGroupBy}
                activeStatusFilter={activeStatusFilter}
                activeArchiveFilter={activeArchiveFilter}
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Group By
                </span>
                <div className="flex flex-wrap gap-2 rounded-md border border-edge bg-input p-1.5">
                  {copyGroupOptions
                    .filter((option) => option.key !== "content-type" && option.key !== "song-section")
                    .map((option) => {
                      const isActive = option.key === selectedGroupBy;

                      return (
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          className={`rounded-md border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                            isActive
                              ? "border-brand-primary bg-brand-primary text-inverse shadow-[0_0_0_1px_rgba(246,201,69,0.18)]"
                              : "border-edge-strong bg-surface-elevated text-secondary hover:border-[rgba(246,201,69,0.7)] hover:bg-surface-hover hover:text-ink"
                          }`}
                          href={getGroupHref(
                            option.key,
                            activeReleaseId || undefined,
                            activeStatusFilter !== "all" ? activeStatusFilter : undefined,
                            activeArchiveFilter !== "active" ? activeArchiveFilter : undefined
                          )}
                          key={option.key}
                        >
                          {option.label}
                        </Link>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {selectedRelease && (
          <section className="command-surface overflow-hidden border-[rgba(246,201,69,0.28)] bg-[linear-gradient(135deg,rgba(246,201,69,0.1),var(--bg-surface)_44%,var(--bg-surface-elevated))] px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
                  Active Release Context
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {selectedRelease.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-ink">
                      {copies.filter((c) => c.release_id === selectedRelease.id).length}
                    </span>{" "}
                    copy entries
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-ink">
                      {
                        new Set(
                          copies
                            .filter((c) => c.release_id === selectedRelease.id)
                            .map((c) => c.hook_type)
                        ).size
                      }
                    </span>{" "}
                    angles active
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  className="action-button-secondary border-[rgba(246,201,69,0.32)] hover:border-[rgba(246,201,69,0.72)]"
                  href={`/admin/releases/${selectedRelease.id}`}
                >
                  Open Release
                </Link>
                <Link
                  className="action-button-primary"
                  href={`/admin/copy-lab/new?releaseId=${selectedRelease.id}`}
                >
                  <PlusCircle size={16} />
                  New Copy for this Release
                </Link>
                <Link
                  className="action-button-danger flex items-center gap-2"
                  href={getGroupHref(
                    selectedGroupBy,
                    undefined,
                    activeStatusFilter !== "all" ? activeStatusFilter : undefined,
                    activeArchiveFilter !== "active" ? activeArchiveFilter : undefined
                  )}
                >
                  <XCircle size={16} />
                  Clear Filter
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4">
          {activeReleaseId && selectedGroupBy === "release" ? (
            /* Focused single-release list: show copies directly inside a panel, no details wrapper */
            filteredCopies.length > 0 ? (
              <div className="command-surface divide-y divide-edge overflow-hidden">
                {groupCopyVariants(filteredCopies).map((variantSet) => {
                  const releaseTitle = selectedRelease ? selectedRelease.title : "Standalone";

                  if (hasContentVariants(variantSet)) {
                    return (
                      <CopyVariantRow
                        copyNumberById={copyNumberById}
                        key={variantSet.key}
                        releaseTitle={releaseTitle}
                        variantSet={variantSet}
                        getLinkageStatus={getLinkageStatus}
                      />
                    );
                  }

                  return variantSet.copies.map((copy) => (
                    <CopyRow
                      copy={copy}
                      copyNumber={copyNumberById.get(copy.id) ?? 0}
                      key={copy.id}
                      releaseTitle={releaseTitle}
                      linkageStatus={getLinkageStatus(copy.id)}
                    />
                  ));
                })}
              </div>
            ) : (
              <div className="command-surface px-5 py-7 sm:px-6 sm:py-8">
                <p className="text-lg font-semibold text-ink">No copy pairs found for this release</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Create your first copy pair for {selectedRelease?.title} using the button above to get started.
                </p>
              </div>
            )
          ) : (
            /* Default grouped or flat view layout */
            <>
              {groupedCopies.map((group, groupIndex) => (
                <details
                  className="group command-surface overflow-hidden"
                  key={group.key}
                  open={Boolean(activeReleaseId) || selectedGroupBy === "flat" || groupIndex === 0}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <div>
                      <p className="field-label">{group.eyebrow}</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                        {group.label}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="status-badge-neutral">{formatCopyCount(group.copies.length)}</span>
                      <ChevronDown
                        className="text-muted transition group-open:rotate-180"
                        size={18}
                      />
                    </div>
                  </summary>

                  <div className="divide-y divide-edge border-t border-edge">
                    {(selectedGroupBy === "content-type"
                      ? group.copies.map((copy) => ({
                          key: copy.id,
                          copies: [copy],
                          representative: copy
                        }))
                      : groupCopyVariants(group.copies)
                    ).map((variantSet) => {
                      const releaseTitle = variantSet.representative.release_id
                        ? (releaseTitleById.get(variantSet.representative.release_id) ?? "Linked Release")
                        : "Standalone";

                      if (hasContentVariants(variantSet)) {
                        return (
                          <CopyVariantRow
                            copyNumberById={copyNumberById}
                            key={variantSet.key}
                            releaseTitle={releaseTitle}
                            variantSet={variantSet}
                            getLinkageStatus={getLinkageStatus}
                          />
                        );
                      }

                      return variantSet.copies.map((copy) => (
                        <CopyRow
                          copy={copy}
                          copyNumber={copyNumberById.get(copy.id) ?? 0}
                          key={copy.id}
                          releaseTitle={releaseTitle}
                          linkageStatus={getLinkageStatus(copy.id)}
                        />
                      ));
                    })}
                  </div>
                </details>
              ))}

              {filteredCopies.length === 0 ? (
                <div className="command-surface px-5 py-7 sm:px-6 sm:py-8">
                  <p className="text-lg font-semibold text-ink">No copy pairs found</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    No copy pairs match the active filters.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
