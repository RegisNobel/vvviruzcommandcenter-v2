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

function BreakdownList({
  emptyText,
  items,
  title
}: {
  emptyText: string;
  items: AnalyticsBreakdownItem[];
  title: string;
}) {
  return (
    <section className="rounded-[26px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="flex items-center justify-between gap-4 rounded-[18px] border border-[#252a31] bg-[#0f1114] px-4 py-3"
              key={item.label}
            >
              <span className="min-w-0 truncate text-sm text-[#d9dee5]">{item.label}</span>
              <span className="pill">
                {formatNumber(item.conversions)} / {formatNumber(item.views)}
              </span>
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
                <td className="px-4 py-4 font-semibold">{item.label}</td>
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
      {signals.map((signal) => (
        <div
          className={`flex gap-3 rounded-[18px] border px-4 py-3 text-sm leading-6 ${toneBySeverity[signal.severity]}`}
          key={signal.text}
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{signal.text}</span>
        </div>
      ))}
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
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                icon={DollarSign}
                label="Spend"
                note={commandDashboard.ad_metrics.source_label}
                value={formatMoney(commandDashboard.overview.spend)}
              />
              <MetricCard
                icon={MousePointerClick}
                label="Meta Clicks"
                note="Imported Meta link clicks for this release."
                value={formatNumber(commandDashboard.overview.meta_link_clicks)}
              />
              <MetricCard
                icon={Target}
                label="Meta LPV"
                note="Meta landing page views from Ad Lab v2 imports."
                value={formatNumber(commandDashboard.overview.meta_landing_page_views)}
              />
              <MetricCard
                icon={Radio}
                label="/links Views"
                note="First-party link hub page views for this release."
                value={formatNumber(commandDashboard.overview.links_page_views)}
              />
              <MetricCard
                icon={Target}
                label="Streaming Clicks"
                note="Spotify, Apple, YouTube Music, or YouTube outbound clicks."
                value={formatNumber(commandDashboard.overview.streaming_clicks)}
              />
              <MetricCard
                icon={Gauge}
                label="Click to LPV"
                note="Meta landing page views divided by Meta link clicks."
                value={formatOptionalPercent(commandDashboard.overview.click_to_lpv_rate)}
              />
              <MetricCard
                icon={Activity}
                label="LPV Tracked"
                note="First-party /links views divided by Meta landing page views."
                value={formatOptionalPercent(commandDashboard.overview.tracked_view_coverage_rate)}
              />
              <MetricCard
                icon={Link2}
                label="UTM Coverage"
                note="Tracked /links views with campaign or content UTM values."
                value={formatOptionalPercent(commandDashboard.overview.utm_coverage_rate)}
              />
              <MetricCard
                icon={Gauge}
                label="View to Stream"
                note="How often link-page visitors click through to streaming."
                value={formatOptionalPercent(commandDashboard.overview.view_to_stream_rate)}
              />
              <MetricCard
                icon={TrendingUp}
                label="LPV to Stream"
                note="Tracked streaming clicks divided by Meta landing page views."
                value={formatOptionalPercent(commandDashboard.overview.lpv_to_stream_rate)}
              />
              <MetricCard
                icon={TrendingUp}
                label="Cost / Stream"
                note="Ad spend divided by tracked streaming clicks."
                value={formatOptionalMoney(commandDashboard.overview.cost_per_streaming_click)}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="panel p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="field-label">Campaign funnel</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      {commandDashboard.selected_release.title}
                    </h2>
                  </div>
                  <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    {commandDashboard.days} days
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                <div className="mt-5 rounded-[20px] border border-[#30343b] bg-[#0f1114] p-4">
                  <p className="field-label">Recommended next move</p>
                  <p className="mt-2 text-sm leading-6 text-[#d9dee5]">
                    {commandDashboard.recommended_next_move}
                  </p>
                </div>
              </div>

              <div className="panel p-4 sm:p-6">
                <p className="field-label">Watchlist</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Signals to check</h2>
                <div className="mt-5">
                  <SignalList signals={commandDashboard.problem_signals} />
                </div>
              </div>
            </section>

            <section className="panel p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="field-label">Tracking health</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    Meta LPV vs first-party tracking
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    This checks whether Meta landing-page activity, first-party page views,
                    and UTM tagging are lining up well enough to trust ad-level decisions.
                  </p>
                </div>
                <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Attribution v2
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FunnelStage
                  helper="First-party /links views divided by Meta landing page views."
                  label="Tracked LPV coverage"
                  value={formatOptionalPercent(commandDashboard.tracking_health.tracked_view_coverage_rate)}
                />
                <FunnelStage
                  helper="Meta LPV minus first-party /links views. Privacy tools can create some gap."
                  label="Estimated untracked views"
                  value={formatNumber(commandDashboard.tracking_health.estimated_untracked_views)}
                />
                <FunnelStage
                  helper="Tracked page views carrying campaign or content UTM data."
                  label="UTM coverage"
                  value={formatOptionalPercent(commandDashboard.tracking_health.utm_coverage_rate)}
                />
                <FunnelStage
                  helper="Tracked /links views without campaign/content attribution."
                  label="Views without UTM"
                  value={formatNumber(commandDashboard.tracking_health.views_without_utm)}
                />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="panel p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Trophy className="text-[#d7b45e]" size={18} />
                  <h2 className="text-2xl font-semibold text-ink">Current winners</h2>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                    label="Best hook strategy"
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
              </div>

              <div className="panel overflow-hidden p-0">
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
              </div>
            </section>

            <section className="panel overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#30343b] px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">UTM creative matrix</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">
                    Meta to /links attribution by ad content
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Matches imported Meta rows to first-party `/links` behavior when
                    `utm_campaign` and `utm_content` line up. Use this to decide which
                    creative deserves more budget, a retest, or a landing-page fix.
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
                          <td className="px-4 py-4">
                            <span className="pill">{row.tracking_status.replace(/_/g, " ")}</span>
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
                          No UTM attribution rows yet. Import a Meta export with URL parameters
                          and send campaign traffic to `/links` with matching `utm_campaign`
                          and `utm_content` values.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

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
              />
            </section>
          </>
        ) : (
          <section className="panel p-6 text-sm text-muted">
            Create a release first, then the campaign dashboard will have a release to analyze.
          </section>
        )}

        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Activity size={12} />
                Raw link analytics
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
                All `/links` traffic
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                This drill-down keeps the original analytics view intact for country,
                source, link, and UTM inspection across the full link hub.
              </p>
            </div>
            <Link className="btn-secondary" href="/admin/ad-lab">
              Open Ad Lab
              <ArrowRight size={16} />
            </Link>
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
          />
        </section>
      </div>
    </main>
  );
}
