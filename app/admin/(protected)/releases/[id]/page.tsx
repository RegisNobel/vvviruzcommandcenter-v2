export const dynamic = "force-dynamic";

import {AdminReleaseWorkspace} from "@/components/admin-release-workspace";

export default async function AdminReleaseDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  return <AdminReleaseWorkspace releaseId={id} />;
}
