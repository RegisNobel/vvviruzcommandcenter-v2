export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";

import {ReleaseDetailEditor} from "@/components/release-detail-editor";
import {readLatestAdCampaignLearningForRelease} from "@/lib/repositories/ads";
import {readCopiesByReleaseId} from "@/lib/server/copies";
import {readRelease} from "@/lib/server/releases";

export default async function AdminReleaseDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  try {
    const {id} = await params;
    const [release, linkedCopies, latestAdLearning] = await Promise.all([
      readRelease(id),
      readCopiesByReleaseId(id),
      readLatestAdCampaignLearningForRelease(id)
    ]);

    return (
      <ReleaseDetailEditor
        initialLinkedCopies={linkedCopies}
        latestAdLearning={latestAdLearning}
        initialRelease={release}
      />
    );
  } catch {
    notFound();
  }
}
