import type {PlaylistAnalyticsSummary, PlaylistReadiness} from "@/lib/types";

function ReadinessCard({label, readiness}: {label: string; readiness: PlaylistReadiness}) {
  const tone = readiness.status === "Ready"
    ? "status-badge-ready"
    : readiness.status === "Blocked"
      ? "status-badge-danger"
      : "status-badge-warning";
  return (
    <div className="command-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">{label}</h3>
        <span className={tone}>{readiness.status}</span>
      </div>
      {readiness.issues.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {readiness.issues.map((issue) => <li key={issue}>• {issue}</li>)}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No applicable blockers detected.</p>
      )}
    </div>
  );
}

export function PlaylistAnalyticsPanel({analytics}: {analytics: PlaylistAnalyticsSummary}) {
  const metrics = [
    ["Measured arrivals", analytics.overview.measuredArrivals],
    ["Content views", analytics.overview.contentViews],
    ["Unique visitors", analytics.overview.uniqueVisitors],
    ["Sessions", analytics.overview.sessions],
    ["Outbound music clicks", analytics.overview.outboundClicks],
    ["Unique outbound clickers", analytics.overview.uniqueClickers],
    ["View-to-stream-intent", analytics.overview.viewToStreamIntentRate === null ? "No signal" : `${analytics.overview.viewToStreamIntentRate}%`]
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ReadinessCard label="Public readiness" readiness={analytics.publicReadiness} />
        <ReadinessCard label="Paid campaign readiness" readiness={analytics.paidReadiness} />
      </div>

      <div className="panel p-6">
        <div>
          <p className="section-eyebrow">Last {analytics.days} days</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">Playlist measurement</h3>
          <p className="mt-2 text-sm text-muted">Arrivals count the first playlist view per session. Internal member navigation remains in content views.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div className="inset-surface p-4" key={label}>
              <p className="field-label">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-6">
          <h3 className="font-semibold text-ink">Release performance</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="pb-3">Release</th><th>Views</th><th>Clicks</th><th>Intent rate</th></tr></thead>
              <tbody className="divide-y divide-edge">
                {analytics.releasePerformance.map((row) => (
                  <tr key={row.releaseId}><td className="py-3 pr-4 font-medium text-ink">{row.title}</td><td>{row.views}</td><td>{row.outboundClicks}</td><td>{row.clickThroughRate === null ? "No signal" : `${row.clickThroughRate}%`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-6">
          <div className="panel p-6">
            <h3 className="font-semibold text-ink">Short Link handoff</h3>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="inset-surface p-3"><strong className="block text-xl text-ink">{analytics.shortLinks.activeCount}</strong><span className="text-xs text-muted">Active links</span></div>
              <div className="inset-surface p-3"><strong className="block text-xl text-ink">{analytics.shortLinks.allTimeClicks}</strong><span className="text-xs text-muted">All-time clicks</span></div>
              <div className="inset-surface p-3"><strong className="block text-xl text-ink">{analytics.shortLinks.measuredArrivals}</strong><span className="text-xs text-muted">Measured arrivals</span></div>
            </div>
            <p className="mt-3 text-xs text-muted">Short Link clicks are lifetime totals; measured arrivals use the selected {analytics.days}-day window.</p>
          </div>
          <div className="panel p-6">
            <h3 className="font-semibold text-ink">Platforms</h3>
            <div className="mt-4 space-y-2">
              {analytics.platformBreakdown.length > 0 ? analytics.platformBreakdown.map((item) => (
                <div className="flex justify-between text-sm" key={item.label}><span className="text-muted">{item.label.replaceAll("_", " ")}</span><strong className="text-ink">{item.count}</strong></div>
              )) : <p className="text-sm text-muted">No outbound music clicks recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[{title: "Sources", rows: analytics.sourceBreakdown}, {title: "Campaigns", rows: analytics.campaignBreakdown}].map((group) => (
          <div className="panel p-6" key={group.title}>
            <h3 className="font-semibold text-ink">{group.title}</h3>
            <div className="mt-4 space-y-2">
              {group.rows.slice(0, 8).map((item) => <div className="flex justify-between gap-4 text-sm" key={item.label}><span className="break-all text-muted">{item.label}</span><strong className="text-ink">{item.count}</strong></div>)}
              {group.rows.length === 0 && <p className="text-sm text-muted">No campaign attribution recorded yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
