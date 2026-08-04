"use client";

import {useId, useMemo, useState} from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps
} from "recharts";

import type {
  RetentionChartMarker,
  RetentionChartPayload,
  RetentionChartPoint,
  RetentionChartWindowKind
} from "@/lib/analytics/retention-chart-contract";
import {cn} from "@/lib/utils";

import styles from "./retention-timeline-chart.module.css";

type ChartMode = "AUDIENCE" | "ENGAGEMENT" | "TRACK";

const SERIES = {
  artistListeners: {label: "Daily listeners", format: "INTEGER"},
  listenerMovingAverage7: {label: "Seven-day listener average", format: "INTEGER"},
  monthlyListeners: {label: "Rolling monthly listeners", format: "INTEGER"},
  monthlyActiveListeners: {label: "Rolling monthly active listeners", format: "INTEGER"},
  streamsPerListener: {label: "Streams per listener", format: "DECIMAL"},
  monthlyActiveListenerRatio: {label: "Rolling active-listener ratio", format: "RATIO"},
  saveActionsPerListener: {label: "Save actions per listener", format: "DECIMAL"},
  playlistAddActionsPerListener: {label: "Playlist-add actions per listener", format: "DECIMAL"},
  trackStreams: {label: "Daily track streams", format: "INTEGER"}
} as const;

const WINDOW_STYLE: Record<RetentionChartWindowKind, {fill: string; stroke: string}> = {
  BASELINE: {fill: "rgba(111, 158, 216, 0.11)", stroke: "#6f9ed8"},
  CAMPAIGN: {fill: "rgba(246, 201, 69, 0.10)", stroke: "#f6c945"},
  POST_CAMPAIGN: {fill: "rgba(223, 107, 107, 0.11)", stroke: "#df6b6b"}
};

const MARKER_STYLE: Record<RetentionChartMarker["kind"], {stroke: string; dash: string}> = {
  RELEASE: {stroke: "#f5f5f5", dash: "0"},
  OVERLAPPING_RELEASE: {stroke: "#df6b6b", dash: "3 3"},
  CAMPAIGN_STARTED: {stroke: "#f6c945", dash: "2 3"},
  CAMPAIGN_PAUSED: {stroke: "#e6ad43", dash: "6 3"},
  CAMPAIGN_RESUMED: {stroke: "#f6c945", dash: "2 3"},
  CAMPAIGN_ENDED: {stroke: "#e6ad43", dash: "6 3"},
  BUDGET_CHANGED: {stroke: "#b4cff0", dash: "1 4"},
  CREATIVE_CHANGED: {stroke: "#9de2bd", dash: "1 4"},
  AUDIENCE_CHANGED: {stroke: "#c5b4f0", dash: "1 4"},
  ORGANIC_CONTENT_POSTED: {stroke: "#f1cf87", dash: "1 4"},
  ONE_DAY_PEAK: {stroke: "#ffffff", dash: "4 2"},
  SEVEN_DAY_PEAK: {stroke: "#4fbf88", dash: "4 2"}
};

const PRIORITY_MARKERS = new Set<RetentionChartMarker["kind"]>([
  "RELEASE",
  "OVERLAPPING_RELEASE",
  "CAMPAIGN_STARTED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RESUMED",
  "CAMPAIGN_ENDED",
  "ONE_DAY_PEAK",
  "SEVEN_DAY_PEAK"
]);

function formatValue(value: number | null, format: string = "INTEGER") {
  if (value === null) return "Unavailable";
  if (format === "RATIO") return new Intl.NumberFormat("en-US", {style: "percent", maximumFractionDigits: 1}).format(value);
  if (format === "DECIMAL") return new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(value);
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(value);
}

function SafeTooltip({active, label, payload}: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.flatMap((entry) => {
    const key = typeof entry.dataKey === "string" ? entry.dataKey : "";
    if (!(key in SERIES) || typeof entry.value !== "number") return [];
    const definition = SERIES[key as keyof typeof SERIES];
    return [{key, label: definition.label, value: formatValue(entry.value, definition.format)}];
  });
  return (
    <div className="rounded-lg border border-edge-strong bg-surface-elevated px-3 py-2 text-xs shadow-popover">
      <p className="font-semibold text-ink">{String(label)}</p>
      <ul className="mt-2 space-y-1 text-secondary">
        {rows.map((row) => <li key={row.key}>{row.label}: {row.value}</li>)}
      </ul>
    </div>
  );
}

