import Link from "next/link";
import {notFound} from "next/navigation";

import {ReleaseDetailEditor} from "@/components/release-detail-editor";
import {ArtistReleasePlacementControl} from "@/components/artist-release-placement-control";
import {
  readAdPerformanceTimeline,
  readCreativePerformanceMemory,
  readCopyPerformanceMemory,
  readLatestAdCampaignLearningForRelease,
  readReleaseAdMetrics,
  readReleaseAdReports,
  readReleaseAdTestHistory,
  readReleaseCampaignHistory
} from "@/lib/repositories/ads";
import {listReleaseAnnotations} from "@/lib/repositories/fan-content";
import {readPlaylists} from "@/lib/repositories/playlists";
import {readShortLinksByReleaseId} from "@/lib/repositories/short-links";
import {prisma} from "@/lib/db/prisma";
import {readCopiesByReleaseId} from "@/lib/server/copies";
import {readRelease} from "@/lib/server/releases";

export async function AdminReleaseWorkspace({
  releaseId,
  artistProfileId
}: {
  releaseId: string;
  artistProfileId?: string;
}) {
  try {
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
      reports,
      historicalReports,
      playlists,
      playlistMemberships,
      annotations,
      artist
    ] = await Promise.all([
      readRelease(releaseId),
      readCopiesByReleaseId(releaseId),
      readLatestAdCampaignLearningForRelease(releaseId),
      readReleaseAdMetrics(releaseId),
      readReleaseCampaignHistory(releaseId),
      readShortLinksByReleaseId(releaseId),
      readCreativePerformanceMemory(releaseId),
      readAdPerformanceTimeline(releaseId),
      readCopyPerformanceMemory(releaseId),
      prisma.analyticsEvent.findMany({
        where: {
          page: "links",
          releaseId
        }
      }),
      readReleaseAdReports(releaseId),
      readReleaseAdTestHistory(releaseId),
      readPlaylists({archiveStatus: "active"}),
      prisma.playlistRelease.findMany({where: {releaseId}}),
      listReleaseAnnotations(releaseId),
      artistProfileId
        ? prisma.artistProfile.findUnique({
            where: {id: artistProfileId},
            select: {
              id: true,
              displayName: true,
              featuredItems: {
                where: {releaseId, placement: "HOME"},
                select: {id: true, isStartHere: true},
                take: 1
              },
              releaseCredits: {
                where: {releaseId},
                select: {id: true},
                take: 1
              }
            }
          })
        : Promise.resolve(null)
    ]);

    if (
      artistProfileId &&
      (!artist ||
        (release.primary_artist_profile_id !== artistProfileId &&
          artist.featuredItems.length === 0 &&
          artist.releaseCredits.length === 0))
    ) {
      notFound();
    }

    const views = analyticsEvents.filter(
      (event) => event.eventType === "links_page_view"
    );
    const streamingClicks = analyticsEvents.filter(
      (event) =>
        event.eventType === "links_link_click" &&
        ["apple-music", "spotify", "youtube-music", "youtube-video"].includes(
          event.linkType
        )
    );
    const viewsWithUtm = views.filter(
      (event) => event.utmCampaign || event.utmContent
    ).length;
    const utmCoverageRate =
      views.length > 0 ? (viewsWithUtm / views.length) * 100 : 0;

    return (
      <div className="space-y-6">
        {artist ? (
          <>
          <div>
            <Link
              className="text-sm font-semibold text-muted hover:text-ink"
              href={`/admin/artists/${artist.id}`}
            >
              ← {artist.displayName}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="status-badge-neutral">Artist release workspace</span>
              <span className="status-badge-neutral">{release.catalog_scope}</span>
            </div>
          </div>
          <ArtistReleasePlacementControl
            artistProfileId={artist.id}
            initialPlacement={
              artist.featuredItems[0]?.isStartHere
                ? "START_HERE"
                : artist.featuredItems.length
                  ? "SUPPORTING"
                  : "NONE"
            }
            releaseId={release.id}
          />
          </>
        ) : null}
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
          historicalReports={historicalReports}
          initialPlaylists={playlists}
          initialPlaylistMemberships={playlistMemberships}
          initialAnnotations={annotations}
          managedArtistEditorial={Boolean(artist)}
          backHref={artist ? `/admin/artists/${artist.id}` : "/admin/releases"}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
