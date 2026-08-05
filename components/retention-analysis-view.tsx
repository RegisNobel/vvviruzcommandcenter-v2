import Link from "next/link";

import {RetentionMetricCard, retentionConfidenceBadge, retentionStatusBadge} from "@/components/retention-metric-card";
import {RetentionTimelineChartLoader} from "@/components/retention-timeline-chart-loader";
import type {DashboardAnalysis} from "@/lib/analytics/retention-dashboard";

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
            <span className={retentionStatusBadge(result.status)}>{result.status}</span>
            <span className={retentionConfidenceBadge(result.confidence)}>Overall {result.confidence}</span>
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{analysis.primaryMetrics.map((metric) => <RetentionMetricCard key={metric.id} metric={metric} />)}</div>
      </section>

      <RetentionTimelineChartLoader payload={analysis.chart} />

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
