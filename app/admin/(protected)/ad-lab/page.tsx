export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, BarChart3, UploadCloud, PenTool, Target, Camera, TrendingUp, Database} from "lucide-react";

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

function formatOptionalMoney(value: number | null) {
  return value === null ? "N/A" : formatMoney(value);
}

function formatOptionalPercent(value: number | null) {
  return value === null ? "N/A" : `${Math.round(value * 100) / 100}%`;
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

export default async function AdminAdLabPage({
  searchParams
}: {
  searchParams: Promise<{deleted?: string; releaseId?: string}>;
}) {
  const [{deleted, releaseId}, releases] = await Promise.all([searchParams, readReleaseSummaries()]);
  const activeReleaseId =
    releases.some((release) => release.id === releaseId) && releaseId ? releaseId : null;
  const {batches, overview} = await readAdsHomeStats(activeReleaseId);
  const deletedHref = activeReleaseId
    ? `/admin/ad-lab?releaseId=${encodeURIComponent(activeReleaseId)}&deleted=1`
    : "/admin/ad-lab?deleted=1";


  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <BarChart3 size={12} />
                Promo Lab
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Promo Lab
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Plan, test, track, and learn from every release campaign.
              </p>
            </div>
 
            <Link className="action-button-primary" href="/admin/ad-lab/import">
              <UploadCloud size={16} />
              Import Meta CSV
            </Link>
          </div>
        </section>
 
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d7b45e]">
              Creative Tools
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="group relative overflow-hidden rounded-[28px] border border-[#30343b] bg-[#121418] p-1 transition-all hover:border-[#d7b45e]/50 hover:shadow-[0_0_20px_rgba(215,180,94,0.1)]">
                <div className="flex flex-col h-full justify-between gap-6 p-6 sm:p-8">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4a3c1d] bg-[#1a1710] text-[#d7b45e] transition-transform group-hover:scale-110">
                      <PenTool size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink">Copy Lab</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Build hooks, captions, creative angles, content types, and strategy tags before campaigns go live.
                    </p>
                  </div>
                  <div>
                    <Link 
                      className="inline-flex items-center gap-2 rounded-full bg-[#d7b45e] px-6 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#e2c47c]" 
                      href="/admin/copy-lab"
                    >
                      Open Copy Lab
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>

              <section className="group relative overflow-hidden rounded-[28px] border border-[#30343b] bg-[#121418] p-1 transition-all hover:border-[#d7b45e]/50 hover:shadow-[0_0_20px_rgba(215,180,94,0.1)]">
                <div className="flex flex-col h-full justify-between gap-6 p-6 sm:p-8">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4a3c1d] bg-[#1a1710] text-[#d7b45e] transition-transform group-hover:scale-110">
                      <Camera size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink">Photo Lab</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Create and manage promo visuals, cover assets, and image-based campaign creative.
                    </p>
                  </div>
                  <div>
                    <Link 
                      className="inline-flex items-center gap-2 rounded-full bg-[#d7b45e] px-6 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#e2c47c]" 
                      href="/admin/photo-lab"
                    >
                      Open Photo Lab
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d7b45e]">
              Tracking & Validation
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="group relative overflow-hidden rounded-[28px] border border-[#30343b] bg-[#121418] p-1 transition-all hover:border-[#d7b45e]/50 hover:shadow-[0_0_20px_rgba(215,180,94,0.1)]">
                <div className="flex flex-col h-full justify-between gap-6 p-6 sm:p-8">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4a3c1d] bg-[#1a1710] text-[#d7b45e] transition-transform group-hover:scale-110">
                      <Target size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink">Attribution</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Check UTM coverage, landing page views, outbound clicks, and tracking quality tied to your campaigns.
                    </p>
                  </div>
                  <div>
                    <Link 
                      className="inline-flex items-center gap-2 rounded-full bg-[#d7b45e] px-6 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#e2c47c]" 
                      href="/admin/attribution"
                    >
                      Open Attribution
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d7b45e]">
              Campaign Decisions
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="group relative overflow-hidden rounded-[28px] border border-[#30343b] bg-[#121418] p-1 transition-all hover:border-[#d7b45e]/50 hover:shadow-[0_0_20px_rgba(215,180,94,0.1)]">
                <div className="flex flex-col h-full justify-between gap-6 p-6 sm:p-8">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4a3c1d] bg-[#1a1710] text-[#d7b45e] transition-transform group-hover:scale-110">
                      <TrendingUp size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink">Campaign Intelligence</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Review campaign readouts, winners, weak spots, confidence scores, and next-test decisions.
                    </p>
                  </div>
                  <div>
                    <Link 
                      className="inline-flex items-center gap-2 rounded-full bg-[#d7b45e] px-6 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#e2c47c]" 
                      href="#campaign-scope"
                    >
                      View Campaign Readouts
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>

              <section className="group relative overflow-hidden rounded-[28px] border border-[#30343b] bg-[#121418] p-1 transition-all hover:border-[#d7b45e]/50 hover:shadow-[0_0_20px_rgba(215,180,94,0.1)]">
                <div className="flex flex-col h-full justify-between gap-6 p-6 sm:p-8">
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4a3c1d] bg-[#1a1710] text-[#d7b45e] transition-transform group-hover:scale-110">
                      <Database size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink">Imports / Ad Data</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Import Meta CSVs and review campaign batch data.
                    </p>
                  </div>
                  <div>
                    <Link 
                      className="inline-flex items-center gap-2 rounded-full bg-[#d7b45e] px-6 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#e2c47c]" 
                      href="#batch-list"
                    >
                      Manage Imports
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>

        <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted">
              Snapshot Metrics
            </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Imports" note="CSV batches in this view." value={formatNumber(overview.import_count)} />
            <MetricCard label="Ad Rows" note={overview.metric_scope} value={formatNumber(overview.report_count)} />
            <MetricCard label="Spend" note={overview.metric_scope} value={formatMoney(overview.spend)} />
            <MetricCard label="Impressions" note={overview.metric_scope} value={formatNumber(overview.impressions)} />
            <MetricCard label="Results" note={overview.metric_scope} value={formatNumber(overview.results)} />
            <MetricCard label="Link Clicks" note={overview.metric_scope} value={formatNumber(overview.link_clicks)} />
            <MetricCard label="Landing Views" note={overview.metric_scope} value={formatNumber(overview.landing_page_views)} />
            <MetricCard label="Click to LPV" note="Landing views divided by Meta link clicks." value={formatOptionalPercent(overview.click_to_landing_rate)} />
            <MetricCard label="Cost / LPV" note="Spend divided by landing page views." value={formatOptionalMoney(overview.cost_per_landing_page_view)} />
          </div>
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

        <section className="panel space-y-4 px-4 py-5 sm:px-6 sm:py-6" id="campaign-scope">
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
              href="/admin/ad-lab"
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
                href={`/admin/ad-lab?releaseId=${release.id}`}
                key={release.id}
              >
                {release.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4" id="batch-list">
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
                    {batch.release_title ?? "No linked release"} /{" "}
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
                    href={`/admin/ad-lab/${batch.id}`}
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
