import Link from "next/link";

import {RetentionAnalysisView} from "@/components/retention-analysis-view";
import type {RetentionDashboardData} from "@/lib/analytics/retention-dashboard";

export function ReleaseRetentionSection({data, releaseId}: {data: RetentionDashboardData; releaseId: string}) {
  const release = data.releases.find((item) => item.id === releaseId) ?? null;
  return (
    <section className="scroll-mt-32 space-y-5" id="audience-retention">
      <section className="panel space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="field-label">Audience analytics</p><h2 className="mt-2 text-2xl font-semibold text-ink">Audience Retention</h2><p className="mt-2 max-w-4xl text-sm text-muted">The same Stage 7 calculation and production chart adapter used by the global Retention Lab. No release-specific calculation path is introduced.</p></div><Link className="action-button-secondary text-xs" href={`/admin/retention-lab?releaseId=${releaseId}${data.selectedCampaignId ? `&campaignId=${data.selectedCampaignId}` : ""}`}>Open global overview</Link></div>
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end" method="get">
          <label className="space-y-2"><span className="field-label">Campaign</span><select className="form-input" defaultValue={data.selectedCampaignId ?? ""} name="campaignId"><option value="">{release?.campaigns.length ? "Select campaign" : "No campaign"}</option>{release?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.platform} · {campaign.confirmedIntervalCount} confirmed</option>)}</select></label>
          <label className="space-y-2"><span className="field-label">Chart range</span><select className="form-input" defaultValue={String(data.rangeDays)} name="retentionRange"><option value="180">180 days</option><option value="365">365 days</option><option value="1000">1,000 days</option></select></label>
          <button className="action-button-primary justify-center" type="submit">Load retention</button>
        </form>
        {!data.analysis ? <div className={data.selectionState === "DATA_UNAVAILABLE" || data.selectionState === "INVALID_SELECTION" ? "state-panel-danger" : "state-panel-warning"} role="status"><div><p className="font-semibold">{data.selectionState.replaceAll("_", " ")}</p><p className="mt-1 text-sm">{data.selectionMessage}</p><div className="mt-3 flex flex-wrap gap-3"><Link className="action-button-secondary text-xs" href="/admin/retention-lab/campaigns">Manage campaigns</Link><Link className="action-button-secondary text-xs" href="/admin/retention-lab/imports">Import data</Link><Link className="action-button-secondary text-xs" href="/admin/retention-lab/mappings">Review mappings</Link></div></div></div> : null}
      </section>
      {data.analysis ? <RetentionAnalysisView analysis={data.analysis} context="RELEASE" /> : null}
    </section>
  );
}
