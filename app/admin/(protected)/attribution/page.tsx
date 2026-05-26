export const dynamic = "force-dynamic";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  Gauge,
  Link2,
  MousePointerClick,
  Radio,
  Target,
  TrendingUp,
  Trophy,
  Users
} from "lucide-react";
import Link from "next/link";

import {
  readLinkPageAnalytics,
  type AnalyticsBreakdownItem,
  type AnalyticsBreakdownKind
} from "@/lib/repositories/analytics";
import {readCampaignCommandDashboard} from "@/lib/repositories/campaign-dashboard";

const breakdownOptions: Array<{kind: AnalyticsBreakdownKind; label: string; linkLabel: string}> = [
  {kind: "country", label: "Country", linkLabel: "by country"},
  {kind: "source", label: "Source", linkLabel: "source"},
  {kind: "link", label: "By link", linkLabel: "by link"},
  {kind: "utm", label: "UTM", linkLabel: "utm"}
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null | undefined) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(safeValue);
}

function formatOptionalMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatMoney(value) : "No signal yet";
}

function formatOptionalPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "No signal yet";
}

function getTrackingStatusLabel(status: string) {
  if (status === "first_party_only") {
    return "FIRST-PARTY ONLY";
  }

  if (status === "meta_only") {
    return "META CSV ONLY";
  }

  if (status === "meta_snapshot" || status === "missing_utm") {
    return "META SNAPSHOT";
  }

  if (status === "name_matched") {
    return "AD NAME MATCH";
  }

  if (status === "matched") {
    return "MATCHED";
  }

  return status.replace(/_/g, " ").toUpperCase();
}

