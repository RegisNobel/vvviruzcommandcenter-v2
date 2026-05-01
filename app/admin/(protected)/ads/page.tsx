export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, BarChart3, UploadCloud} from "lucide-react";

import {AdsDeleteBatchButton} from "@/components/ads-delete-batch-button";
import {readAdsHomeStats} from "@/lib/repositories/ads";
import {readReleaseSummaries} from "@/lib/server/releases";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date range";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date range";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function MetricCard({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#30343b] bg-[#121418] px-4 py-4">
      <p className="field-label">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

export default async function AdminAdsPage({
  searchParams
}: {
  searchParams: Promise<{deleted?: string; releaseId?: string}>;
}) {
  const [{deleted, releaseId}, releases] = await Promise.all([searchParams, readReleaseSummaries()]);
  const activeReleaseId =
    releases.some((release) => release.id === releaseId) && releaseId ? releaseId : null;
  const {batches, overview} = await readAdsHomeStats(activeReleaseId);
  const deletedHref = activeReleaseId
    ? `/admin/ads?releaseId=${encodeURIComponent(activeReleaseId)}&deleted=1`
    : "/admin/ads?deleted=1";

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <BarChart3 size={12} />
                Ads Analytics v1
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Meta Ads Analytics
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                CSV-first ad reporting for campaign readouts, creative strategy
                breakdowns, Copy Lab links, and future Meta performance analysis.
              </p>
            </div>

            <Link className="action-button-primary" href="/admin/ads/import">
              <UploadCloud size={16} />
              Import Meta CSV
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Imports" note="CSV batches in this view." value={formatNumber(overview.import_count)} />
          <MetricCard label="Ad Rows" note={overview.metric_scope} value={formatNumber(overview.report_count)} />
          <MetricCard label="Spend" note={overview.metric_scope} value={formatMoney(overview.spend)} />
          <MetricCard label="Impressions" note={overview.metric_scope} value={formatNumber(overview.impressions)} />
          <MetricCard label="Results" note={overview.metric_scope} value={formatNumber(overview.results)} />
          <MetricCard label="Link Clicks" note={overview.metric_scope} value={formatNumber(overview.link_clicks)} />
        </section>

        {!overview.can_combine_totals && batches.length > 0 ? (
          <div className="rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm leading-6 text-[#d7b45e]">
            {overview.comparison_mode}: overlapping or non-fixed Meta snapshots are shown as
            latest-snapshot metrics here. Do not sum them with other overlapping batches.
          </div>
        ) : null}

        {deleted === "1" ? (
          <div className="rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
            Ad import batch deleted. Releases, Copy Lab entries, public data, and other batches were left untouched.
          </div>
        ) : null}

        <section className="panel space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <p className="field-label">Release Filter</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Campaign scope</h2>
          </div>

          <div className="mobile-scroll-x flex gap-2">
            <Link
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                !activeReleaseId
                  ? "border-[#5b4920] bg-[#c9a347] text-[#14120d]"
                  : "border-[#30343b] bg-[#15181c] text-[#d5d9df]"
              }`}
              href="/admin/ads"
            >
              All Releases
            </Link>
            {releases.map((release) => (
              <Link
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  activeReleaseId === release.id
                    ? "border-[#5b4920] bg-[#c9a347] text-[#14120d]"
                    : "border-[#30343b] bg-[#15181c] text-[#d5d9df]"
                }`}
                href={`/admin/ads?releaseId=${release.id}`}
                key={release.id}
              >
                {release.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {batches.map((batch) => (
            <article
              className="panel block px-4 py-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel-subtle sm:px-6 sm:py-6"
              key={batch.id}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_0.7fr_0.7fr_0.75fr_0.75fr_0.75fr_220px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-ink">
                    {batch.name || "Imported Meta Report"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {batch.release_title ?? "No linked release"} ·{" "}
                    {formatDate(batch.reporting_start)} to {formatDate(batch.reporting_end)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {batch.batch_type} / exported {formatDateTime(batch.exported_at)} /{" "}
                    {batch.attribution_setting}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">
                    {batch.file_names.join(", ") || "No file names recorded"}
                  </p>
                </div>

                <div>
                  <p className="field-label">Batch Type</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {batch.batch_type}
                  </p>
                </div>
                <div>
                  <p className="field-label">Date Range</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatDate(batch.reporting_start)} to {formatDate(batch.reporting_end)}
                  </p>
                </div>
                <div>
                  <p className="field-label">Rows</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatNumber(batch.report_count)}
                  </p>
                </div>
                <div>
                  <p className="field-label">Spend</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatMoney(batch.spend)}
                  </p>
                </div>
                <div>
                  <p className="field-label">Clicks</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatNumber(batch.link_clicks)}
                  </p>
                </div>
                <div>
                  <p className="field-label">Linked Copy</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatNumber(batch.linked_copy_count)} / {formatNumber(batch.report_count)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <AdsDeleteBatchButton
                    afterDeleteHref={deletedHref}
                    batchId={batch.id}
                    batchName={batch.name || "Imported Meta Report"}
                    compact
                  />
                  <Link
                    className="action-button-secondary !w-auto"
                    href={`/admin/ads/${batch.id}`}
                  >
                    Open
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {batches.length === 0 ? (
            <div className="panel px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No ad imports yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Import a Meta CSV report to start building campaign readouts and
                creative strategy breakdowns.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
