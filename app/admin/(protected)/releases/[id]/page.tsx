export const dynamic = "force-dynamic";

import {AdminReleaseWorkspace} from "@/components/admin-release-workspace";

export default async function AdminReleaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{id: string}>;
  searchParams: Promise<{campaignId?: string; manageCampaignId?: string; retentionRange?: string}>;
}) {
  const [{id}, query] = await Promise.all([params, searchParams]);
  return <AdminReleaseWorkspace manageCampaignId={query.manageCampaignId} releaseId={id} retentionCampaignId={query.campaignId} retentionRange={query.retentionRange} />;
}
