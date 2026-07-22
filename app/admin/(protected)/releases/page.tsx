export const dynamic = "force-dynamic";

import {ReleasesPageContent} from "@/components/releases-page-content";
import {readAdminOperatorQueue} from "@/lib/repositories/operational-health";
import {readReleaseSummaries} from "@/lib/server/releases";
import {refreshOperationalHealthAction} from "@/app/admin/(protected)/releases/actions";

export default async function AdminReleasesPage() {
  const [releases, operatorQueue] = await Promise.all([
    readReleaseSummaries(),
    readAdminOperatorQueue()
  ]);

  return (
    <ReleasesPageContent
      operatorQueue={operatorQueue}
      refreshOperationalHealthAction={refreshOperationalHealthAction}
      releases={releases}
    />
  );
}