function ChartWindows({payload, yAxisId}: {payload: RetentionChartPayload; yAxisId?: string}) {
  return payload.windows.map((window) => {
    const style = WINDOW_STYLE[window.kind];
    return (
      <ReferenceArea
        fill={style.fill}
        fillOpacity={1}
        ifOverflow="extendDomain"
        key={window.id}
        label={{value: window.label, position: "insideTopLeft", fill: style.stroke, fontSize: 10}}
        stroke={style.stroke}
        strokeDasharray={window.status === "EXCLUDED" || window.status === "INSUFFICIENT" ? "5 3" : "2 4"}
        x1={window.startDate}
        x2={window.endDate}
        yAxisId={yAxisId}
      />
    );
  });
}

function ChartMarkers({payload, yAxisId}: {payload: RetentionChartPayload; yAxisId?: string}) {
  return payload.markers.filter((marker) => PRIORITY_MARKERS.has(marker.kind)).map((marker) => {
    const style = MARKER_STYLE[marker.kind];
    const label = ["RELEASE", "OVERLAPPING_RELEASE", "ONE_DAY_PEAK", "SEVEN_DAY_PEAK"].includes(marker.kind)
      ? {value: marker.label, position: "insideTopRight" as const, fill: style.stroke, fontSize: 10}
      : undefined;
    return (
      <ReferenceLine
        ifOverflow="extendDomain"
        key={marker.id}
        label={label}
        stroke={style.stroke}
        strokeDasharray={style.dash}
        strokeWidth={marker.kind === "RELEASE" || marker.kind === "OVERLAPPING_RELEASE" ? 2 : 1}
        x={marker.date}
        yAxisId={yAxisId}
      />
    );
  });
}

function chartLines(mode: ChartMode, showMonthly: boolean) {
  if (mode === "TRACK") {
    return <Line connectNulls={false} dataKey="trackStreams" dot={false} isAnimationActive={false} name="Daily track streams" stroke="#c5b4f0" strokeWidth={2} type="linear" />;
  }
  if (mode === "ENGAGEMENT") {
    return (
      <>
        <Line connectNulls={false} dataKey="streamsPerListener" dot={false} isAnimationActive={false} name="Streams per listener" stroke="#f6c945" strokeWidth={2} type="linear" />
        <Line connectNulls={false} dataKey="monthlyActiveListenerRatio" dot={false} isAnimationActive={false} name="Rolling active-listener ratio" stroke="#4fbf88" strokeDasharray="7 3" strokeWidth={2} type="linear" />
        <Line connectNulls={false} dataKey="saveActionsPerListener" dot={false} isAnimationActive={false} name="Save actions per listener" stroke="#6f9ed8" strokeDasharray="3 3" strokeWidth={1.5} type="linear" />
        <Line connectNulls={false} dataKey="playlistAddActionsPerListener" dot={false} isAnimationActive={false} name="Playlist-add actions per listener" stroke="#c5b4f0" strokeDasharray="1 4" strokeWidth={1.5} type="linear" />
      </>
    );
  }
  return (
    <>
      <Line connectNulls={false} dataKey="artistListeners" dot={false} isAnimationActive={false} name="Daily listeners" stroke="#f6c945" strokeWidth={1.5} type="linear" yAxisId="daily" />
      <Line connectNulls={false} dataKey="listenerMovingAverage7" dot={false} isAnimationActive={false} name="Seven-day listener average" stroke="#4fbf88" strokeWidth={2.5} type="linear" yAxisId="daily" />
      {showMonthly ? <Line connectNulls={false} dataKey="monthlyListeners" dot={false} isAnimationActive={false} name="Rolling monthly listeners" stroke="#6f9ed8" strokeDasharray="7 3" strokeWidth={1.5} type="linear" yAxisId="rolling" /> : null}
      {showMonthly ? <Line connectNulls={false} dataKey="monthlyActiveListeners" dot={false} isAnimationActive={false} name="Rolling monthly active listeners" stroke="#c5b4f0" strokeDasharray="2 3" strokeWidth={1.5} type="linear" yAxisId="rolling" /> : null}
    </>
  );
}

