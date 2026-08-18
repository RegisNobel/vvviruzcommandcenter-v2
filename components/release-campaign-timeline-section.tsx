import Link from "next/link";
import {AlertTriangle, CalendarRange} from "lucide-react";

import {CampaignTimelineEditor} from "@/components/campaign-timeline-editor";
import {ReleaseCampaignCreator} from "@/components/release-campaign-creator";
import type {CampaignSourceSnapshot} from "@/lib/analytics/campaign-source-snapshot";

function formatExternalScopeSpend(currency: string, totalCents: number) {
  if (!/^[A-Z]{3}$/.test(currency)) return `${(totalCents / 100).toFixed(2)} ${currency}`;
  return new Intl.NumberFormat("en-US", {style: "currency", currency}).format(totalCents / 100);
}

export function ReleaseCampaignTimelineSection({
  artistProfileId,
  releaseId,
  retentionFreshnessLabel,
  retentionSelectionState,
  selectedCampaign,
  sourceSnapshot,
  timeline
}: {
  artistProfileId: string | null;
  releaseId: string;
  retentionFreshnessLabel: string;
  retentionSelectionState: string;
  selectedCampaign: any | null;
  sourceSnapshot: CampaignSourceSnapshot | null;
  timeline: any;
}) {
  const suggestions = timeline.campaigns.reduce(
    (count: number, campaign: any) => count + campaign.activeIntervals.filter((item: any) => item.confirmationStatus === "SUGGESTED").length,
    0
  );
  const overlaps = timeline.campaigns.flatMap((campaign: any) => campaign.overlaps || []);

  return (
    <div className="scroll-mt-32 space-y-6" id="campaign-timeline">
      <section className="panel space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="field-label">Promotion &amp; Retention</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Campaign Timeline</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">Manage this release&apos;s canonical campaign identity, confirmed paid-promotion intervals, descriptive events, evidence, and overlap context here. Listener retention remains calculated by the unchanged Stage 7 engine below.</p>
          </div>
          <Link className="action-button-secondary text-xs" href="/admin/retention-lab/campaigns">View all campaigns</Link>
        </div>

        {!timeline.campaigns.length ? (
          <p className="rounded-xl border border-dashed border-edge p-6 text-sm text-muted">No promotion campaign is associated with this release.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {timeline.campaigns.map((campaign: any) => (
              <article className="rounded-xl border border-edge bg-input p-4" key={campaign.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="font-semibold text-ink">{campaign.name}</h3><p className="mt-1 text-sm text-secondary">{campaign.platform} · {campaign.status}</p></div>
                  <Link className="text-xs font-semibold text-accent hover:underline" href={`/admin/releases/${releaseId}?manageCampaignId=${campaign.id}#campaign-management`}>{selectedCampaign?.id === campaign.id ? "Editing below" : "Edit here"}</Link>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  {campaign.activeIntervals.filter((item: any) => item.confirmationStatus === "CONFIRMED").map((item: any) => <p key={item.id}><CalendarRange className="mr-1 inline" size={13} />{item.activeStartDate} through {item.activeEndDate || "open"} (inclusive) · Confirmed {item.sourceType === "MANUAL" ? "manual" : "from evidence"}</p>)}
                </div>
                {sourceSnapshot ? (() => {
                  const source = sourceSnapshot.campaigns.find((item) => item.campaignId === campaign.id);
                  if (!source) return null;
                  return (
                    <div className="mt-4 rounded-lg border border-edge bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Live canonical source snapshot</p>
                      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted">Linked Meta evidence</dt>
                          <dd className="mt-1 font-semibold text-ink">{source.meta.canonicalFactCount} daily fact{source.meta.canonicalFactCount === 1 ? "" : "s"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Evidence dates</dt>
                          <dd className="mt-1 font-semibold text-ink">{source.meta.earliestMetricDate && source.meta.latestMetricDate ? `${source.meta.earliestMetricDate} through ${source.meta.latestMetricDate}` : "No linked daily evidence"}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-muted">External-scope spend (descriptive, not attributed)</dt>
                          <dd className="mt-1 font-semibold text-ink">{source.meta.externalScopeSpend.length ? source.meta.externalScopeSpend.map((item) => formatExternalScopeSpend(item.currency, item.totalCents)).join(" · ") : "No canonical spend facts"}</dd>
                        </div>
                      </dl>
                      {source.meta.state === "SHARED_UNALLOCATED" ? <p className="mt-2 text-xs text-status-warning">Shared Meta scope: spend remains unallocated and attribution confidence is reduced.</p> : source.meta.state === "LINKED_SHARED_PARENT" ? <p className="mt-2 text-xs text-status-warning">The Meta parent campaign spans releases, but this confirmed child scope is distinct. Cross-release overlap still lowers attribution confidence.</p> : source.meta.state === "UNLINKED" ? <p className="mt-2 text-xs text-muted">No confirmed stable-ID Meta scope is linked yet.</p> : <p className="mt-2 text-xs text-muted">Confirmed stable-ID scope; figures refresh from current accepted Meta DAILY data.</p>}
                    </div>
                  );
                })() : null}
                {campaign.activeIntervals.some((item: any) => item.confirmationStatus === "SUGGESTED") ? <p className="mt-3 status-badge-warning">Suggestion awaiting confirmation</p> : null}
              </article>
            ))}
          </div>
        )}

        {sourceSnapshot ? (
          <section aria-labelledby="spotify-source-status" className="rounded-xl border border-edge bg-input p-4">
            <h3 className="font-semibold text-ink" id="spotify-source-status">Spotify &amp; Stage 7 source status</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Artist audience timeline</dt><dd className="mt-1 font-semibold text-ink">{sourceSnapshot.spotify.latestAudienceDate ?? "Unavailable"}</dd><dd className="text-xs text-muted">{sourceSnapshot.spotify.audienceImportCount} current import{sourceSnapshot.spotify.audienceImportCount === 1 ? "" : "s"}</dd></div>
              <div><dt className="text-xs text-muted">Release track timeline</dt><dd className="mt-1 font-semibold text-ink">{sourceSnapshot.spotify.latestTrackDate ?? "Unavailable"}</dd><dd className="text-xs text-muted">{sourceSnapshot.spotify.trackImportCount} current import{sourceSnapshot.spotify.trackImportCount === 1 ? "" : "s"}</dd></div>
              <div><dt className="text-xs text-muted">Stage 7 readiness</dt><dd className="mt-1 font-semibold text-ink">{retentionSelectionState.replaceAll("_", " ")}</dd><dd className="text-xs text-muted">{retentionFreshnessLabel}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">These values are read from current normalized imports on every workspace load. Replaced or withdrawn Spotify imports and withdrawn Meta batches are excluded automatically; Stage 7 formulas remain unchanged.</p>
          </section>
        ) : (
          <div className="state-panel-warning"><AlertTriangle size={18} />Live source status is temporarily unavailable. Campaign management and the Stage 7 retention view remain independent.</div>
        )}

        {artistProfileId ? <ReleaseCampaignCreator artistProfileId={artistProfileId} releaseId={releaseId} /> : <div className="state-panel-warning"><AlertTriangle size={18} />Assign this release to an artist before creating a campaign.</div>}

        {timeline.events.length ? <details className="rounded-xl border border-edge bg-input p-4"><summary className="cursor-pointer font-semibold text-ink">Timeline events ({timeline.events.length})</summary><div className="mt-3 space-y-2">{timeline.events.map((event: any) => <p className="text-sm text-secondary" key={event.id}><strong>{event.eventDate}</strong> · {event.title} <span className="text-xs text-muted">({event.source === "SYSTEM_INTERVAL_SYNC" ? "system-generated from confirmed interval" : event.source === "USER_ENTERED" ? "user-entered descriptive event" : event.source.toLowerCase().replaceAll("_", " ")})</span></p>)}</div></details> : null}
        {suggestions ? <div className="state-panel-warning"><AlertTriangle size={18} />{suggestions} suggested interval{suggestions === 1 ? "" : "s"} still require admin confirmation and timezone review.</div> : null}
        {overlaps.length ? <div className="state-panel-warning"><AlertTriangle size={18} />{overlaps.length} overlap record{overlaps.length === 1 ? "" : "s"}, including concurrent campaigns or other releases published during campaign dates.</div> : null}
      </section>

      {selectedCampaign ? (
        <section className="scroll-mt-32 space-y-4" id="campaign-management">
          <div className="panel px-4 py-5 sm:px-6"><p className="field-label">Canonical campaign management</p><h2 className="mt-2 text-2xl font-semibold text-ink">{selectedCampaign.name}</h2><p className="mt-2 text-sm text-muted">Changes here use the existing audited campaign APIs and immediately feed the shared timeline and retention engine.</p></div>
          <CampaignTimelineEditor backHref={`/admin/releases/${releaseId}#campaign-timeline`} initialCampaign={selectedCampaign} />
        </section>
      ) : null}
    </div>
  );
}
