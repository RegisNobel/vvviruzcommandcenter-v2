import Link from "next/link";
import {Activity, DatabaseZap} from "lucide-react";

import {RetentionAnalysisView} from "@/components/retention-analysis-view";
import {TrackPersistenceSection} from "@/components/track-persistence-section";
import type {
  DashboardCurrentMetric,
  RetentionDashboardData
} from "@/lib/analytics/retention-dashboard";
import {cn} from "@/lib/utils";

function formatCurrent(metric: DashboardCurrentMetric) {
  if (metric.value === null) return "Unavailable";
  if (metric.format === "PERCENTAGE") return new Intl.NumberFormat("en-US", {style: "percent", maximumFractionDigits: 1}).format(metric.value);
  if (metric.format === "DECIMAL") return new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(metric.value);
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(metric.value);
}

function CurrentMetricCard({metric}: {metric: DashboardCurrentMetric}) {
  return (
    <article className="rounded-xl border border-edge bg-input p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{metric.label}</p><span className={metric.availability === "AVAILABLE" ? "status-badge-ready" : "status-badge-neutral"}>{metric.availability}</span></div>
      <p className={cn("mt-3 text-2xl font-semibold tabular-nums", metric.value === null ? "text-muted" : "text-ink")}>{formatCurrent(metric)}</p>
      <p className="mt-2 text-xs text-muted">{metric.sourceType} · {metric.source}</p>
      <p className="mt-1 text-xs text-muted">Metric date: {metric.metricDate ?? "Unavailable"} · {metric.freshnessLabel}</p>
    </article>
  );
}

