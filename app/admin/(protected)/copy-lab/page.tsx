export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, ChevronDown, PlusCircle} from "lucide-react";

import {
  formatContentType,
  formatHookType,
  formatSongSection,
  getCopyHeading
} from "@/lib/copy";
import {readCopySummaries} from "@/lib/server/copies";
import {readReleaseSummaries} from "@/lib/server/releases";
import type {CopySummary} from "@/lib/types";

type CopyGroupBy = "release" | "hook-type" | "content-type" | "song-section" | "flat";

type CopyGroup = {
  key: string;
  label: string;
  eyebrow: string;
  copies: CopySummary[];
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
    label: "Hook Type",
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

function getGroupHref(groupBy: CopyGroupBy) {
  return groupBy === "release" ? "/admin/copy-lab" : `/admin/copy-lab?groupBy=${groupBy}`;
}

function formatCopyCount(count: number) {
  return `${count} cop${count === 1 ? "y" : "ies"}`;
}

function getCopyGroup(
  copy: CopySummary,
  groupBy: CopyGroupBy,
  releaseTitleById: Map<string, string>
): Omit<CopyGroup, "copies"> {
  if (groupBy === "hook-type") {
    const label = formatHookType(copy.hook_type);

    return {
      eyebrow: "Hook type",
      key: `hook-type:${copy.hook_type}`,
      label
    };
  }

  if (groupBy === "content-type") {
    const label = formatContentType(copy.content_type);

    return {
      eyebrow: "Content type",
      key: `content-type:${copy.content_type}`,
      label
    };
  }

  if (groupBy === "song-section") {
    const label = formatSongSection(copy.song_section);

    return {
      eyebrow: "Song section",
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
  releaseTitle
}: {
  copy: CopySummary;
  copyNumber: number;
  releaseTitle: string;
}) {
  return (
    <Link
      className="block cursor-pointer px-4 py-5 transition hover:bg-panel-subtle sm:px-6 sm:py-6"
      href={`/admin/copy-lab/${copy.id}`}
    >
      <div className="grid gap-5 lg:grid-cols-[80px_minmax(0,1.1fr)_0.9fr_0.9fr_1fr_120px] lg:items-start">
        <div className="pill w-fit">{copyNumber}</div>

        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">{getCopyHeading(copy)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {truncate(copy.caption, "No caption written yet.")}
          </p>
        </div>

        <div>
          <p className="field-label">Hook Type</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatHookType(copy.hook_type)}
          </p>
        </div>

        <div>
          <p className="field-label">Strategy</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatContentType(copy.content_type)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
            {formatSongSection(copy.song_section)}
          </p>
        </div>

        <div>
          <p className="field-label">Release</p>
          <p className="mt-2 text-sm font-semibold text-ink">{releaseTitle}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
            Updated {formatTimestamp(copy.updated_on)}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 text-sm font-semibold text-ink">
          Open
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

export default async function AdminCopyLabPage({
  searchParams
}: {
  searchParams: Promise<{groupBy?: string}>;
}) {
  const [{groupBy}, copies, releases] = await Promise.all([
    searchParams,
    readCopySummaries(),
    readReleaseSummaries()
  ]);
  const selectedGroupBy = normalizeGroupBy(groupBy);
  const releaseTitleById = new Map(releases.map((release) => [release.id, release.title]));
  const copyNumberById = new Map(copies.map((copy, index) => [copy.id, index + 1]));
  const groupedCopies = groupCopies(copies, selectedGroupBy, releaseTitleById);
  const selectedGroupOption = copyGroupOptions.find((option) => option.key === selectedGroupBy);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Copy planning</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Copy Lab
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Build hook and caption pairs for releases, or keep reusable standalone
                copy ready for later.
              </p>
            </div>

            <Link className="action-button-primary" href="/admin/copy-lab/new">
              <PlusCircle size={16} />
              Create Copy
            </Link>
          </div>
        </section>

        <section className="panel px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Library view</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Grouped by{" "}
                <span className="font-semibold text-ink">{selectedGroupOption?.label}</span>.
                {selectedGroupOption ? ` ${selectedGroupOption.description}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {copyGroupOptions.map((option) => {
                const isActive = option.key === selectedGroupBy;

                return (
                  <Link
                    className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                      isActive
                        ? "border-accent bg-accent text-[#16120a]"
                        : "border-[#30343b] bg-[#111419] text-muted hover:border-accent/50 hover:text-ink"
                    }`}
                    href={getGroupHref(option.key)}
                    key={option.key}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {groupedCopies.map((group, groupIndex) => (
            <details
              className="group panel overflow-hidden"
              key={group.key}
              open={selectedGroupBy === "flat" || groupIndex === 0}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="field-label">{group.eyebrow}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                    {group.label}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <span className="pill">{formatCopyCount(group.copies.length)}</span>
                  <ChevronDown
                    className="text-muted transition group-open:rotate-180"
                    size={18}
                  />
                </div>
              </summary>

              <div className="divide-y divide-[#252a31] border-t border-[#252a31]">
                {group.copies.map((copy) => {
                  const releaseTitle = copy.release_id
                    ? (releaseTitleById.get(copy.release_id) ?? "Linked Release")
                    : "Standalone";

                  return (
                    <CopyRow
                      copy={copy}
                      copyNumber={copyNumberById.get(copy.id) ?? 0}
                      key={copy.id}
                      releaseTitle={releaseTitle}
                    />
                  );
                })}
              </div>
            </details>
          ))}

          {copies.length === 0 ? (
            <div className="panel px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No copy pairs yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Create your first hook and caption pair to start building a release
                library and standalone copy bank.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
