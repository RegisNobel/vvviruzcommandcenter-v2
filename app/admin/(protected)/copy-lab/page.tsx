export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, PlusCircle} from "lucide-react";

import {formatCopyType, getCopyHeading} from "@/lib/copy";
import {readCopySummaries} from "@/lib/server/copies";
import {readReleaseSummaries} from "@/lib/server/releases";

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

export default async function AdminCopyLabPage() {
  const [copies, releases] = await Promise.all([readCopySummaries(), readReleaseSummaries()]);
  const releaseTitleById = new Map(releases.map((release) => [release.id, release.title]));

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
                Build hook and caption pairs for releases, or keep neutral standalone
                copy ready for later.
              </p>
            </div>

            <Link className="action-button-primary" href="/admin/copy-lab/new">
              <PlusCircle size={16} />
              Create Copy
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          {copies.map((copy, index) => {
            const releaseTitle = copy.release_id
              ? (releaseTitleById.get(copy.release_id) ?? "Linked Release")
              : "Standalone";

            return (
              <Link
                className="panel block cursor-pointer px-4 py-5 sm:px-6 sm:py-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel-subtle"
                href={`/admin/copy-lab/${copy.id}`}
                key={copy.id}
              >
                <div className="grid gap-5 lg:grid-cols-[80px_minmax(0,1.15fr)_0.9fr_1fr_120px] lg:items-start">
                  <div className="pill w-fit">{index + 1}</div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-ink">
                      {getCopyHeading(copy)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {truncate(copy.caption, "No caption written yet.")}
                    </p>
                  </div>

                  <div>
                    <p className="field-label">Type</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {formatCopyType(copy.type)}
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
          })}

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