function statusPanel(data: RetentionDashboardData) {
  const links = <div className="mt-4 flex flex-wrap gap-3"><Link className="action-button-secondary text-xs" href="/admin/retention-lab/imports">Import Spotify data</Link><Link className="action-button-secondary text-xs" href="/admin/retention-lab/campaigns">Manage campaigns</Link><Link className="action-button-secondary text-xs" href="/admin/retention-lab/mappings">Review mappings</Link></div>;
  const danger = data.selectionState === "INVALID_SELECTION" || data.selectionState === "DATA_UNAVAILABLE";
  return <section className={danger ? "state-panel-danger" : "state-panel-warning"} role={danger ? "alert" : "status"}><div><p className="font-semibold">{data.selectionState.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{data.selectionMessage}</p>{links}</div></section>;
}

export function RetentionDashboardView({data}: {data: RetentionDashboardData}) {
  const selectedRelease = data.releases.find((release) => release.id === data.selectedReleaseId) ?? null;
  const comparisonCampaigns = data.releases.flatMap((release) => release.campaigns.map((campaign) => ({...campaign, releaseTitle: release.title}))).filter((campaign, index, values) => values.findIndex((item) => item.id === campaign.id) === index);
  const trend = data.audienceTrend;
  const trendCards = [
    ["Current 28-day baseline", trend.current?.mean ?? null, "listeners/day"],
    ["Previous comparable baseline", trend.previous?.mean ?? null, "listeners/day"],
    ["Absolute baseline change", trend.absoluteChange, "listeners/day"],
    ["Percentage baseline change", trend.percentageChange, "%"],
    ["Current active-listener ratio", trend.activeListenerRatio === null ? null : trend.activeListenerRatio * 100, "%"],
    ["Current streams per listener", trend.streamsPerListener, "actions/listener"]
  ] as const;
  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="panel px-4 py-6 sm:px-8">
          <div className="pill"><Activity size={12} />Promo / Retention Lab</div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Audience Retention Lab</h1><p className="mt-3 max-w-4xl text-sm leading-6 text-muted">Measured audience and track behavior before, during, and after confirmed campaign intervals. This dashboard does not claim that advertising caused every observed change.</p></div>
            <div className="flex flex-wrap gap-3"><Link className="action-button-primary text-xs" href="/admin/retention-lab/imports">Import new data</Link><Link className="action-button-secondary text-xs" href="/admin/retention-lab/campaigns">Manage campaigns</Link></div>
          </div>
          <nav aria-label="Retention Lab sections" className="mt-5 flex flex-wrap gap-2"><Link className="status-badge-ready" href="/admin/retention-lab">Overview</Link><Link className="status-badge-neutral" href="/admin/retention-lab/imports">Imports</Link><Link className="status-badge-neutral" href="/admin/retention-lab/mappings">Mapping Queue</Link><Link className="status-badge-neutral" href="/admin/retention-lab/campaigns">Campaigns</Link></nav>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Canonical artist</dt><dd className="mt-2 font-semibold text-ink">{data.canonicalArtist.displayName}</dd></div>
            <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Last audience date</dt><dd className="mt-2 font-semibold text-ink">{data.lastAudienceDataDate ?? "Unavailable"}</dd></div>
            <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Data freshness</dt><dd className="mt-2 font-semibold text-ink">{data.freshness.status} · {data.freshness.label}</dd></div>
            <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Import data</dt><dd className="mt-2 font-semibold text-ink">{data.importStatus.status}</dd><p className="mt-1 text-xs text-muted">Raw file: {data.importStatus.rawFileStatus}. Normalized data {data.importStatus.normalizedDataRetained ? "remains retained" : "is unavailable"}.</p></div>
          </dl>
        </header>

        <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="current-audience-heading">
          <div><p className="field-label">Current audience</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="current-audience-heading">Latest imported values</h2><p className="mt-2 text-sm text-muted">Each value is a same-date snapshot or daily metric. No daily value is presented as a 28-day total.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{data.currentMetrics.map((metric) => <CurrentMetricCard key={metric.id} metric={metric} />)}</div>
        </section>

        <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="audience-trend-heading">
          <div><p className="field-label">Comparable periods</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="audience-trend-heading">Audience trend summary</h2><p className="mt-2 text-sm text-muted">The two listener baselines are adjacent 28-day daily-listener windows ending at the latest imported date.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{trendCards.map(([label, value, suffix]) => <article className="rounded-xl border border-edge bg-input p-4" key={label}><p className="field-label">{label}</p><p className={cn("mt-2 text-xl font-semibold tabular-nums", value === null ? "text-muted" : "text-ink")}>{value === null ? "Unavailable" : new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(value)}{value !== null && suffix === "%" ? "%" : ""}</p><p className="mt-1 text-xs text-muted">{suffix}</p></article>)}</div>
        </section>

        <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="analysis-selection-heading">
          <div><p className="field-label">Analysis selection</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="analysis-selection-heading">Release, campaign, and date range</h2><p className="mt-2 text-sm text-muted">A single campaign is selected automatically. Multiple campaigns require an explicit choice; suggested intervals never feed calculations.</p></div>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_180px_auto] md:items-end" method="get">
            <label className="space-y-2"><span className="field-label">Release</span><select className="form-input" defaultValue={data.selectedReleaseId ?? ""} name="releaseId"><option value="">Select release</option>{data.releases.map((release) => <option key={release.id} value={release.id}>{release.title} · {release.releaseDate}</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">Campaign</span><select className="form-input" defaultValue={data.selectedCampaignId ?? ""} name="campaignId"><option value="">{selectedRelease?.campaigns.length ? "Select campaign" : "No campaign"}</option>{selectedRelease?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.platform} · {campaign.confirmedIntervalCount} confirmed</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">Chart range</span><select className="form-input" defaultValue={String(data.rangeDays)} name="range"><option value="180">180 days</option><option value="365">365 days</option><option value="1000">1,000 days</option></select></label>
            <button className="action-button-primary justify-center" type="submit">Load analysis</button>
          </form>
        </section>

        {data.analysis ? <RetentionAnalysisView analysis={data.analysis} /> : statusPanel(data)}
        {data.trackPersistence ? <TrackPersistenceSection track={data.trackPersistence} /> : null}

        <section className="panel space-y-5 p-4 sm:p-6" aria-labelledby="release-comparison-heading">
          <div><p className="field-label">Comparable release analyses</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="release-comparison-heading">Release comparison</h2><p className="mt-2 text-sm text-muted">Default order favors release recency. Excluded and insufficient analyses remain labeled and are never ranked as winners.</p></div>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7" method="get">
            {data.selectedReleaseId ? <input name="releaseId" type="hidden" value={data.selectedReleaseId} /> : null}{data.selectedCampaignId ? <input name="campaignId" type="hidden" value={data.selectedCampaignId} /> : null}<input name="range" type="hidden" value={data.rangeDays} />
            <label className="space-y-2"><span className="field-label">Status</span><select className="form-input" name="comparisonStatus"><option value="">All</option>{["VALID", "WARNING", "EXCLUDED", "INSUFFICIENT"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">Data confidence</span><select className="form-input" name="comparisonConfidence"><option value="">All</option>{["HIGH", "MODERATE", "LOW", "INSUFFICIENT"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">Release</span><select className="form-input" name="comparisonRelease"><option value="">All</option>{data.releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">Campaign</span><select className="form-input" name="comparisonCampaign"><option value="">All</option>{comparisonCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.releaseTitle}</option>)}</select></label>
            <label className="space-y-2"><span className="field-label">From</span><input className="form-input" name="comparisonDateFrom" type="date" /></label>
            <label className="space-y-2"><span className="field-label">To</span><input className="form-input" name="comparisonDateTo" type="date" /></label>
            <button className="action-button-secondary justify-center self-end" type="submit">Filter rows</button>
          </form>
          {data.comparisonRows.length ? <div className="overflow-x-auto"><table className="min-w-[1500px] divide-y divide-edge text-left text-xs"><thead className="text-muted"><tr>{["Release", "Release date", "Campaign", "Status", "Data confidence", "Attribution confidence", "Pre-release baseline", "Campaign peak", "Post floor", "Baseline growth", "Incremental lift", "Lift retained", "Track persistence", "Completeness", "Last calculated"].map((label) => <th className="px-3 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-edge">{data.comparisonRows.map((row) => <tr key={`${row.releaseId}:${row.campaignId}`}><td className="px-3 py-3"><Link className="font-semibold text-accent hover:underline" href={`/admin/retention-lab?releaseId=${row.releaseId}&campaignId=${row.campaignId}`}>{row.releaseTitle}</Link></td><td className="px-3 py-3">{row.releaseDate}</td><td className="px-3 py-3">{row.campaignName}</td><td className="px-3 py-3">{row.status}</td><td className="px-3 py-3">{row.confidence.dataConfidence}</td><td className="px-3 py-3">{row.confidence.attributionConfidence}</td><td className="px-3 py-3">{row.preReleaseBaseline === null ? "—" : Math.round(row.preReleaseBaseline)}</td><td className="px-3 py-3">{row.campaignPeak === null ? "—" : Math.round(row.campaignPeak)}</td><td className="px-3 py-3">{row.postCampaignFloor === null ? "—" : Math.round(row.postCampaignFloor)}</td><td className="px-3 py-3">{row.baselineGrowthPercentage === null ? "—" : `${row.baselineGrowthPercentage.toFixed(1)}%`}</td><td className="px-3 py-3">{row.incrementalLift === null ? "—" : Math.round(row.incrementalLift)}</td><td className="px-3 py-3">{row.liftRetainedPercentage === null ? "—" : `${row.liftRetainedPercentage.toFixed(1)}%`}</td><td className="px-3 py-3">{row.trackPersistencePercentage === null ? "—" : `${row.trackPersistencePercentage.toFixed(1)}%`}</td><td className="px-3 py-3">{row.completenessPercentage.toFixed(1)}%</td><td className="px-3 py-3">{row.calculatedAt}</td></tr>)}</tbody></table></div> : <div className="state-empty"><DatabaseZap className="mx-auto text-muted" size={20} /><p className="mt-3 font-semibold text-ink">No comparable analyses</p><p className="mt-1 text-sm text-muted">Rows appear when a released catalog item has current audience data and a confirmed campaign interval.</p></div>}
        </section>
      </div>
    </main>
  );
}
