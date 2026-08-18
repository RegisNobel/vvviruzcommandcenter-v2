export const dynamic = "force-dynamic";

import {AdminReleaseWorkspace} from "@/components/admin-release-workspace";

export default async function ArtistReleaseEditorPage({
  params,
  searchParams
}: {
  params: Promise<{id: string; releaseId: string}>;
  searchParams: Promise<{campaignId?: string; manageCampaignId?: string; retentionRange?: string}>;
}) {
  const [{id, releaseId}, query] = await Promise.all([params, searchParams]);
  return (
    <AdminReleaseWorkspace
      artistProfileId={id}
      manageCampaignId={query.manageCampaignId}
      releaseId={releaseId}
      retentionCampaignId={query.campaignId}
      retentionRange={query.retentionRange}
    />
  );
}
