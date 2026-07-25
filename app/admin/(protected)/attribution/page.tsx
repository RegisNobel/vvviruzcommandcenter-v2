export const dynamic = "force-dynamic";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  ExternalLink,
  Link2,
  MousePointerClick,
  Radio,
  Target,
  TrendingUp,
  Users
} from "lucide-react";
import Link from "next/link";

import {ReleasePicker} from "@/components/release-picker";
import {
  readLinkPageAnalytics,
  type AnalyticsBreakdownItem,
  type AnalyticsBreakdownKind,
  type LinkPageAnalyticsSummary
} from "@/lib/repositories/analytics";
import {readCampaignCommandDashboard} from "@/lib/repositories/campaign-dashboard";

const breakdownOptions: Array<{kind: AnalyticsBreakdownKind; label: string; linkLabel: string}> = [
  {kind: "country", label: "Country", linkLabel: "by country"},
  {kind: "source", label: "Source", linkLabel: "source"},
  {kind: "link", label: "By link", linkLabel: "by link"},
  {kind: "utm", label: "UTM", linkLabel: "utm"},
  {kind: "hub", label: "Link Hub", linkLabel: "by link hub"}
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
  return typeof value === "number" && Number.isFinite(value) ? formatMoney(value) : "No signal";
}

function formatOptionalPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "No signal";
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

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

function buildAttributionHref({
  breakdown,
  date,
  diagnostics,
  releaseId,
  trendDays
}: {
  breakdown?: string;
  date?: string;
  diagnostics?: boolean;
  releaseId?: string;
  trendDays?: number;
}) {
  const params = new URLSearchParams();

  if (releaseId) params.set("releaseId", releaseId);
  if (breakdown) params.set("breakdown", breakdown);
  if (date) params.set("date", date);
  if (trendDays) params.set("trendDays", trendDays.toString());
  if (diagnostics) params.set("diagnostics", "1");

  return `/admin/attribution${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function calculateStreamRate(views: number, clicks: number) {
  if (views <= 0) {
    return "0.0%";
  }

  return `${(Math.round((clicks / views) * 1000) / 10).toFixed(1)}%`;
}

function getTrackingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    first_party_only: "FIRST PARTY",
    matched: "MATCHED",
    meta_only: "META CSV ONLY",
    meta_snapshot: "META SNAPSHOT",
    missing_utm: "META SNAPSHOT",
    name_matched: "AD NAME MATCH"
  };

  return labels[status] ?? status.replace(/_/g, " ").toUpperCase();
}

function getTrackingStatusClass(status: string) {
  if (status === "matched") return "status-badge-ready whitespace-nowrap";
  if (status === "meta_only") return "status-badge-warning whitespace-nowrap";
  if (status === "first_party_only" || status === "name_matched") {
    return "status-badge-info whitespace-nowrap";
  }
  if (status === "meta_snapshot" || status === "missing_utm") {
    return "status-badge-neutral whitespace-nowrap";
  }

  return "pill whitespace-nowrap";
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
    <div className="rounded-xl border border-edge bg-surface-elevated px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">{label}</p>
        <span className="rounded-lg border border-[rgba(246,201,69,0.32)] bg-brand-primary-soft p-2 text-brand-primary">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function FunnelStatusCard({
  status
}: {
  status: {detail: string; label: string; tone: "context" | "healthy" | "warning"};
}) {
  const tone =
    status.tone === "healthy"
      ? "border-[rgba(79,191,136,0.32)] bg-[var(--status-success-soft)]"
      : status.tone === "warning"
        ? "border-[rgba(230,162,60,0.34)] bg-[var(--status-warning-soft)]"
        : "border-[rgba(94,168,255,0.3)] bg-[var(--status-info-soft)]";

  return (
    <section className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4 ${tone}`}>
      <div>
        <p className="field-label">Funnel status</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">{status.label}</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted">{status.detail}</p>
      </div>
      <span className="status-badge-info whitespace-nowrap">Funnel only</span>
    </section>
  );
}

