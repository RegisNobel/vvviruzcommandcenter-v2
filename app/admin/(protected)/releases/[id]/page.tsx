export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";

import {ReleaseDetailEditor} from "@/components/release-detail-editor";
import {readLatestAdCampaignLearningForRelease, readReleaseAdMetrics} from "@/lib/repositories/ads";
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
    const [release, linkedCopies, latestAdLearning, adMetrics, shortLinks] = await Promise.all([
      readRelease(id),
      readCopiesByReleaseId(id),
      readLatestAdCampaignLearningForRelease(id),
      readReleaseAdMetrics(id),
      readActiveShortLinksByReleaseId(id)
    ]);

    return (
      <ReleaseDetailEditor
        adMetrics={adMetrics}
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

