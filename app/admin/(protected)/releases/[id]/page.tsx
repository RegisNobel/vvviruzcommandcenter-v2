export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";

import {ReleaseDetailEditor} from "@/components/release-detail-editor";
import {
  readLatestAdCampaignLearningForRelease,
  readReleaseAdMetrics,
  readReleaseCampaignHistory,
  readCreativePerformanceMemory,
  readAdPerformanceTimeline,
  readCopyPerformanceMemory,
  readReleaseAdReports
} from "@/lib/repositories/ads";
import {readShortLinksByReleaseId} from "@/lib/repositories/short-links";
import {readCopiesByReleaseId} from "@/lib/server/copies";
import {readRelease} from "@/lib/server/releases";
import {prisma} from "@/lib/db/prisma";

export default async function AdminReleaseDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  try {
    const {id} = await params;
    const [
      release,
      linkedCopies,
      latestAdLearning,
      adMetrics,
      campaignHistory,
      shortLinks,
      creativePerformanceMemory,
      adPerformanceTimeline,
      copyPerformanceMemory,
      analyticsEvents,
      reports
    ] = await Promise.all([
      readRelease(id),
      readCopiesByReleaseId(id),
      readLatestAdCampaignLearningForRelease(id),
      readReleaseAdMetrics(id),
      readReleaseCampaignHistory(id),
      readShortLinksByReleaseId(id),
      readCreativePerformanceMemory(id),
      readAdPerformanceTimeline(id),
      readCopyPerformanceMemory(id),
      prisma.analyticsEvent.findMany({
        where: {
          page: "links",
          releaseId: id
        }
      }),
      readReleaseAdReports(id)
    ]);

    const views = analyticsEvents.filter((event) => event.eventType === "links_page_view");
    const streamingClicks = analyticsEvents.filter(
      (event) => event.eventType === "links_link_click" && ["apple-music", "spotify", "youtube-music", "youtube-video"].includes(event.linkType)
    );
    const viewsWithUtm = views.filter((event) => event.utmCampaign || event.utmContent).length;
    const utmCoverageRate = views.length > 0 ? (viewsWithUtm / views.length) * 100 : 0;

    return (
      <ReleaseDetailEditor
        adMetrics={adMetrics}
        campaignHistory={campaignHistory}
        initialLinkedCopies={linkedCopies}
        initialShortLinks={shortLinks}
        latestAdLearning={latestAdLearning}
        initialRelease={release}
        creativePerformanceMemory={creativePerformanceMemory}
        adPerformanceTimeline={adPerformanceTimeline}
        copyPerformanceMemory={copyPerformanceMemory}
        streamingClicksCount={streamingClicks.length}
        utmCoverageRate={utmCoverageRate}
        reports={reports}
      />
    );
  } catch {
    notFound();
  }
}
