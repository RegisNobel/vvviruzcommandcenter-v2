import Link from "next/link";
import {AlertTriangle, CalendarRange} from "lucide-react";

import {CampaignTimelineEditor} from "@/components/campaign-timeline-editor";
import {ReleaseCampaignCreator} from "@/components/release-campaign-creator";

export function ReleaseCampaignTimelineSection({
  artistProfileId,
  releaseId,
  selectedCampaign,
  timeline
}: {
  artistProfileId: string | null;
  releaseId: string;
  selectedCampaign: any | null;
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
                {campaign.activeIntervals.some((item: any) => item.confirmationStatus === "SUGGESTED") ? <p className="mt-3 status-badge-warning">Suggestion awaiting confirmation</p> : null}
              </article>
            ))}
          </div>
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
