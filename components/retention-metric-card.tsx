import type {DashboardMetric} from "@/lib/analytics/retention-dashboard";
import type {RetentionConfidence, RetentionStatus} from "@/lib/analytics/retention-types";
import {cn} from "@/lib/utils";

export function retentionStatusBadge(status: RetentionStatus) {
  if (status === "VALID") return "status-badge-ready";
  if (status === "WARNING") return "status-badge-warning";
  if (status === "EXCLUDED") return "status-badge-danger";
  return "status-badge-neutral";
}

export function retentionConfidenceBadge(confidence: RetentionConfidence) {
  if (confidence === "HIGH") return "status-badge-ready";
  if (confidence === "MODERATE") return "status-badge-info";
  if (confidence === "LOW") return "status-badge-warning";
  return "status-badge-neutral";
}

function formatMetric(metric: DashboardMetric) {
  if (metric.value === null) return "Unavailable";
  if (metric.format === "PERCENTAGE") return `${new Intl.NumberFormat("en-US", {maximumFractionDigits: metric.maximumFractionDigits ?? 1}).format(metric.value)}%`;
  if (metric.format === "DECIMAL") return new Intl.NumberFormat("en-US", {maximumFractionDigits: metric.maximumFractionDigits ?? 2}).format(metric.value);
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(metric.value);
}

export function RetentionMetricCard({metric}: {metric: DashboardMetric}) {
  const unavailable = metric.value === null;
  return (
    <article className={cn("rounded-xl border bg-input p-4", metric.status === "EXCLUDED" ? "border-status-danger/50" : metric.status === "WARNING" ? "border-status-warning/50" : "border-edge")} data-metric-id={metric.id}>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{metric.label}</p><span className={retentionStatusBadge(metric.status)}>{metric.status}</span></div>
      <p className={cn("mt-3 text-2xl font-semibold tabular-nums", unavailable ? "text-muted" : "text-ink")}>{formatMetric(metric)}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{metric.explanation}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className={retentionConfidenceBadge(metric.confidence)}>{metric.confidence} confidence</span><span className="status-badge-neutral">{metric.window.startDate && metric.window.endDate ? metric.window.startDate === metric.window.endDate ? metric.window.startDate : `${metric.window.startDate}–${metric.window.endDate}` : "Window unavailable"}</span>{metric.completeness ? <span className="status-badge-neutral">{metric.completeness.presentDateCount}/{metric.completeness.expectedDateCount} days</span> : null}</div>
      <details className="mt-4 border-t border-edge pt-3 text-xs text-muted"><summary className="cursor-pointer font-semibold text-secondary">Metric provenance and formula</summary><dl className="mt-3 space-y-2"><div><dt className="font-semibold text-ink">Formula</dt><dd>{metric.formula}</dd></div><div><dt className="font-semibold text-ink">Provenance</dt><dd>{metric.provenance.map((item) => `${item.kind}: ${item.label}`).join("; ")}</dd></div><div><dt className="font-semibold text-ink">Reason codes</dt><dd>{metric.reasonCodes.length ? metric.reasonCodes.join(", ") : "None"}</dd></div>{metric.completeness?.missingDates.length ? <div><dt className="font-semibold text-ink">Missing dates</dt><dd className="break-words">{metric.completeness.missingDates.join(", ")}</dd></div> : null}</dl></details>
    </article>
  );
}