function FunnelStage({helper, label, value}: {helper: string; label: string; value: string}) {
  return (
    <div className="rounded-xl border border-edge bg-surface-elevated p-4">
      <p className="field-label">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
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
          className={`flex gap-3 rounded-lg border px-4 py-3 text-sm leading-6 ${toneBySeverity[signal.severity]}`}
          key={signal.text}
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{signal.text}</span>
        </div>
      ))}
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
      className="grid gap-3 rounded-xl border border-edge bg-surface-elevated p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div>
        <span className="field-label">Campaign release</span>
        <ReleasePicker
          ariaLabel="Select campaign release"
          className="mt-2"
          defaultValue={selectedReleaseId ?? ""}
          name="releaseId"
          placeholder="No releases available"
          releases={releaseOptions}
        />
      </div>
      <button className="btn-primary justify-center" type="submit">
        Load Campaign
        <ArrowRight size={16} />
      </button>
    </form>
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
    <section className="rounded-xl border border-edge bg-surface-elevated p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div
            className={
              wrapLabels
                ? "rounded-lg border border-edge bg-surface px-4 py-3"
                : "flex items-center justify-between gap-4 rounded-lg border border-edge bg-surface px-4 py-3"
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
                <p className="mt-2 break-all text-sm leading-6 text-ink">{item.label}</p>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate text-sm text-ink">{item.label}</span>
                <span className="pill shrink-0">
                  {formatNumber(item.conversions)} / {formatNumber(item.views)}
                </span>
              </>
            )}
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-edge-strong bg-surface px-4 py-4 text-sm text-muted">
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
  const countLabel = kind === "link" ? "Clicks" : "All Outbound Clicks";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-surface-elevated text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">Segment</th>
            <th className="px-4 py-3 font-semibold">Views</th>
            <th className="px-4 py-3 font-semibold">{countLabel}</th>
            <th className="px-4 py-3 font-semibold">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {items.length > 0 ? items.map((item) => (
            <tr className="text-ink transition hover:bg-surface-hover" key={item.label}>
              <td className={`px-4 py-4 font-semibold ${kind === "utm" ? "max-w-[520px] break-all leading-6" : ""}`}>
                {item.label}
              </td>
              <td className="px-4 py-4">{formatNumber(item.views)}</td>
              <td className="px-4 py-4">{formatNumber(item.conversions)}</td>
              <td className="px-4 py-4">{item.ctr}%</td>
            </tr>
          )) : (
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

function RawLinkDiagnostics({
  analytics,
  breakdown,
  date,
  releaseId,
  trendDays
}: {
  analytics: LinkPageAnalyticsSummary;
  breakdown?: string;
  date?: string;
  releaseId?: string;
  trendDays: number;
}) {
  const activeBreakdown = normalizeBreakdownKind(breakdown);
  const selectedDate =
    analytics.daily.find((day) => day.date === date)?.date ??
    analytics.daily[0]?.date ??
    "";
  const selectedDay =
    analytics.daily.find((day) => day.date === selectedDate) ?? analytics.daily[0];
  const selectedBreakdownLabel =
    breakdownOptions.find((option) => option.kind === activeBreakdown)?.label ?? "Country";
  const selectedBreakdownItems = selectedDay?.breakdowns[activeBreakdown] ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Activity}
          label="Views"
          note="All /links page loads in the 30-day diagnostic window."
          value={formatNumber(analytics.overview.views)}
        />
        <MetricCard
          icon={MousePointerClick}
          label="All Outbound Clicks"
          note="Every outbound click from /links, including non-streaming destinations."
          value={formatNumber(analytics.overview.conversions)}
        />
        <MetricCard
          icon={TrendingUp}
          label="Outbound Rate"
          note="All outbound clicks divided by /links page views."
          value={`${analytics.overview.ctr}%`}
        />
        <MetricCard
          icon={Users}
          label="Unique Visitors"
          note="Anonymous visitor-cookie count for /links."
          value={formatNumber(analytics.overview.uniqueVisitors)}
        />
        <MetricCard
          icon={Link2}
          label="Unique Clickers"
          note="Unique visitors who clicked at least one /links destination."
          value={formatNumber(analytics.overview.uniqueConverters)}
        />
      </section>

      <section className="command-surface overflow-hidden p-0">
        <div className="border-b border-edge px-4 py-5 sm:px-6">
          <p className="field-label">Global /links activity</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">Last 30 days</h3>
          <p className="mt-2 text-xs leading-5 text-muted">
            Diagnostic-only totals across releases. These are not the selected release funnel.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-elevated text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 font-semibold">All Outbound Clicks</th>
                <th className="px-4 py-3 font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {analytics.daily.map((day) => (
                <tr className="text-ink transition hover:bg-surface-hover" key={day.date}>
                  <td className="px-4 py-4 font-semibold">
                    {formatDate(day.date)}
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium normal-case">
                      {breakdownOptions.map((option, optionIndex) => (
                        <span key={option.kind}>
                          <Link
                            className="text-[#a989ff] underline-offset-4 transition hover:text-brand-primary hover:underline"
                            href={`${buildAttributionHref({
                              breakdown: option.kind,
                              date: day.date,
                              diagnostics: true,
                              releaseId,
                              trendDays
                            })}#daily-breakdown`}
                          >
                            {option.linkLabel}
                          </Link>
                          {optionIndex < breakdownOptions.length - 1 ? (
                            <span className="text-muted"> | </span>
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

      <section className="command-surface overflow-hidden p-0" id="daily-breakdown">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge px-4 py-5 sm:px-6">
          <div>
            <p className="field-label">Daily breakdown</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">
              {selectedDay ? formatDate(selectedDay.date) : "No data"} by {selectedBreakdownLabel}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {breakdownOptions.map((option) => (
              <Link
                className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeBreakdown === option.kind
                    ? "border-[rgba(246,201,69,0.65)] bg-brand-primary text-inverse"
                    : "border-edge bg-surface-elevated text-secondary hover:border-[rgba(246,201,69,0.45)] hover:text-brand-primary"
                }`}
                href={`${buildAttributionHref({
                  breakdown: option.kind,
                  date: selectedDate,
                  diagnostics: true,
                  releaseId,
                  trendDays
                })}#daily-breakdown`}
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
        <BreakdownList emptyText="No country data recorded yet." items={analytics.breakdowns.country} title="By country" />
        <BreakdownList emptyText="No source data recorded yet." items={analytics.breakdowns.source} title="By source" />
        <BreakdownList emptyText="No clicked links recorded yet." items={analytics.breakdowns.link} title="By link" />
        <BreakdownList emptyText="No UTM/source data recorded yet." items={analytics.breakdowns.utm} title="By UTM" wrapLabels />
        <BreakdownList emptyText="No link-hub data recorded yet." items={analytics.breakdowns.hub} title="By link hub" />
      </section>
    </div>
  );
}

export default async function AdminAttributionPage({
  searchParams
}: {
  searchParams: Promise<{
    breakdown?: string;
    date?: string;
    diagnostics?: string;
    releaseId?: string;
    trendDays?: string;
  }>;
}) {
  const params = await searchParams;
  const trendDays = typeof params.trendDays === "string" ? parseInt(params.trendDays, 10) : 14;
  const safeTrendDays = Number.isNaN(trendDays) || ![14, 30].includes(trendDays) ? 14 : trendDays;
  const showDiagnostics = params.diagnostics === "1";
  const [commandDashboard, analytics] = await Promise.all([
    readCampaignCommandDashboard({
      days: 30,
      trendDays: safeTrendDays,
      releaseId: params.releaseId
    }),
    showDiagnostics ? readLinkPageAnalytics(30) : Promise.resolve(null)
  ]);
  const selectedReleaseId = commandDashboard.selected_release?.id;
  const dashboard = commandDashboard.selected_release && "overview" in commandDashboard
    ? commandDashboard
    : null;

  return (
    <main className="bg-app px-4 py-5 text-primary sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="command-surface overflow-hidden px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="status-badge-neutral uppercase tracking-[0.14em]">
                <BarChart3 size={12} />
                Attribution Dashboard
              </div>
              <h1 className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.35rem]">
                From paid delivery to streaming intent
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Compare Meta delivery with measured arrivals across `/links` and playlist campaigns,
                then verify whether that traffic continues to a streaming platform.
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface-elevated px-4 py-3 text-sm text-muted">
              Last update: {formatTimestamp(commandDashboard.updated_at)}
            </div>
          </div>

          <div className="mt-6">
            <CampaignSelector
              releaseOptions={commandDashboard.release_options}
              selectedReleaseId={selectedReleaseId}
            />
          </div>

          {selectedReleaseId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="action-button-secondary !w-auto px-3 py-1.5 text-xs" href={`/admin/releases/${selectedReleaseId}`}>
                Release Detail
                <ArrowRight size={12} />
              </Link>
              <Link className="action-button-secondary !w-auto px-3 py-1.5 text-xs" href={`/admin/ad-lab?releaseId=${selectedReleaseId}`}>
                Ad Lab
                <ArrowRight size={12} />
              </Link>
            </div>
          ) : null}
        </section>

        {dashboard ? (
          <>
            <section className="command-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="field-label">Measurement context</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{dashboard.ad_metrics.source_label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dashboard.ad_metrics.source_context?.reporting_start &&
                  dashboard.ad_metrics.source_context?.reporting_end ? (
                    <span className="status-badge-neutral">
                      Meta: {formatDate(dashboard.ad_metrics.source_context.reporting_start)} - {formatDate(dashboard.ad_metrics.source_context.reporting_end)}
                    </span>
                  ) : null}
                  <span className="status-badge-info">First party: last {dashboard.days} days</span>
                  <span className="status-badge-neutral">Short Links: lifetime</span>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={DollarSign} label="Spend" note={dashboard.ad_metrics.source_label} value={formatMoney(dashboard.overview.spend)} />
              <MetricCard
                icon={Radio}
                label="Tracked Arrivals"
                note={`${formatNumber(dashboard.overview.experience_breakdown.link_hub_views)} /links + ${formatNumber(dashboard.overview.experience_breakdown.playlist_arrivals)} playlist.`}
                value={formatNumber(dashboard.overview.links_page_views)}
              />
              <MetricCard
                icon={Target}
                label="Streaming Clicks"
                note="Outbound clicks to Spotify, Apple Music, YouTube Music, or YouTube."
                value={formatNumber(dashboard.overview.streaming_clicks)}
              />
              <MetricCard
                icon={TrendingUp}
                label="View to Stream"
                note="Streaming clicks divided by tracked destination arrivals."
                value={formatOptionalPercent(dashboard.overview.view_to_stream_rate)}
              />
              <MetricCard
                icon={Link2}
                label="Cost / Stream"
                note="Meta spend divided by tracked streaming clicks."
                value={formatOptionalMoney(dashboard.overview.cost_per_streaming_click)}
              />
            </section>

            <FunnelStatusCard status={dashboard.funnel_status} />

            <section className="command-surface overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge px-4 py-5 sm:px-6">
                <div>
                  <p className="field-label">Campaign funnel</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{dashboard.selected_release.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Meta delivery and first-party destination behavior are shown together without combining their reporting windows.
                  </p>
                </div>
                <div className="status-badge-neutral uppercase tracking-[0.14em]">
                  First party: {dashboard.days} days
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-5">
                <FunnelStage helper="Top-of-funnel delivery from the selected Meta metric source." label="Meta impressions" value={formatNumber(dashboard.funnel[0]?.value ?? 0)} />
                <FunnelStage helper={`${formatOptionalPercent(dashboard.ad_metrics.ctr)} CTR from imported ad rows.`} label="Meta link clicks" value={formatNumber(dashboard.funnel[1]?.value ?? 0)} />
                <FunnelStage helper={`${formatOptionalPercent(dashboard.overview.click_to_lpv_rate)} click-to-LPV rate reported by Meta.`} label="Meta landing views" value={formatNumber(dashboard.funnel[2]?.value ?? 0)} />
                <FunnelStage
                  helper={`${formatOptionalPercent(dashboard.overview.tracked_view_coverage_rate)} of Meta LPV measured first party.`}
                  label="Tracked arrivals"
                  value={formatNumber(dashboard.funnel[3]?.value ?? 0)}
                />
                <FunnelStage
                  helper={`${formatOptionalPercent(dashboard.overview.meta_click_to_stream_rate)} of Meta clicks produced measured stream intent.`}
                  label="Streaming clicks"
                  value={formatNumber(dashboard.funnel[4]?.value ?? 0)}
                />
              </div>
            </section>

            <section className="command-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="field-label">Attribution quality</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Can this funnel be trusted?</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    Tracking quality is guidance for interpreting the funnel, not a creative-performance verdict.
                  </p>
                </div>
                <span className="status-badge-info">Tracking context</span>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FunnelStage
                    helper="Arrivals carrying at least one campaign or content UTM value."
                    label="Arrival UTM coverage"
                    value={formatOptionalPercent(dashboard.tracking_health.utm_coverage_rate)}
                  />
                  <FunnelStage
                    helper="Arrivals carrying both campaign and content, the strongest ad-level matching state."
                    label="Ad-match coverage"
                    value={formatOptionalPercent(dashboard.tracking_health.ad_match_coverage_rate)}
                  />
                  <FunnelStage
                    helper="Tracked arrivals divided by Meta landing-page views."
                    label="Tracked LPV coverage"
                    value={formatOptionalPercent(dashboard.tracking_health.tracked_view_coverage_rate)}
                  />
                  <FunnelStage
                    helper={`${formatNumber(dashboard.tracking_health.views_with_partial_utm)} partial-context arrivals / ${formatNumber(dashboard.tracking_health.views_without_utm)} with no UTM.`}
                    label="Incomplete context"
                    value={formatNumber(
                      dashboard.tracking_health.views_with_partial_utm +
                      dashboard.tracking_health.views_without_utm
                    )}
                  />
                </div>
                <div>
                  <p className="field-label">Signals to check</p>
                  <div className="mt-3">
                    <SignalList signals={dashboard.problem_signals} />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="command-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="field-label">Experience split</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">Where measured intent happened</h2>
                  </div>
                  <span className="status-badge-info">Last {dashboard.days} days</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <FunnelStage helper={`${formatNumber(dashboard.overview.experience_breakdown.link_hub_streaming_clicks)} stream clicks.`} label="/links arrivals" value={formatNumber(dashboard.overview.experience_breakdown.link_hub_views)} />
                  <FunnelStage helper={`${formatNumber(dashboard.overview.experience_breakdown.playlist_streaming_clicks)} stream clicks.`} label="Playlist arrivals" value={formatNumber(dashboard.overview.experience_breakdown.playlist_arrivals)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="inset-surface p-4">
                    <p className="field-label">Top platform</p>
                    <p className="mt-2 font-semibold text-ink">{dashboard.winners.top_platform?.label ?? "No signal"}</p>
                  </div>
                  <div className="inset-surface p-4">
                    <p className="field-label">Top arrival source</p>
                    <p className="mt-2 break-words font-semibold text-ink">{dashboard.winners.top_source?.label ?? "No signal"}</p>
                  </div>
                </div>
              </div>

              <div className="command-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="field-label">Short Links</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">Branded campaign handoff</h2>
                  </div>
                  <Link className="action-button-secondary !w-auto px-3 py-2 text-xs" href="/admin/short-links">
                    Manage
                    <ExternalLink size={13} />
                  </Link>
                </div>
                {dashboard.short_links.links.length > 0 ? (
                  <>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="inset-surface p-3">
                        <p className="field-label">Active</p>
                        <p className="mt-2 text-xl font-semibold text-ink">{formatNumber(dashboard.short_links.active_count)}</p>
                      </div>
                      <div className="inset-surface p-3">
                        <p className="field-label">Archived</p>
                        <p className="mt-2 text-xl font-semibold text-ink">{formatNumber(dashboard.short_links.archived_count)}</p>
                      </div>
                      <div className="inset-surface p-3">
                        <p className="field-label">Paused</p>
                        <p className="mt-2 text-xl font-semibold text-ink">{formatNumber(dashboard.short_links.paused_count)}</p>
                      </div>
                      <div className="inset-surface p-3">
                        <p className="field-label">Lifetime clicks</p>
                        <p className="mt-2 text-xl font-semibold text-ink">{formatNumber(dashboard.short_links.total_clicks)}</p>
                      </div>
                    </div>
                    <div className="mt-4 inset-surface p-4">
                      <p className="field-label">Top link</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{dashboard.short_links.top_link?.short_path}</p>
                        <span className="status-badge-neutral">
                          {formatNumber(dashboard.short_links.top_link?.click_count ?? 0)} lifetime clicks
                        </span>
                      </div>
                      {dashboard.short_links.top_link?.campaign_label || dashboard.short_links.top_link?.content_label ? (
                        <p className="mt-2 text-xs leading-5 text-muted">
                          {[dashboard.short_links.top_link.campaign_label, dashboard.short_links.top_link.content_label]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-edge-strong bg-surface-elevated p-5">
                    <p className="font-semibold text-ink">No short links attached to this release.</p>
                    <p className="mt-2 text-sm text-muted">Create one to track branded redirects without adding another dashboard here.</p>
                  </div>
                )}
              </div>
            </section>

            <details className="command-surface overflow-hidden p-0">
              <summary className="cursor-pointer list-none px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Trend</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">Daily arrivals and stream intent</h2>
                    <p className="mt-2 text-sm text-muted">Open when you need to inspect movement by day.</p>
                  </div>
                  <span className="status-badge-neutral">Collapsed</span>
                </div>
              </summary>
              <div className="border-t border-edge">
                <div className="flex flex-wrap justify-end gap-2 px-4 py-4 sm:px-6">
                  {[14, 30].map((days) => (
                    <Link
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        safeTrendDays === days
                          ? "border-[rgba(246,201,69,0.65)] bg-brand-primary text-inverse"
                          : "border-edge bg-surface-elevated text-secondary hover:text-brand-primary"
                      }`}
                      href={buildAttributionHref({releaseId: selectedReleaseId, trendDays: days})}
                      key={days}
                    >
                      {days} days
                    </Link>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-surface-elevated text-secondary">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Tracked Arrivals</th>
                        <th className="px-4 py-3 font-semibold">Streaming Clicks</th>
                        <th className="px-4 py-3 font-semibold">Stream Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {dashboard.daily_trend.map((day) => (
                        <tr className="text-ink transition hover:bg-surface-hover" key={day.date}>
                          <td className="px-4 py-4 font-semibold">{formatDate(day.date)}</td>
                          <td className="px-4 py-4">{formatNumber(day.views)}</td>
                          <td className="px-4 py-4">{formatNumber(day.streamingClicks)}</td>
                          <td className="px-4 py-4">{calculateStreamRate(day.views, day.streamingClicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>

            <details className="command-surface overflow-hidden p-0">
              <summary className="cursor-pointer list-none px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Tracking audit</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">Meta to destination match matrix</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                      Verify ad-name and UTM matching without repeating the Creative Leaderboard.
                    </p>
                  </div>
                  <span className="status-badge-neutral">
                    {dashboard.attribution.source_batch_type || "No Meta batch"}
                  </span>
                </div>
              </summary>
              <div className="overflow-x-auto border-t border-edge">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="bg-surface-elevated text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Creative / UTM</th>
                      <th className="px-4 py-3 font-semibold">Match</th>
                      <th className="px-4 py-3 font-semibold">Spend</th>
                      <th className="px-4 py-3 font-semibold">Meta Clicks</th>
                      <th className="px-4 py-3 font-semibold">Meta LPV</th>
                      <th className="px-4 py-3 font-semibold">Tracked Views</th>
                      <th className="px-4 py-3 font-semibold">Stream Clicks</th>
                      <th className="px-4 py-3 font-semibold">View to Stream</th>
                      <th className="px-4 py-3 font-semibold">Cost / Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {dashboard.attribution.rows.length > 0 ? dashboard.attribution.rows.map((row) => (
                      <tr className="align-top text-ink transition hover:bg-surface-hover" key={`${row.utm_campaign}-${row.utm_content}-${row.ad_name}`}>
                        <td className="max-w-[320px] px-4 py-4">
                          <p className="break-words font-semibold text-ink">{row.label}</p>
                          {row.ad_name ? <p className="mt-1 break-all text-xs text-muted">{row.ad_name}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <span className={getTrackingStatusClass(row.tracking_status)}>
                            {getTrackingStatusLabel(row.tracking_status)}
                          </span>
                        </td>
                        <td className="px-4 py-4">{formatMoney(row.spend)}</td>
                        <td className="px-4 py-4">{formatNumber(row.meta_link_clicks)}</td>
                        <td className="px-4 py-4">{formatNumber(row.meta_landing_page_views)}</td>
                        <td className="px-4 py-4">{formatNumber(row.links_page_views)}</td>
                        <td className="px-4 py-4">{formatNumber(row.streaming_clicks)}</td>
                        <td className="px-4 py-4">{formatOptionalPercent(row.view_to_stream_rate)}</td>
                        <td className="px-4 py-4">{formatOptionalMoney(row.cost_per_streaming_click)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-4 py-7 text-center text-muted" colSpan={9}>
                          No match rows yet. Import a Meta export and use campaign/content UTMs or matching ad-name content.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <section className="command-surface p-6 text-sm text-muted">
            Create a release first, then Attribution will have a release funnel to analyze.
          </section>
        )}

        <section className="command-surface overflow-hidden p-0" id="advanced-diagnostics">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <div>
              <p className="field-label">Advanced diagnostics</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Global raw `/links` analytics</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Load only when troubleshooting global traffic, daily activity, or raw country/source/link/UTM breakdowns.
              </p>
            </div>
            <Link
              className="action-button-secondary !w-auto"
              href={
                showDiagnostics
                  ? buildAttributionHref({releaseId: selectedReleaseId, trendDays: safeTrendDays})
                  : `${buildAttributionHref({
                      breakdown: params.breakdown,
                      date: params.date,
                      diagnostics: true,
                      releaseId: selectedReleaseId,
                      trendDays: safeTrendDays
                    })}#advanced-diagnostics`
              }
            >
              {showDiagnostics ? "Hide Diagnostics" : "Load Diagnostics"}
              <ArrowRight size={16} />
            </Link>
          </div>
          {showDiagnostics && analytics ? (
            <div className="border-t border-edge p-4 sm:p-6">
              {dashboard ? (
                <section className="mb-6 grid gap-4 xl:grid-cols-4">
                  <BreakdownList
                    emptyText="No platform clicks recorded for this release yet."
                    items={dashboard.breakdowns.platforms.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: dashboard.overview.links_page_views
                    }))}
                    title="Release platforms"
                  />
                  <BreakdownList
                    emptyText="No arrival sources recorded for this release yet."
                    items={dashboard.breakdowns.sources.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: dashboard.overview.links_page_views
                    }))}
                    title="Release arrival sources"
                  />
                  <BreakdownList
                    emptyText="No clicked destinations recorded for this release yet."
                    items={dashboard.breakdowns.links.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: dashboard.overview.links_page_views
                    }))}
                    title="Release destinations"
                  />
                  <BreakdownList
                    emptyText="No UTM arrivals recorded for this release yet."
                    items={dashboard.breakdowns.utms.map((item) => ({
                      ctr: 0,
                      conversions: item.value,
                      label: item.label,
                      views: dashboard.overview.links_page_views
                    }))}
                    title="Release arrival UTMs"
                    wrapLabels
                  />
                </section>
              ) : null}
              <RawLinkDiagnostics
                analytics={analytics}
                breakdown={params.breakdown}
                date={params.date}
                releaseId={selectedReleaseId}
                trendDays={safeTrendDays}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
