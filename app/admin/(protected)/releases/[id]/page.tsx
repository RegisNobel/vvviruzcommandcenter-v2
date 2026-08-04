export const dynamic = "force-dynamic";

import {AdminReleaseWorkspace} from "@/components/admin-release-workspace";

export default async function AdminReleaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{id: string}>;
  searchParams: Promise<{campaignId?: string; retentionRange?: string}>;
}) {
  const [{id}, query] = await Promise.all([params, searchParams]);
  return <AdminReleaseWorkspace releaseId={id} retentionCampaignId={query.campaignId} retentionRange={query.retentionRange} />;
}
