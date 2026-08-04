import Link from "next/link";

import {RetentionTimelineChartLoader} from "@/components/retention-timeline-chart-loader";
import type {
  DashboardAnalysis,
  DashboardMetric
} from "@/lib/analytics/retention-dashboard";
import type {RetentionConfidence, RetentionStatus} from "@/lib/analytics/retention-types";
import {cn} from "@/lib/utils";

function statusBadge(status: RetentionStatus) {
  if (status === "VALID") return "status-badge-ready";
  if (status === "WARNING") return "status-badge-warning";
  if (status === "EXCLUDED") return "status-badge-danger";
  return "status-badge-neutral";
}

function confidenceBadge(confidence: RetentionConfidence) {
  if (confidence === "HIGH") return "status-badge-ready";
  if (confidence === "MODERATE") return "status-badge-info";
  if (confidence === "LOW") return "status-badge-warning";
  return "status-badge-neutral";
}

function formatMetric(metric: DashboardMetric) {
  if (metric.value === null) return "Unavailable";
  if (metric.format === "PERCENTAGE") {
    return `${new Intl.NumberFormat("en-US", {maximumFractionDigits: 1}).format(metric.value)}%`;
  }
  if (metric.format === "DECIMAL") {
    return new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(metric.value);
  }
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(metric.value);
}