function getTrackingStatusClass(status: string) {
  if (status === "first_party_only") {
    return "inline-flex items-center whitespace-nowrap rounded-full border border-indigo-800/50 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-medium tracking-wide text-indigo-300";
  }

  if (status === "matched") {
    return "inline-flex items-center whitespace-nowrap rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium tracking-wide text-emerald-300";
  }

  if (status === "meta_only") {
    return "inline-flex items-center whitespace-nowrap rounded-full border border-amber-800/50 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium tracking-wide text-amber-300";
  }

  if (status === "name_matched") {
    return "inline-flex items-center whitespace-nowrap rounded-full border border-sky-800/50 bg-sky-950/40 px-2.5 py-0.5 text-xs font-medium tracking-wide text-sky-300";
  }

  if (status === "meta_snapshot" || status === "missing_utm") {
    return "inline-flex items-center whitespace-nowrap rounded-full border border-slate-700/70 bg-slate-900/50 px-2.5 py-0.5 text-xs font-medium tracking-wide text-slate-300";
  }

  return "pill";
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function normalizeBreakdownKind(value: string | undefined): AnalyticsBreakdownKind {
  return breakdownOptions.some((option) => option.kind === value)
    ? (value as AnalyticsBreakdownKind)
    : "country";
}

function getBreakdownHref({
  breakdown,
  date,
  releaseId
}: {
  breakdown: AnalyticsBreakdownKind;
  date: string;
  releaseId?: string;
}) {
  const params = new URLSearchParams({
    breakdown,
    date
  });

  if (releaseId) {
    params.set("releaseId", releaseId);
  }

  return `/admin/attribution?${params.toString()}#daily-breakdown`;
}

function MetricCard({
  icon: Icon,
  label,
  note,
  value
}: {
  icon: typeof Activity;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#30343b] bg-[#121418] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">{label}</p>
        <span className="rounded-full border border-[#4a3c1d] bg-[#1a1710] p-2 text-[#d7b45e]">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function FunnelVerdictCard({value}: {value: string}) {
  return (
    <div className="rounded-[24px] border border-[#4a3c1d] bg-[#17140d] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">Funnel Verdict</p>
        <span className="rounded-full border border-[#4a3c1d] bg-[#1f1a10] p-2 text-[#d7b45e]">
          <ArrowRight size={16} />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">
        The stream follow-through and campaign conversion health verdict.
      </p>
    </div>
  );
}

function BreakdownList({
  emptyText,
  items,
  title,
  wrapLabels = false
}: {
  emptyText: string;
  items: AnalyticsBreakdownItem[];
  title: string;
  wrapLabels?: boolean;
}) {
  return (
    <section className="rounded-[26px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className={
                wrapLabels
                  ? "rounded-[18px] border border-[#252a31] bg-[#0f1114] px-4 py-3"
                  : "flex items-center justify-between gap-4 rounded-[18px] border border-[#252a31] bg-[#0f1114] px-4 py-3"
              }
              key={item.label}
            >
              {wrapLabels ? (
                <>
                  <div className="flex items-start justify-end">
                    <span className="pill shrink-0">
                      {formatNumber(item.conversions)} / {formatNumber(item.views)}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm leading-6 text-[#d9dee5]">{item.label}</p>
                </>
              ) : (
                <>
                  <span className="min-w-0 truncate text-sm text-[#d9dee5]">{item.label}</span>
                  <span className="pill shrink-0">
                    {formatNumber(item.conversions)} / {formatNumber(item.views)}
                  </span>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-[18px] border border-dashed border-[#30343b] bg-[#0f1114] px-4 py-4 text-sm text-muted">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function BreakdownDetailTable({
  items,
  kind
}: {
  items: AnalyticsBreakdownItem[];
  kind: AnalyticsBreakdownKind;
}) {
  const countLabel = kind === "link" ? "Clicks" : "Conversions";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-[#171a1f] text-[#b8bec6]">
          <tr>
            <th className="px-4 py-3 font-semibold">Segment</th>
            <th className="px-4 py-3 font-semibold">Views</th>
            <th className="px-4 py-3 font-semibold">{countLabel}</th>
            <th className="px-4 py-3 font-semibold">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#252a31]">
          {items.length > 0 ? (
            items.map((item) => (
              <tr className="text-[#d9dee5]" key={item.label}>
                <td
                  className={`px-4 py-4 font-semibold ${
                    kind === "utm" ? "max-w-[520px] break-all leading-6" : ""
                  }`}
                >
                  {item.label}
                </td>
                <td className="px-4 py-4">{formatNumber(item.views)}</td>
                <td className="px-4 py-4">{formatNumber(item.conversions)}</td>
                <td className="px-4 py-4">{item.ctr}%</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-6 text-center text-muted" colSpan={4}>
                No {kind} data recorded for this day yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CampaignSelector({
  releaseOptions,
  selectedReleaseId
}: {
  releaseOptions: Array<{
    ad_batch_count: number;
    analytics_event_count: number;
    id: string;
    release_date: string;
    title: string;
    type: string;
  }>;
  selectedReleaseId?: string;
}) {
  return (
    <form
      action="/admin/attribution"
      className="grid gap-3 rounded-[22px] border border-[#30343b] bg-[#101216] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <label className="block">
        <span className="field-label">Campaign release</span>
        <select
          className="mt-2 w-full rounded-[16px] border border-[#30343b] bg-[#0b0d10] px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-[#c9a347]"
          defaultValue={selectedReleaseId ?? ""}
          name="releaseId"
        >
          {releaseOptions.length > 0 ? (
            releaseOptions.map((release) => (
              <option key={release.id} value={release.id}>
                {release.title}
                {release.release_date ? ` - ${release.release_date}` : ""}
              </option>
            ))
          ) : (
            <option value="">No releases available</option>
          )}
        </select>
      </label>
      <button className="btn-primary justify-center" type="submit">
        Load Campaign
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

function FunnelStage({
  helper,
  label,
  value
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#30343b] bg-[#0f1114] p-4">
      <p className="field-label">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </div>
  );
}

function WinnerCard({
  detail,
  empty,
  label,
  title
}: {
  detail: string;
  empty?: boolean;
  label: string;
  title: string;
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 ${
        empty
          ? "border-dashed border-[#30343b] bg-[#0f1114]"
          : "border-[#4a3c1d] bg-[#17140d]"
      }`}
    >
      <p className="field-label">{label}</p>
      <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function SignalList({
  signals
}: {
  signals: Array<{severity: "good" | "risk" | "warning"; text: string}>;
}) {
  const toneBySeverity = {
    good: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    risk: "border-orange-500/30 bg-orange-500/10 text-orange-100",
    warning: "border-red-500/30 bg-red-500/10 text-red-100"
  };

  return (
    <div className="space-y-3">
      {signals.length > 0 ? signals.map((signal) => (
        <div
          className={`flex gap-3 rounded-[18px] border px-4 py-3 text-sm leading-6 ${toneBySeverity[signal.severity]}`}
          key={signal.text}
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{signal.text}</span>
        </div>
      )) : (
        <div className="rounded-[18px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
          No major tracking issues flagged for this view.
        </div>
      )}
    </div>
  );
}

export default async function AdminAttributionPage({
  searchParams
}: {
  searchParams: Promise<{breakdown?: string; date?: string; releaseId?: string}>;
}) {
  const params = await searchParams;
  const [analytics, commandDashboard] = await Promise.all([
    readLinkPageAnalytics(30),
    readCampaignCommandDashboard({
      days: 30,
      releaseId: params.releaseId
    })
  ]);
  const selectedReleaseId = commandDashboard.selected_release?.id;
  const activeBreakdown = normalizeBreakdownKind(params.breakdown);
  const selectedDate =
    analytics.daily.find((day) => day.date === params.date)?.date ??
    analytics.daily[0]?.date ??
    "";
  const selectedDay =
    analytics.daily.find((day) => day.date === selectedDate) ?? analytics.daily[0];
  const selectedBreakdownLabel =
    breakdownOptions.find((option) => option.kind === activeBreakdown)?.label ?? "Country";
  const selectedBreakdownItems = selectedDay?.breakdowns[activeBreakdown] ?? [];

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <BarChart3 size={12} />
                Attribution Dashboard
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                One view for spend, traffic, and stream intent
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Select a release to read Meta CSV performance beside first-party
                `/links` behavior. The goal is fast campaign judgment: what is working,
                what is leaking, and what should happen next.
              </p>
            </div>
            <div className="rounded-[18px] border border-[#30343b] bg-[#121418] px-4 py-3 text-sm text-muted">
              Last update: {formatTimestamp(commandDashboard.updated_at)}
            </div>
          </div>

          <div className="mt-6">
            <CampaignSelector
              releaseOptions={commandDashboard.release_options}
              selectedReleaseId={selectedReleaseId}
            />
          </div>
        </section>

        {commandDashboard.selected_release && "overview" in commandDashboard ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={DollarSign}
                label="Spend"
                note={commandDashboard.ad_metrics.source_label}
                value={formatMoney(commandDashboard.overview.spend)}
              />
              <MetricCard
                icon={Target}
                label="Streaming Clicks"
                note="Spotify, Apple, YouTube Music, or YouTube outbound clicks."
                value={formatNumber(commandDashboard.overview.streaming_clicks)}
              />
              <MetricCard
                icon={TrendingUp}
                label="Cost / Stream"
                note="Ad spend divided by tracked streaming clicks."
                value={formatOptionalMoney(commandDashboard.overview.cost_per_streaming_click)}
              />
              <MetricCard
                icon={Link2}
                label="UTM Coverage"
                note="Tracked /links views with campaign or content UTM values."
                value={formatOptionalPercent(commandDashboard.overview.utm_coverage_rate)}
              />
              <FunnelVerdictCard value={commandDashboard.recommended_next_move} />
            </section>

            <section className="panel overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#30343b] px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">Campaign funnel</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    {commandDashboard.selected_release.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    The core funnel from Meta delivery to first-party stream intent.
                  </p>
                </div>
                <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {commandDashboard.days} days
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-5">
                <FunnelStage
                  helper="Top-of-funnel delivery from Meta import."
                  label="Meta impressions"
                  value={formatNumber(commandDashboard.funnel[0]?.value ?? 0)}
                />
                <FunnelStage
                  helper={`${formatOptionalPercent(commandDashboard.ad_metrics.ctr)} CTR from imported ad rows.`}
                  label="Meta link clicks"
                  value={formatNumber(commandDashboard.funnel[1]?.value ?? 0)}
                />
                <FunnelStage
                  helper={`${formatOptionalPercent(commandDashboard.overview.click_to_lpv_rate)} click-to-LPV rate from Meta.`}
                  label="Meta landing views"
                  value={formatNumber(commandDashboard.funnel[2]?.value ?? 0)}
                />
                <FunnelStage
                  helper={`${formatOptionalPercent(commandDashboard.overview.tracked_view_coverage_rate)} of Meta LPV tracked first-party.`}
                  label="/links views"
                  value={formatNumber(commandDashboard.funnel[3]?.value ?? 0)}
                />
                <FunnelStage
                  helper={`${formatOptionalPercent(commandDashboard.overview.meta_click_to_stream_rate)} Meta click-to-stream intent.`}
                  label="Streaming clicks"
                  value={formatNumber(commandDashboard.funnel[4]?.value ?? 0)}
                />
              </div>
            </section>

            <section className="panel p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="field-label">Attribution quality</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    Trust check before decisions
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Combines tracking health and watchlist signals so you can tell
                    whether the funnel is clean enough to trust.
                  </p>
                </div>
                <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Attribution v2
                </div>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FunnelStage
                    helper="Tracked page views carrying campaign or content UTM data."
                    label="UTM coverage"
                    value={formatOptionalPercent(commandDashboard.tracking_health.utm_coverage_rate)}
                  />
                  <FunnelStage
                    helper="First-party /links views divided by Meta landing page views."
                    label="Tracked LPV coverage"
                    value={formatOptionalPercent(commandDashboard.tracking_health.tracked_view_coverage_rate)}
                  />
                  <FunnelStage
                    helper="Tracked /links views without campaign/content attribution."
                    label="Views without UTM"
                    value={formatNumber(commandDashboard.tracking_health.views_without_utm)}
                  />
                  <FunnelStage
                    helper="Meta LPV minus first-party /links views. Privacy tools can create some gap."
                    label="Estimated untracked views"
                    value={formatNumber(commandDashboard.tracking_health.estimated_untracked_views)}
                  />
                </div>
                <div>
                  <p className="field-label">Signals to check</p>
                  <div className="mt-3">
                    <SignalList signals={commandDashboard.problem_signals} />
                  </div>
                </div>
              </div>
            </section>

            <section className="panel p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="text-[#d7b45e]" size={18} />
                    <h2 className="text-2xl font-semibold text-ink">Current winners</h2>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Compact winners only. Open Ad Lab or the release campaign history for deeper creative analysis.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="action-button-secondary !w-auto"
                    href={`/admin/ad-lab${selectedReleaseId ? `?releaseId=${selectedReleaseId}` : ""}`}
                  >
                    Open Ad Lab
                    <ArrowRight size={16} />
                  </Link>
                  {selectedReleaseId ? (
                    <Link
                      className="action-button-secondary !w-auto"
                      href={`/admin/releases/${selectedReleaseId}#campaign-history`}
                    >
                      Campaign History
                      <ArrowRight size={16} />
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <WinnerCard
                  detail={
                    commandDashboard.winners.best_ad
                      ? `${formatOptionalMoney(commandDashboard.winners.best_ad.cpr)} CPR, ${formatOptionalPercent(commandDashboard.winners.best_ad.ctr)} CTR`
                      : "Import Meta CSV rows to identify the strongest ad."
                  }
                  empty={!commandDashboard.winners.best_ad}
                  label="Best ad"
                  title={commandDashboard.winners.best_ad?.ad_name ?? "No ad winner yet"}
                />
                <WinnerCard
                  detail={
                    commandDashboard.winners.best_hook
                      ? `${formatNumber(commandDashboard.winners.best_hook.results)} results from ${formatMoney(commandDashboard.winners.best_hook.spend)} spend`
                      : "Link top ads to Copy Lab entries to unlock strategy winners."
                  }
                  empty={!commandDashboard.winners.best_hook}
                  label="Best copy angle / hook"
                  title={commandDashboard.winners.best_hook?.label ?? "No hook signal yet"}
                />
                <WinnerCard
                  detail={
                    commandDashboard.winners.top_platform
                      ? `${formatNumber(commandDashboard.winners.top_platform.value)} tracked outbound clicks`
                      : "Streaming button clicks have not been recorded yet."
                  }
                  empty={!commandDashboard.winners.top_platform}
                  label="Top platform"
                  title={commandDashboard.winners.top_platform?.label ?? "No platform winner yet"}
                />
                <WinnerCard
                  detail={
                    commandDashboard.winners.top_source
                      ? `${formatNumber(commandDashboard.winners.top_source.value)} tracked events`
                      : "UTM or referrer data will appear after traffic arrives."
                  }
                  empty={!commandDashboard.winners.top_source}
                  label="Top source"
                  title={commandDashboard.winners.top_source?.label ?? "No source signal yet"}
                />
              </div>
            </section>

            {commandDashboard.short_links.active_count > 0 ? (
              <section className="panel overflow-hidden p-0">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#30343b] px-4 py-5 sm:px-6">
                  <div>
                    <p className="field-label">Short links</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      Campaign handoff links
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                      Branded redirects attached to this release, kept separate from deeper attribution math.
                    </p>
                  </div>
                  <Link className="action-button-secondary" href="/admin/short-links">
                    Manage Short Links
                    <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <FunnelStage
                      helper="Clicks across active short links attached to this release."
                      label="Total short-link clicks"
                      value={formatNumber(commandDashboard.short_links.total_clicks)}
                    />
                    <FunnelStage
                      helper="Active branded redirects connected to this release."
                      label="Active short links"
                      value={formatNumber(commandDashboard.short_links.active_count)}
                    />
                    <FunnelStage
                      helper={
                        commandDashboard.short_links.top_link
                          ? commandDashboard.short_links.top_link.short_path
                          : "Attach short links to this release to identify a top link."
                      }
                      label="Top short link"
                      value={
                        commandDashboard.short_links.top_link
                          ? formatNumber(commandDashboard.short_links.top_link.click_count)
                          : "0"
                      }
                    />
                  </div>

                  <div className="overflow-x-auto rounded-[22px] border border-[#30343b]">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-[#171a1f] text-[#b8bec6]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Short Link</th>
                          <th className="px-4 py-3 font-semibold">Campaign / Content</th>
                          <th className="px-4 py-3 font-semibold">Clicks</th>
                          <th className="px-4 py-3 font-semibold">Destination</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252a31]">
                        {commandDashboard.short_links.links.map((link) => (
                          <tr className="align-top text-[#d9dee5]" key={link.id}>
                            <td className="px-4 py-4">
                              <Link
                                className="font-semibold text-[#f1dfad] transition hover:text-[#d7b45e]"
                                href={link.short_path}
                                target="_blank"
                              >
                                {link.short_path}
                              </Link>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {link.campaign_label ? (
                                  <span className="pill">Campaign: {link.campaign_label}</span>
                                ) : null}
                                {link.content_label ? (
                                  <span className="pill">Content: {link.content_label}</span>
                                ) : null}
                                {!link.campaign_label && !link.content_label ? (
                                  <span className="text-muted">No labels yet</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 font-semibold text-ink">
                              {formatNumber(link.click_count)}
                            </td>
                            <td className="max-w-[300px] px-4 py-4">
                              <p className="break-all text-muted">{link.destination_url}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : (
              <section className="panel flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">Short links</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">No release short links yet</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    No short links attached to this release. Create one to track branded redirects.
                  </p>
                </div>
                <Link className="action-button-secondary" href="/admin/short-links">
                  Create Short Link
                  <ArrowRight size={16} />
                </Link>
              </section>
            )}

            <section className="panel overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#30343b] px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">UTM creative matrix</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    Meta to /links Match Matrix
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Matches imported Meta rows to first-party `/links` behavior when
                    exported UTMs line up, or when Meta omits URL params and the ad name
                    matches first-party `utm_content`. Use this to decide which creative
                    deserves more budget, a retest, or a landing-page fix.
                  </p>
                </div>
                <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {commandDashboard.attribution.source_batch_type || "No batch"}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px] text-left text-sm">
                  <thead className="bg-[#171a1f] text-[#b8bec6]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Creative / UTM</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Spend</th>
                      <th className="px-4 py-3 font-semibold">Results</th>
                      <th className="px-4 py-3 font-semibold">Meta Clicks</th>
                      <th className="px-4 py-3 font-semibold">Meta LPV</th>
                      <th className="px-4 py-3 font-semibold">/links Views</th>
                      <th className="px-4 py-3 font-semibold">Stream Clicks</th>
                      <th className="px-4 py-3 font-semibold">Click to LPV</th>
                      <th className="px-4 py-3 font-semibold">LPV Tracked</th>
                      <th className="px-4 py-3 font-semibold">View to Stream</th>
                      <th className="px-4 py-3 font-semibold">Cost / Stream</th>
                      <th className="px-4 py-3 font-semibold">Platform Split</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252a31]">
                    {commandDashboard.attribution.rows.length > 0 ? (
                      commandDashboard.attribution.rows.map((row) => (
                        <tr className="align-top text-[#d9dee5]" key={`${row.utm_campaign}-${row.utm_content}-${row.ad_name}`}>
                          <td className="max-w-[300px] px-4 py-4">
                            <p className="font-semibold text-ink">{row.label}</p>
                            {row.ad_name ? (
                              <p className="mt-1 text-xs text-muted">{row.ad_name}</p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className={getTrackingStatusClass(row.tracking_status)}>
                              {getTrackingStatusLabel(row.tracking_status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">{formatMoney(row.spend)}</td>
                          <td className="px-4 py-4">{formatNumber(row.results)}</td>
                          <td className="px-4 py-4">{formatNumber(row.meta_link_clicks)}</td>
                          <td className="px-4 py-4">{formatNumber(row.meta_landing_page_views)}</td>
                          <td className="px-4 py-4">{formatNumber(row.links_page_views)}</td>
                          <td className="px-4 py-4">{formatNumber(row.streaming_clicks)}</td>
                          <td className="px-4 py-4">{formatOptionalPercent(row.click_to_lpv_rate)}</td>
                          <td className="px-4 py-4">{formatOptionalPercent(row.lpv_to_tracked_view_rate)}</td>
                          <td className="px-4 py-4">{formatOptionalPercent(row.view_to_stream_rate)}</td>
                          <td className="px-4 py-4">{formatOptionalMoney(row.cost_per_streaming_click)}</td>
                          <td className="px-4 py-4 text-xs leading-5 text-muted">
                            Spotify {formatNumber(row.spotify_clicks)} / Apple {formatNumber(row.apple_music_clicks)} / YouTube {formatNumber(row.youtube_clicks)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-7 text-center text-muted" colSpan={13}>
                          No attribution rows yet. Import a Meta export and send campaign
                          traffic to `/links` with `utm_campaign` and `utm_content`; if Meta
                          omits URL params, matching ad names can still connect first-party data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <details className="panel overflow-hidden p-0">
              <summary className="cursor-pointer list-none border-b border-[#30343b] px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Advanced diagnostics</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      Raw /links analytics and breakdowns
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                      Open when you need the original country, source, link, UTM, and daily drill-down tables.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    Collapsed by default
                  </span>
                </div>
              </summary>

              <div className="space-y-6 p-4 sm:p-6">
                <section className="grid gap-4 xl:grid-cols-4">
                  <BreakdownList
                    emptyText="No streaming platform clicks recorded for this release yet."
                    items={commandDashboard.breakdowns.platforms.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: commandDashboard.overview.links_page_views
                    }))}
                    title="Campaign platforms"
                  />
                  <BreakdownList
                    emptyText="No source data recorded for this release yet."
                    items={commandDashboard.breakdowns.sources.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: commandDashboard.overview.links_page_views
                    }))}
                    title="Campaign sources"
                  />
                  <BreakdownList
                    emptyText="No clicked links recorded for this release yet."
                    items={commandDashboard.breakdowns.links.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: commandDashboard.overview.links_page_views
                    }))}
                    title="Campaign links"
                  />
                  <BreakdownList
                    emptyText="No UTM data recorded for this release yet."
                    items={commandDashboard.breakdowns.utms.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: commandDashboard.overview.links_page_views
                    }))}
                    title="Campaign UTM"
                    wrapLabels
                  />
                </section>

                <section className="panel overflow-hidden p-0">
                  <div className="border-b border-[#30343b] px-4 py-5 sm:px-6">
                    <p className="field-label">Recent link-hub trend</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Last 14 days</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="bg-[#171a1f] text-[#b8bec6]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Views</th>
                          <th className="px-4 py-3 font-semibold">Streaming clicks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252a31]">
                        {commandDashboard.daily_trend.map((day) => (
                          <tr className="text-[#d9dee5]" key={day.date}>
                            <td className="px-4 py-4 font-semibold">{formatDate(day.date)}</td>
                            <td className="px-4 py-4">{formatNumber(day.views)}</td>
                            <td className="px-4 py-4">{formatNumber(day.streamingClicks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard
                    icon={Activity}
                    label="Views"
                    note="All /links page loads in the selected window."
                    value={formatNumber(analytics.overview.views)}
                  />
                  <MetricCard
                    icon={MousePointerClick}
                    label="Conversions"
                    note="Outbound link clicks from the link hub."
                    value={formatNumber(analytics.overview.conversions)}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="CTR"
                    note="Conversions divided by page views."
                    value={`${analytics.overview.ctr}%`}
                  />
                  <MetricCard
                    icon={Users}
                    label="Unique Visitors"
                    note="Anonymous visitor cookie count."
                    value={formatNumber(analytics.overview.uniqueVisitors)}
                  />
                  <MetricCard
                    icon={Link2}
                    label="Unique Converters"
                    note="Unique visitors who clicked at least one link."
                    value={formatNumber(analytics.overview.uniqueConverters)}
                  />
                </section>

                <section className="panel overflow-hidden p-0">
                  <div className="border-b border-[#30343b] px-4 py-5 sm:px-6">
                    <p className="field-label">Daily analytics</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Last 30 days</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-[#171a1f] text-[#b8bec6]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Views</th>
                          <th className="px-4 py-3 font-semibold">Conversions</th>
                          <th className="px-4 py-3 font-semibold">CTR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252a31]">
                        {analytics.daily.map((day) => (
                          <tr className="text-[#d9dee5]" key={day.date}>
                            <td className="px-4 py-4 font-semibold">
                              {formatDate(day.date)}
                              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium normal-case">
                                {breakdownOptions.map((option, optionIndex) => (
                                  <span key={option.kind}>
                                    <Link
                                      className="text-[#a989ff] underline-offset-4 transition hover:text-[#d7b45e] hover:underline"
                                      href={getBreakdownHref({
                                        breakdown: option.kind,
                                        date: day.date,
                                        releaseId: selectedReleaseId
                                      })}
                                    >
                                      {option.linkLabel}
                                    </Link>
                                    {optionIndex < breakdownOptions.length - 1 ? (
                                      <span className="text-[#59616b]"> | </span>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">{formatNumber(day.views)}</td>
                            <td className="px-4 py-4">{formatNumber(day.conversions)}</td>
                            <td className="px-4 py-4">{day.ctr}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel overflow-hidden p-0" id="daily-breakdown">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#30343b] px-4 py-5 sm:px-6">
                    <div>
                      <p className="field-label">Daily breakdown</p>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">
                        {selectedDay ? formatDate(selectedDay.date) : "No data"} by {selectedBreakdownLabel}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {breakdownOptions.map((option) => (
                        <Link
                          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                            activeBreakdown === option.kind
                              ? "border-[#5b4920] bg-[#c9a347] text-[#14120d]"
                              : "border-[#30343b] bg-[#121418] text-[#d5d9df] hover:border-[#c9a347]/45 hover:text-[#d7b45e]"
                          }`}
                          href={getBreakdownHref({
                            breakdown: option.kind,
                            date: selectedDate,
                            releaseId: selectedReleaseId
                          })}
                          key={option.kind}
                        >
                          {option.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <BreakdownDetailTable items={selectedBreakdownItems} kind={activeBreakdown} />
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <BreakdownList
                    emptyText="No country data recorded yet."
                    items={analytics.breakdowns.country}
                    title="Breakdown by country"
                  />
                  <BreakdownList
                    emptyText="No source data recorded yet."
                    items={analytics.breakdowns.source}
                    title="Breakdown by source"
                  />
                  <BreakdownList
                    emptyText="No clicked links recorded yet."
                    items={analytics.breakdowns.link}
                    title="Breakdown by link"
                  />
                  <BreakdownList
                    emptyText="No UTM/source data recorded yet."
                    items={analytics.breakdowns.utm}
                    title="Breakdown by UTM"
                    wrapLabels
                  />
                </section>
              </div>
            </details>
          </>
        ) : (
          <section className="panel p-6 text-sm text-muted">
            Create a release first, then the campaign dashboard will have a release to analyze.
          </section>
        )}

        {commandDashboard.selected_release && "overview" in commandDashboard ? null : (
        <details className="panel overflow-hidden p-0">
          <summary className="cursor-pointer list-none border-b border-[#30343b] px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="pill">
                  <Activity size={12} />
                  Advanced diagnostics
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
                  All `/links` traffic
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                  The original raw analytics view is still here, collapsed so the main
                  page stays focused on campaign decisions.
                </p>
              </div>
              <span className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Open diagnostics
              </span>
            </div>
          </summary>

          <div className="space-y-6 p-4 sm:p-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={Activity}
                label="Views"
                note="All /links page loads in the selected window."
                value={formatNumber(analytics.overview.views)}
              />
              <MetricCard
                icon={MousePointerClick}
                label="Conversions"
                note="Outbound link clicks from the link hub."
                value={formatNumber(analytics.overview.conversions)}
              />
              <MetricCard
                icon={TrendingUp}
                label="CTR"
                note="Conversions divided by page views."
                value={`${analytics.overview.ctr}%`}
              />
              <MetricCard
                icon={Users}
                label="Unique Visitors"
                note="Anonymous visitor cookie count."
                value={formatNumber(analytics.overview.uniqueVisitors)}
              />
              <MetricCard
                icon={Link2}
                label="Unique Converters"
                note="Unique visitors who clicked at least one link."
                value={formatNumber(analytics.overview.uniqueConverters)}
              />
            </section>

            <section className="panel overflow-hidden p-0">
              <div className="border-b border-[#30343b] px-4 py-5 sm:px-6">
                <p className="field-label">Daily analytics</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Last 30 days</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#171a1f] text-[#b8bec6]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Views</th>
                      <th className="px-4 py-3 font-semibold">Conversions</th>
                      <th className="px-4 py-3 font-semibold">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252a31]">
                    {analytics.daily.map((day) => (
                      <tr className="text-[#d9dee5]" key={day.date}>
                        <td className="px-4 py-4 font-semibold">
                          {formatDate(day.date)}
                          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium normal-case">
                            {breakdownOptions.map((option, optionIndex) => (
                              <span key={option.kind}>
                                <Link
                                  className="text-[#a989ff] underline-offset-4 transition hover:text-[#d7b45e] hover:underline"
                                  href={getBreakdownHref({
                                    breakdown: option.kind,
                                    date: day.date,
                                    releaseId: selectedReleaseId
                                  })}
                                >
                                  {option.linkLabel}
                                </Link>
                                {optionIndex < breakdownOptions.length - 1 ? (
                                  <span className="text-[#59616b]"> | </span>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">{formatNumber(day.views)}</td>
                        <td className="px-4 py-4">{formatNumber(day.conversions)}</td>
                        <td className="px-4 py-4">{day.ctr}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel overflow-hidden p-0" id="daily-breakdown">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#30343b] px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">Daily breakdown</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    {selectedDay ? formatDate(selectedDay.date) : "No data"} by {selectedBreakdownLabel}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {breakdownOptions.map((option) => (
                    <Link
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        activeBreakdown === option.kind
                          ? "border-[#5b4920] bg-[#c9a347] text-[#14120d]"
                          : "border-[#30343b] bg-[#121418] text-[#d5d9df] hover:border-[#c9a347]/45 hover:text-[#d7b45e]"
                      }`}
                      href={getBreakdownHref({
                        breakdown: option.kind,
                        date: selectedDate,
                        releaseId: selectedReleaseId
                      })}
                      key={option.kind}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </div>
              <BreakdownDetailTable items={selectedBreakdownItems} kind={activeBreakdown} />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownList
                emptyText="No country data recorded yet."
                items={analytics.breakdowns.country}
                title="Breakdown by country"
              />
              <BreakdownList
                emptyText="No source data recorded yet."
                items={analytics.breakdowns.source}
                title="Breakdown by source"
              />
              <BreakdownList
                emptyText="No clicked links recorded yet."
                items={analytics.breakdowns.link}
                title="Breakdown by link"
              />
              <BreakdownList
                emptyText="No UTM/source data recorded yet."
                items={analytics.breakdowns.utm}
                title="Breakdown by UTM"
                wrapLabels
              />
            </section>
          </div>
        </details>
        )}
      </div>
    </main>
  );
}
