export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";

import {ReleaseDetailEditor} from "@/components/release-detail-editor";
import {
  readLatestAdCampaignLearningForRelease,
  readReleaseAdMetrics,
  readReleaseCampaignHistory
} from "@/lib/repositories/ads";
import {readActiveShortLinksByReleaseId} from "@/lib/repositories/short-links";
import {readCopiesByReleaseId} from "@/lib/server/copies";
import {readRelease} from "@/lib/server/releases";

export default async function AdminReleaseDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  try {
    const {id} = await params;
    const [release, linkedCopies, latestAdLearning, adMetrics, campaignHistory, shortLinks] = await Promise.all([
      readRelease(id),
      readCopiesByReleaseId(id),
      readLatestAdCampaignLearningForRelease(id),
      readReleaseAdMetrics(id),
      readReleaseCampaignHistory(id),
      readActiveShortLinksByReleaseId(id)
    ]);

    return (
      <ReleaseDetailEditor
        adMetrics={adMetrics}
        campaignHistory={campaignHistory}
        initialLinkedCopies={linkedCopies}
        initialShortLinks={shortLinks}
        latestAdLearning={latestAdLearning}
        initialRelease={release}
      />
    );
  } catch {
    notFound();
  }
}

