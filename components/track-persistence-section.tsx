import {RetentionMetricCard} from "@/components/retention-metric-card";
import type {DashboardTrackPersistence} from "@/lib/analytics/retention-dashboard";

function stateClass(state: DashboardTrackPersistence["state"]) {
  if (state === "IDENTITY_CONFLICT") return "state-panel-danger";
  if (state === "AVAILABLE") return "state-panel-success";
  return "state-panel-warning";
}

export function TrackPersistenceSection({track}: {track: DashboardTrackPersistence}) {
  const showMetrics = track.state !== "NO_TRACK_TIMELINE" && track.state !== "IDENTITY_CONFLICT";
  const completeness = [track.result.launchSevenDays, track.result.days14To28, track.result.latestSevenDays]
    .map((window) => `${window.completeness.presentDateCount}/${window.completeness.expectedDateCount}`)
    .join(" · ");
  return (
    <section className="panel space-y-4 p-4 sm:p-6" aria-labelledby="track-persistence-heading" data-track-persistence-state={track.state}>
      <div><p className="field-label">Separate track measure</p><h2 className="mt-2 text-2xl font-semibold text-ink" id="track-persistence-heading">Track-stream persistence</h2><p className="mt-2 text-sm font-semibold text-status-warning">Track-stream persistence measures continued streaming activity. It does not measure unique listener retention.</p><p className="mt-2 text-xs text-muted">Release {track.release.releaseDate} · Campaign selection is not required for this measure.</p></div>
      <div className={stateClass(track.state)} role={track.state === "IDENTITY_CONFLICT" ? "alert" : "status"}><div><p className="font-semibold">{track.state.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{track.message}</p></div></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Identity confidence</dt><dd className="mt-2 font-semibold text-ink">{track.identityConfidence}</dd></div>
        <div className="rounded-xl border border-edge bg-input p-4"><dt className="field-label">Window completeness</dt><dd className="mt-2 font-semibold text-ink">Launch · days 14–28 · latest: {completeness}</dd></div>
      </dl>
      {showMetrics ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{track.metrics.map((metric) => <RetentionMetricCard key={metric.id} metric={metric} />)}</div> : <div className="state-empty"><p className="font-semibold text-ink">Track persistence unavailable</p><p className="mt-2 text-sm text-muted">Import one current track stream timeline and confirm a conflict-free release identity to enable these metrics.</p></div>}
    </section>
  );
}
