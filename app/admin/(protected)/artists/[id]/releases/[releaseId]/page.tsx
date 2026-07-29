export const dynamic = "force-dynamic";

import {AdminReleaseWorkspace} from "@/components/admin-release-workspace";

export default async function ArtistReleaseEditorPage({
  params
}: {
  params: Promise<{id: string; releaseId: string}>;
}) {
  const {id, releaseId} = await params;
  return (
    <AdminReleaseWorkspace
      artistProfileId={id}
      releaseId={releaseId}
    />
  );
}