function MetricCard({metric}: {metric: DashboardMetric}) {
  const unavailable = metric.value === null;
  return (
    <article
      className={cn(
        "rounded-xl border bg-input p-4",
        metric.status === "EXCLUDED"
          ? "border-status-danger/50"
          : metric.status === "WARNING"
            ? "border-status-warning/50"
            : "border-edge"
      )}
      data-metric-id={metric.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{metric.label}</p>
        <span className={statusBadge(metric.status)}>{metric.status}</span>
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tabular-nums", unavailable ? "text-muted" : "text-ink")}>
        {formatMetric(metric)}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{metric.explanation}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className={confidenceBadge(metric.confidence)}>{metric.confidence} confidence</span>
        <span className="status-badge-neutral">
          {metric.window.startDate && metric.window.endDate
            ? `${metric.window.startDate}–${metric.window.endDate}`
            : "Window unavailable"}
        </span>
        {metric.completeness ? (
          <span className="status-badge-neutral">
            {metric.completeness.presentDateCount}/{metric.completeness.expectedDateCount} days
          </span>
        ) : null}
      </div>
      <details className="mt-4 border-t border-edge pt-3 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-secondary">Metric provenance and formula</summary>
        <dl className="mt-3 space-y-2">
          <div><dt className="font-semibold text-ink">Formula</dt><dd>{metric.formula}</dd></div>
          <div><dt className="font-semibold text-ink">Provenance</dt><dd>{metric.provenance.map((item) => `${item.kind}: ${item.label}`).join("; ")}</dd></div>
          <div><dt className="font-semibold text-ink">Reason codes</dt><dd>{metric.reasonCodes.length ? metric.reasonCodes.join(", ") : "None"}</dd></div>
          {metric.completeness?.missingDates.length ? <div><dt className="font-semibold text-ink">Missing dates</dt><dd className="break-words">{metric.completeness.missingDates.join(", ")}</dd></div> : null}
        </dl>
      </details>
    </article>
  );
}

function InterpretationPanel({analysis}: {analysis: DashboardAnalysis}) {
  const style = analysis.interpretation.status === "EXCLUDED"
    ? "state-panel-danger"
    : analysis.interpretation.status === "WARNING"
      ? "state-panel-warning"
      : analysis.interpretation.status === "INSUFFICIENT"
        ? "state-panel-warning"
        : "state-panel-success";
  return (
    <section className={style} aria-labelledby="retention-interpretation-heading" role={analysis.interpretation.status === "VALID" ? "status" : "alert"}>
      <div>
        <p className="font-semibold" id="retention-interpretation-heading">{analysis.interpretation.headline}</p>
        <p className="mt-1 text-sm leading-6">{analysis.interpretation.detail}</p>
        {analysis.interpretation.notes.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{analysis.interpretation.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
      </div>
    </section>
  );
}

export function RetentionAnalysisView({analysis, context = "DASHBOARD"}: {analysis: DashboardAnalysis; context?: "DASHBOARD" | "RELEASE"}) {
  const result = analysis.analysis;
  const trackUnavailable = result.trackPersistence.launchSevenDays.completeness.presentDateCount === 0;
  return (
    <div className="space-y-6" data-analysis-status={result.status} data-testid="retention-analysis-view">
      <section className="panel space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Selected analysis</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{analysis.release.title} · {analysis.campaign.name}</h2>
            <p className="mt-2 text-sm text-muted">Release {analysis.release.releaseDate} · {analysis.campaign.platform} · {analysis.campaign.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={statusBadge(result.status)}>{result.status}</span>
            <span className={confidenceBadge(result.confidence)}>Overall {result.confidence}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Analysis confidence dimensions">
          <div className="rounded-xl border border-edge bg-input p-4"><p className="field-label">Data confidence</p><p className="mt-2 font-semibold text-ink">{analysis.confidence.dataConfidence}</p><p className="mt-1 text-xs text-muted">Completeness, identity, confirmed dates, mapping, and reconciliation.</p></div>
          <div className="rounded-xl border border-edge bg-input p-4"><p className="field-label">Attribution confidence</p><p className="mt-2 font-semibold text-ink">{analysis.confidence.attributionConfidence}</p><p className="mt-1 text-xs text-muted">V1 cannot isolate paid, organic, algorithmic, or other-release effects.</p></div>
          <div className="rounded-xl border border-edge bg-input p-4"><p className="field-label">Stage 7 overall</p><p className="mt-2 font-semibold text-ink">{analysis.confidence.overallConfidence}</p><p className="mt-1 text-xs text-muted">Preserved unchanged for backward compatibility.</p></div>
        </div>
        <InterpretationPanel analysis={analysis} />
      </section>

      <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="retention-primary-metrics">
        <div><p className="field-label">Retention calculations</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="retention-primary-metrics">Measured windows and lift</h2><p className="mt-2 text-sm text-muted">Unavailable values remain unavailable. Warning and excluded values are never styled as successful results.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{analysis.primaryMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
      </section>

      <RetentionTimelineChartLoader payload={analysis.chart} />

      <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="track-persistence-heading">
        <div><p className="field-label">Separate track measure</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="track-persistence-heading">Track-stream persistence</h2><p className="mt-2 text-sm font-semibold text-status-warning">Track-stream persistence measures continued streaming activity. It does not measure unique listener retention.</p></div>
        {result.reasonCodes.includes("CONFLICTING_TRACK_TIMELINES") ? <div className="state-panel-danger" role="alert">Conflicting track identities are not merged. Review the current mapping before interpreting track performance.</div> : null}
        {trackUnavailable ? <div className="state-empty"><p className="font-semibold text-ink">No resolved track timeline</p><p className="mt-2 text-sm text-muted">Track data is optional. Import a Spotify track stream timeline and confirm its release identity to enable persistence metrics.</p></div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{analysis.trackMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>}
      </section>

      <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="retention-provenance-heading">
        <div><p className="field-label">Audit trail</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="retention-provenance-heading">Confidence, provenance, and limitations</h2></div>
        <details className="rounded-xl border border-edge bg-input p-4" open={result.status !== "VALID"}>
          <summary className="cursor-pointer font-semibold text-ink">Analysis metadata and contributing inputs</summary>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="field-label">Formula version</dt><dd className="mt-1 text-ink">{result.formulaVersion}</dd></div>
            <div><dt className="field-label">Resolution version</dt><dd className="mt-1 text-ink">{result.currentObservationResolutionVersion}</dd></div>
            <div><dt className="field-label">Calculated</dt><dd className="mt-1 text-ink">{result.calculatedAt}</dd></div>
            <div><dt className="field-label">Data cutoff</dt><dd className="mt-1 text-ink">{result.dataCutoffDate ?? "Unavailable"}</dd></div>
            <div><dt className="field-label">Audience observations</dt><dd className="mt-1 text-ink">{result.inputs.artistObservationCount}</dd></div>
            <div><dt className="field-label">Track observations</dt><dd className="mt-1 text-ink">{result.inputs.trackObservationCount}</dd></div>
          </dl>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div><h3 className="font-semibold text-ink">Input imports</h3><ul className="mt-2 space-y-2 text-xs text-muted">{result.inputImports.length ? result.inputImports.map((item) => <li className="rounded-lg border border-edge p-3" key={item.importId}><strong className="text-ink">{item.importType}</strong><br />Import {item.importId} · Parser {item.parserVersion ?? "unknown"} · Normalization v{item.normalizationVersion} · Accepted {item.acceptedAt ?? "unknown"}</li>) : <li>No contributing import metadata.</li>}</ul></div>
            <div><h3 className="font-semibold text-ink">Confirmed campaign intervals</h3><ul className="mt-2 space-y-2 text-xs text-muted">{result.inputs.confirmedCampaignIntervals.map((interval) => <li className="rounded-lg border border-edge p-3" key={interval.id}>{interval.startDate} through {interval.endDate ?? "open"} · {interval.timezone} · {interval.sourceType}</li>)}</ul></div>
            <div><h3 className="font-semibold text-ink">Current mapping evidence</h3><ul className="mt-2 space-y-2 text-xs text-muted">{result.mappingResolution.length ? result.mappingResolution.map((item) => <li className="rounded-lg border border-edge p-3" key={item.rowId}>Import {item.importId} · {item.mappingStatus} · {item.mappingConfidence} · Mapping v{item.mappingVersion} · Alias {item.appliedAliasStatus ?? "none"}</li>) : <li>No release-specific mapping evidence was required.</li>}</ul></div>
            <div><h3 className="font-semibold text-ink">Reason codes and reconciliation</h3><p className="mt-2 break-words text-xs text-muted">{result.reasonCodes.join(", ") || "None"}</p>{result.reconciliationWarnings.length ? <ul className="mt-2 space-y-2 text-xs text-status-warning">{result.reconciliationWarnings.map((item) => <li key={`${item.importId}:${item.key}`}>{item.key}: {item.message}</li>)}</ul> : <p className="mt-2 text-xs text-muted">No contributing reconciliation warning.</p>}</div>
          </div>
          <p className="mt-5 text-xs text-muted">Raw CSV contents, storage keys, original cell values, private tokens, and preview tokens are excluded from this view and the chart payload.</p>
        </details>
        <div className="flex flex-wrap gap-3">
          <Link className="action-button-secondary text-xs" href={`/admin/retention-lab/campaigns/${analysis.campaign.id}`}>Open campaign editor</Link>
          <Link className="action-button-secondary text-xs" href="/admin/retention-lab/imports">Open imports</Link>
          <Link className="action-button-secondary text-xs" href="/admin/retention-lab/mappings">Open mapping queue</Link>
          {context === "DASHBOARD" ? <Link className="action-button-secondary text-xs" href={`/admin/releases/${analysis.release.id}?campaignId=${analysis.campaign.id}#audience-retention`}>Open release workspace</Link> : <Link className="action-button-secondary text-xs" href={`/admin/retention-lab?releaseId=${analysis.release.id}&campaignId=${analysis.campaign.id}`}>Open Retention Lab overview</Link>}
        </div>
      </section>
    </div>
  );
}
