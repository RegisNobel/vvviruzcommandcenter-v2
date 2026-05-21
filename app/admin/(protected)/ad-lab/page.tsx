export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowRight, BarChart3, UploadCloud, Camera} from "lucide-react";

import {AdsDeleteBatchButton} from "@/components/ads-delete-batch-button";
import {readAdsHomeStats} from "@/lib/repositories/ads";
import {readReleaseSummaries} from "@/lib/server/releases";
import {prisma} from "@/lib/db/prisma";

function getReleaseStatusText(release: {
  conceptComplete: boolean;
  beatMade: boolean;
  lyricsFinished: boolean;
  recorded: boolean;
  mixMastered: boolean;
  published: boolean;
}) {
  if (release.published) return "Published";
  if (release.mixMastered) return "Mix/Master Done";
  if (release.recorded) return "Recorded";
  if (release.lyricsFinished) return "Lyrics Finished";
  if (release.beatMade) return "Beat Made";
  if (release.conceptComplete) return "Concept Complete";
  return "Concept Phase";
}

const promoWorkflowSteps = [
  {
    label: "1. Write",
    title: "Copy Lab",
    body: "Build hooks, captions, and strategy tags before traffic starts.",
    href: "/admin/copy-lab"
  },
  {
    label: "2. Track",
    title: "Short Links",
    body: "Create campaign URLs with UTMs so traffic can be traced cleanly.",
    href: "/admin/short-links"
  },
  {
    label: "3. Import",
    title: "Meta CSV",
    body: "Upload snapshots into Ad Lab without summing rolling windows.",
    href: "/admin/ad-lab/import"
  },
  {
    label: "4. Decide",
    title: "Attribution",
    body: "Compare Meta signals against first-party /links behavior.",
    href: "/admin/attribution"
  }
];

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

  const latestImport = await prisma.adImportBatch.findFirst({
    where: activeReleaseId ? { releaseId: activeReleaseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { release: { select: { title: true } } }
  });

  const latestArchivedDecision = await prisma.adCampaignLearning.findFirst({
    where: {
      reviewedAt: { not: null },
      ...(activeReleaseId ? { releaseId: activeReleaseId } : {})
    },
    orderBy: { reviewedAt: "desc" },
    include: {
      release: { select: { title: true } },
      importBatch: { select: { id: true, name: true } }
    }
  });

  const activeRelease = activeReleaseId
    ? await prisma.release.findUnique({
        where: { id: activeReleaseId }
      })
    : await prisma.release.findFirst({
        orderBy: { updatedOn: "desc" }
      });
  const latestDecisionLabel =
    latestArchivedDecision?.finalDecision || latestArchivedDecision?.decision || "";


  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <BarChart3 size={12} />
                Promo
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Promo
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Plan, track, and learn from release campaigns.
              </p>
            </div>
 
            <Link className="action-button-primary" href="/admin/ad-lab/import">
              <UploadCloud size={16} />
              Import Meta CSV
            </Link>
          </div>
        </section>
 
        <section className="panel overflow-hidden px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Operator Flow</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Promo workflow strip</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Use this as the campaign loop: write the idea, create the tracked link,
                import the Meta snapshot, then decide what earns the next test.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {promoWorkflowSteps.map((step) => (
              <Link
                className="group rounded-[24px] border border-[#30343b] bg-[#101216] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#d7b45e]/45 hover:bg-[#15181c]"
                href={step.href}
                key={step.title}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d7b45e]">
                  {step.label}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                  <ArrowRight className="text-muted transition group-hover:text-[#d7b45e]" size={16} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel overflow-hidden px-4 py-5 sm:px-6">
          <div>
            <p className="field-label">Campaign Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Intelligence summary</h2>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-[20px] border border-[#30343b] bg-[#121418] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7b45e]">
                  {activeReleaseId ? "Campaign Release" : "Release Context"}
                </p>
                {activeRelease ? (
                  <div className="mt-3">
                    <h4 className="text-base font-semibold text-ink line-clamp-2">
                      {activeRelease.title}
                    </h4>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#4a3c1d] bg-[#1a1710] px-2.5 py-0.5 text-xs font-medium text-[#d7b45e]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d7b45e] animate-pulse" />
                      {getReleaseStatusText(activeRelease)}
                    </div>
                    {!activeReleaseId ? (
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                        Most recently updated
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No release context available</p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[20px] border border-[#30343b] bg-[#121418] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7b45e]">
                  Latest Import
                </p>
                {latestImport ? (
                  <div className="mt-3">
                    <Link
                      href={`/admin/ad-lab/${latestImport.id}`}
                      className="text-base font-semibold text-ink line-clamp-2 hover:text-[#d7b45e] transition"
                    >
                      {latestImport.name || "Imported Meta Report"}
                    </Link>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      {latestImport.release?.title || "No linked release"}
                    </p>
                    <p className="text-[10px] text-muted">
                      {formatDate(latestImport.reportingStart?.toISOString() ?? null)} to {formatDate(latestImport.reportingEnd?.toISOString() ?? null)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No imports recorded</p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[20px] border border-[#30343b] bg-[#121418] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7b45e]">
                  Latest Decision
                </p>
                {latestArchivedDecision ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-ink capitalize">
                        {latestDecisionLabel.replace(/-/g, " ")}
                      </h4>
                      {latestArchivedDecision.reviewedAt && (
                        <span className="text-[10px] text-muted">
                          {formatDate(latestArchivedDecision.reviewedAt.toISOString())}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted line-clamp-2">
                      {latestArchivedDecision.release?.title || "No release"}
                    </p>
                    {latestArchivedDecision.importBatch && (
                      <p className="text-[10px] text-muted">
                        Batch:{" "}
                        <Link
                          href={`/admin/ad-lab/${latestArchivedDecision.importBatchId}`}
                          className="text-[#d7b45e] hover:underline"
                        >
                          {latestArchivedDecision.importBatch.name || "Meta Report"}
                        </Link>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No archived decisions</p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[20px] border border-[#30343b] bg-[#121418] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7b45e]">
                  Naming Convention
                </p>
                <div className="mt-3">
                  <div className="rounded-lg border border-[#342e1f] bg-[#1a1710] px-3 py-1.5 text-xs font-mono text-[#d7b45e] break-all">
                    release_visual_songsection_revision
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-muted">
                    Example: <code className="text-ink">madbunny_amv_chorus_rev1</code>. Keeps parsed revisions separate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        <section className="panel px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d7b45e]">
              Future Tools
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="group rounded-[20px] border border-[#25282e] bg-[#0e1013] px-4 py-4 transition hover:border-[#30343b]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl border border-[#342e1f] bg-[#1a1710] p-2 text-[#d7b45e]">
                    <Camera size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      Photo Lab
                      <span className="rounded-full border border-[#4a3c1d] bg-[#1a1710] px-2 py-0.5 text-[10px] font-semibold text-[#d7b45e]">
                        Coming Soon
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Create and manage promo visuals, cover assets, and image-based creative.
                    </p>
                  </div>
                </div>
                <Link
                  className="rounded-full border border-[#30343b] bg-transparent p-1.5 text-muted transition hover:border-[#d7b45e]/50 hover:bg-[#16191d] hover:text-[#d7b45e]"
                  href="/admin/photo-lab"
                  title="Preview Photo Lab"
                >
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