function inspectorFields(point: RetentionChartPoint, mode: ChartMode, showMonthly: boolean) {
  if (mode === "TRACK") return [["Daily track streams", point.trackStreams, "INTEGER"]] as const;
  if (mode === "ENGAGEMENT") {
    return [
      ["Streams per listener", point.streamsPerListener, "DECIMAL"],
      ["Rolling active-listener ratio", point.monthlyActiveListenerRatio, "RATIO"],
      ["Save actions per listener", point.saveActionsPerListener, "DECIMAL"],
      ["Playlist-add actions per listener", point.playlistAddActionsPerListener, "DECIMAL"]
    ] as const;
  }
  return [
    ["Daily listeners", point.artistListeners, "INTEGER"],
    ["Seven-day listener average", point.listenerMovingAverage7, "INTEGER"],
    ...(showMonthly
      ? [
          ["Rolling monthly listeners", point.monthlyListeners, "INTEGER"],
          ["Rolling monthly active listeners", point.monthlyActiveListeners, "INTEGER"]
        ] as const
      : [])
  ] as const;
}

export function RetentionTimelineChart({payload}: {payload: RetentionChartPayload}) {
  const [mode, setMode] = useState<ChartMode>("AUDIENCE");
  const [showMonthly, setShowMonthly] = useState(false);
  const [index, setIndex] = useState(payload.series.length - 1);
  const headingId = useId();
  const descriptionId = useId();
  const inspectorId = useId();
  const point = payload.series[index];
  const eventByDate = useMemo(() => {
    const values = new Map<string, string[]>();
    for (const marker of payload.markers) values.set(marker.date, [...(values.get(marker.date) ?? []), marker.label]);
    return values;
  }, [payload.markers]);
  const hasTrackData = payload.series.some((row) => row.trackStreams !== null);
  const fields = inspectorFields(point, mode, showMonthly);
  return (
    <section className="panel space-y-5 p-4 sm:p-6" data-chart-contract-version={payload.contractVersion} data-testid="retention-timeline-chart">
      <div>
        <p className="field-label">Measured timeline</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink" id={headingId}>{payload.accessibilitySummary.title}</h2>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted" id={descriptionId}>{payload.accessibilitySummary.description}</p>
      </div>

      <div aria-label="Timeline chart mode" className={`${styles.modeControls} ${styles.interactiveOnly}`} role="group">
        {(["AUDIENCE", "ENGAGEMENT", "TRACK"] as const).map((value) => (
          <button
            aria-pressed={mode === value}
            className={cn("action-button-secondary justify-center text-xs", mode === value && "border-brand-primary text-brand-primary")}
            disabled={value === "TRACK" && !hasTrackData}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {value === "AUDIENCE" ? "Audience" : value === "ENGAGEMENT" ? "Engagement" : "Track performance"}
          </button>
        ))}
      </div>
      {mode === "AUDIENCE" ? (
        <label className={`${styles.interactiveOnly} flex items-center gap-2 text-sm text-secondary`}>
          <input checked={showMonthly} className="accent-[var(--brand-primary)]" onChange={(event) => setShowMonthly(event.target.checked)} type="checkbox" />
          Show rolling monthly listener overlays
        </label>
      ) : null}
      {mode === "ENGAGEMENT" ? <p className="text-xs text-muted">Ratios are actions or streams per listener. They are not unique-user conversion rates.</p> : null}
      {mode === "TRACK" ? <p className="state-panel-warning text-sm">Track-stream persistence measures continued streaming activity. It does not measure unique listener retention.</p> : null}

      <div aria-describedby={descriptionId} aria-labelledby={headingId} className={`${styles.chartSurface} rounded-xl border border-edge bg-input p-2 sm:p-4`} role="img">
        <div className={styles.chartFrame}>
          <ResponsiveContainer height="100%" minHeight={320} width="100%">
            <ComposedChart accessibilityLayer data={payload.series} margin={{top: 34, right: 18, bottom: 12, left: 0}}>
              <CartesianGrid stroke="rgba(139,146,157,0.18)" strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="date" minTickGap={28} stroke="#8b929d" tickFormatter={(value: string) => value.slice(5)} tickLine={false} />
              {mode === "AUDIENCE" ? <YAxis stroke="#8b929d" tickLine={false} width={52} yAxisId="daily" /> : <YAxis stroke="#8b929d" tickLine={false} width={52} />}
              {mode === "AUDIENCE" ? <YAxis hide orientation="right" yAxisId="rolling" /> : null}
              <Tooltip content={SafeTooltip} isAnimationActive={false} />
              <Legend iconType="plainline" verticalAlign="bottom" />
              <ChartWindows payload={payload} yAxisId={mode === "AUDIENCE" ? "daily" : undefined} />
              <ChartMarkers payload={payload} yAxisId={mode === "AUDIENCE" ? "daily" : undefined} />
              {chartLines(mode, showMonthly)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div aria-label="Non-color chart key" className="flex flex-wrap gap-2 text-xs">
        <span className="status-badge-neutral">Solid line: primary measure</span>
        <span className="status-badge-info">Dashed lines: comparison or ratio</span>
        <span className="status-badge-warning">Outlined bands: analysis windows</span>
        <span className="status-badge-danger">Dashed warning band: excluded or incomplete</span>
      </div>

      <section className={`${styles.interactiveOnly} rounded-xl border border-edge bg-input p-4`} aria-labelledby={`${inspectorId}-heading`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink" id={`${inspectorId}-heading`}>Keyboard date inspector</h3>
            <p className="mt-1 text-xs text-muted">Use Left and Right Arrow. This is the non-hover tooltip alternative.</p>
          </div>
          <output aria-live="polite" className="status-badge-neutral" htmlFor={inspectorId}>{point.date}</output>
        </div>
        <input aria-label="Inspect timeline date" className="mt-4 w-full accent-[var(--brand-primary)]" id={inspectorId} max={payload.series.length - 1} min={0} onChange={(event) => setIndex(Number(event.target.value))} type="range" value={index} />
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(([label, value, format]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="font-semibold text-ink">{formatValue(value, format)}</dd></div>)}
        </dl>
      </section>

      <section className={`${styles.companionSection} space-y-5`} aria-labelledby={`${headingId}-companion`}>
        <div>
          <h3 className="font-semibold text-ink" id={`${headingId}-companion`}>Windows, events, gaps, and inspectable values</h3>
          <p className="mt-1 text-sm text-muted">{payload.accessibilitySummary.gapCount} missing audience date{payload.accessibilitySummary.gapCount === 1 ? "" : "s"}; {payload.accessibilitySummary.completenessPercentage.toFixed(1)}% complete in this range. {payload.accessibilitySummary.gapsAffectConfidence ? "The gaps affect confidence." : "The selected analysis windows are not confidence-limited by these gaps."}</p>
        </div>
        {payload.accessibilitySummary.gapDates.length ? <details className="rounded-xl border border-edge bg-input p-4"><summary className="cursor-pointer font-semibold text-ink">Missing dates ({payload.accessibilitySummary.gapDates.length})</summary><p className="mt-3 break-words text-sm text-muted">{payload.accessibilitySummary.gapDates.join(", ")}</p></details> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <section><h4 className="font-semibold text-ink">Analysis windows</h4><div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-muted"><tr><th className="px-2 py-2">Window</th><th className="px-2 py-2">Dates</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Confidence</th></tr></thead><tbody className="divide-y divide-edge">{payload.windows.map((window) => <tr key={window.id}><td className="px-2 py-2 text-ink">{window.label}</td><td className="px-2 py-2">{window.startDate}–{window.endDate}</td><td className="px-2 py-2">{window.status}</td><td className="px-2 py-2">{window.confidence}</td></tr>)}</tbody></table></div></section>
          <section><h4 className="font-semibold text-ink">Complete event list</h4><ol className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm text-secondary">{payload.markers.map((marker) => <li className="rounded-lg border border-edge bg-input p-3" key={marker.id}><strong className="text-ink">{marker.date}: {marker.label}</strong><br /><span className="text-xs">{marker.kind.replaceAll("_", " ")} · {marker.status}</span></li>)}</ol></section>
        </div>
        <details className="rounded-xl border border-edge bg-input">
          <summary className="cursor-pointer px-4 py-3 font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">Inspect {payload.series.length} timeline rows</summary>
          <div className={styles.dataTable}>
            <table className="min-w-[760px] divide-y divide-edge text-left text-xs">
              <thead className="sticky top-0 bg-surface-elevated text-muted"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Listeners</th><th className="px-3 py-2">7-day avg.</th><th className="px-3 py-2">Track streams</th><th className="px-3 py-2">Missing</th><th className="px-3 py-2">Window</th><th className="px-3 py-2">Events</th></tr></thead>
              <tbody className="divide-y divide-edge">{payload.series.map((row) => <tr key={row.date}><td className="px-3 py-2 text-ink">{row.date}</td><td className="px-3 py-2">{formatValue(row.artistListeners)}</td><td className="px-3 py-2">{formatValue(row.listenerMovingAverage7)}</td><td className="px-3 py-2">{formatValue(row.trackStreams)}</td><td className="px-3 py-2">{row.missing.artistAudience ? "Audience" : "No"}{row.missing.trackStreams ? " · Track" : ""}</td><td className="px-3 py-2">{row.windowTags.join(", ") || "Measured day"}</td><td className="px-3 py-2">{eventByDate.get(row.date)?.join("; ") || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>
    </section>
  );
}
