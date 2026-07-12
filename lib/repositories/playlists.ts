import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";
import {validateExternalUrl} from "@/lib/validation";
import {
  parseSpotifyResourceUrl,
  buildSpotifyPlaylistContextUrl
} from "@/lib/spotify-links";
import {
  buildYouTubePlaylistContextUrl,
  parseYouTubePlaylistUrl
} from "@/lib/youtube-links";
import type {Playlist, PlaylistRelease, Release} from "@prisma/client";
import type {PlaylistAnalyticsSummary, PlaylistRecord, PlaylistReleaseRecord, PlaylistReadiness} from "@/lib/types";
import {inferPlaylistPlatform, validatePlaylistDestination} from "@/lib/playlist-analytics";

// Mapping helpers
function toPlaylistRecord(
  playlist: Playlist & {
    _count?: { releases: number };
    featuredRelease?: { title: string } | null;
  }
): PlaylistRecord {
  return {
    id: playlist.id,
    name: playlist.name,
    slug: playlist.slug,
    description: playlist.description,
    coverImageUrl: playlist.coverImageUrl,
    spotifyPlaylistUrl: playlist.spotifyPlaylistUrl,
    applePlaylistUrl: playlist.applePlaylistUrl,
    youtubePlaylistUrl: playlist.youtubePlaylistUrl,
    primaryPlatform: playlist.primaryPlatform,
    featuredReleaseId: playlist.featuredReleaseId,
    isPublic: playlist.isPublic,
    isArchived: playlist.isArchived,
    sortOrder: playlist.sortOrder,
    createdAt: playlist.createdAt.toISOString(),
    updatedAt: playlist.updatedAt.toISOString(),
    featuredRelease_title: playlist.featuredRelease?.title ?? undefined,
    activeReleaseCount: playlist._count?.releases ?? undefined
  };
}

function toPlaylistReleaseRecord(
  membership: PlaylistRelease & {
    release?: Release | null;
  }
): PlaylistReleaseRecord {
  return {
    playlistId: membership.playlistId,
    releaseId: membership.releaseId,
    position: membership.position,
    spotifyTargetUrl: membership.spotifyTargetUrl,
    spotifyTrackUrl: membership.spotifyTrackUrl,
    spotifyTargetMode: membership.spotifyTargetMode,
    appleTargetUrl: membership.appleTargetUrl,
    youtubeTargetUrl: membership.youtubeTargetUrl,
    isActive: membership.isActive,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    release_title: membership.release?.title ?? undefined,
    release_slug: membership.release?.slug ?? undefined,
    release_cover_art_path: membership.release?.coverArtPath ?? undefined,
    release_type: membership.release?.type ?? undefined,
    release_collaborator: membership.release?.collaborator ?? undefined,
    release_collaborator_name: membership.release?.collaboratorName ?? undefined,
    release_public_description: membership.release?.publicDescription ?? undefined,
    release_is_published: membership.release?.isPublished ?? undefined
  };
}

// Read options
export async function readPlaylists(options?: { archiveStatus?: "active" | "archived" | "all" }) {
  const archiveFilter = options?.archiveStatus ?? "active";
  
  const whereClause = 
    archiveFilter === "active" ? { isArchived: false } :
    archiveFilter === "archived" ? { isArchived: true } : {};

  const playlists = await prisma.playlist.findMany({
    where: whereClause,
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "desc" }
    ],
    include: {
      _count: {
        select: { releases: { where: { isActive: true } } }
      },
      featuredRelease: {
        select: { title: true }
      }
    }
  });

  return playlists.map(toPlaylistRecord);
}

export async function readPlaylist(id: string): Promise<PlaylistRecord | null> {
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      featuredRelease: { select: { title: true } }
    }
  });
  if (!playlist) return null;
  return toPlaylistRecord(playlist);
}

export async function readPlaylistWithMemberships(id: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      featuredRelease: { select: { title: true } },
      releases: {
        orderBy: { position: "asc" },
        include: { release: true }
      }
    }
  });
  if (!playlist) return null;
  
  return {
    playlist: toPlaylistRecord(playlist),
    memberships: playlist.releases.map(toPlaylistReleaseRecord)
  };
}

function toReadiness(issues: string[], blocked: boolean): PlaylistReadiness {
  return {
    status: blocked ? "Blocked" : issues.length > 0 ? "Needs review" : "Ready",
    issues
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export async function readPlaylistAnalytics(
  playlistId: string,
  days = 30
): Promise<PlaylistAnalyticsSummary | null> {
  const safeDays = Math.min(Math.max(days, 7), 120);
  const startDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const playlist = await prisma.playlist.findUnique({
    where: {id: playlistId},
    include: {
      releases: {
        orderBy: {position: "asc"},
        include: {release: {select: {id: true, isPublished: true, title: true}}}
      }
    }
  });
  if (!playlist) return null;

  const [events, shortLinks] = await Promise.all([
    prisma.analyticsEvent.findMany({
      orderBy: {createdAt: "asc"},
      where: {
        OR: [
          {playlistId},
          {hubPath: `/listen/${playlist.slug}`},
          {path: {startsWith: `/listen/${playlist.slug}/`}}
        ],
        createdAt: {gte: startDate},
        eventType: {in: ["playlist_page_view", "playlist_track_click"]}
      }
    }),
    prisma.shortLink.findMany({
      select: {clickCount: true, status: true},
      where: {
        deletedAt: null,
        destinationUrl: {contains: `/listen/${playlist.slug}`}
      }
    })
  ]);

  const views = events.filter((event) => event.eventType === "playlist_page_view");
  const clicks = events.filter((event) => event.eventType === "playlist_track_click");
  const legacyViews = views.filter((view) => !view.entryType);
  const firstViewBySession = new Map<string, string>();
  for (const view of legacyViews) {
    const sessionKey = view.sessionId || view.visitorId || view.id;
    if (!firstViewBySession.has(sessionKey)) firstViewBySession.set(sessionKey, view.id);
  }
  const arrivals = views.filter((view) =>
    view.entryType
      ? view.entryType !== "internal_navigation"
      : firstViewBySession.get(view.sessionId || view.visitorId || view.id) === view.id
  );
  const unique = (values: string[]) => new Set(values.filter(Boolean)).size;
  const countBy = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const label = value.trim() || "Direct / Unknown";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts, ([label, count]) => ({label, count})).sort((a, b) => b.count - a.count);
  };

  const publicIssues: string[] = [];
  const paidIssues: string[] = [];
  const active = playlist.releases.filter((membership) => membership.isActive);
  const published = active.filter((membership) => membership.release.isPublished);
  if (!playlist.isPublic) publicIssues.push("Playlist is not published.");
  if (published.length === 0) publicIssues.push("The playlist contains no published members.");
  if (playlist.featuredReleaseId && !active.some((item) => item.releaseId === playlist.featuredReleaseId)) {
    publicIssues.push("The featured release is no longer an active playlist member.");
  }
  for (const membership of published) {
    const destinations = [
      ["spotify", membership.spotifyTargetUrl],
      ["apple_music", membership.appleTargetUrl],
      [inferPlaylistPlatform(membership.youtubeTargetUrl, "youtube_music"), membership.youtubeTargetUrl]
    ] as const;
    if (!destinations.some(([, value]) => value.trim())) {
      paidIssues.push(`${membership.release.title} has no music-platform destination.`);
      continue;
    }
    for (const [platform, value] of destinations) {
      if (!value.trim()) continue;
      const validation = validatePlaylistDestination(platform, value);
      if (!validation.valid) paidIssues.push(`${membership.release.title}: ${validation.issue}`);
    }
  }

  const releasePerformance = published.map((membership) => {
    const releaseViews = views.filter((event) => event.releaseId === membership.releaseId);
    const releaseClicks = clicks.filter((event) => event.releaseId === membership.releaseId);
    return {
      releaseId: membership.releaseId,
      title: membership.release.title,
      views: releaseViews.length,
      outboundClicks: releaseClicks.length,
      uniqueClickers: unique(releaseClicks.map((event) => event.visitorId)),
      clickThroughRate: percentage(releaseClicks.length, releaseViews.length)
    };
  });

  return {
    days: safeDays,
    updatedAt: new Date().toISOString(),
    overview: {
      contentViews: views.length,
      measuredArrivals: arrivals.length,
      uniqueVisitors: unique(views.map((event) => event.visitorId)),
      sessions: unique(views.map((event) => event.sessionId)),
      outboundClicks: clicks.length,
      uniqueClickers: unique(clicks.map((event) => event.visitorId)),
      viewToStreamIntentRate: percentage(clicks.length, views.length)
    },
    publicReadiness: toReadiness(publicIssues, published.length === 0),
    paidReadiness: toReadiness(paidIssues, paidIssues.length > 0),
    platformBreakdown: countBy(clicks.map((event) => event.platform || event.linkType || event.linkLabel)),
    sourceBreakdown: countBy(arrivals.map((event) => event.utmSource || event.originalReferrer || "Direct / Unknown")),
    campaignBreakdown: countBy(arrivals.map((event) => event.utmCampaign || "No campaign")),
    releasePerformance,
    shortLinks: {
      activeCount: shortLinks.filter((link) => link.status === "ACTIVE").length,
      allTimeClicks: shortLinks.reduce((sum, link) => sum + link.clickCount, 0),
      measuredArrivals: arrivals.filter((event) => Boolean(event.shortLinkId)).length
    }
  };
}

export async function createPlaylist(data: {
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string;
  spotifyPlaylistUrl?: string;
  applePlaylistUrl?: string;
  youtubePlaylistUrl?: string;
  primaryPlatform?: string;
  isPublic?: boolean;
  sortOrder?: number;
}): Promise<PlaylistRecord> {
  if (!data.name.trim()) {
    throw new Error("Playlist name cannot be empty.");
  }
  if (!data.slug.trim()) {
    throw new Error("Playlist slug cannot be empty.");
  }

  const playlist = await prisma.playlist.create({
    data: {
      id: createId(),
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description?.trim() ?? "",
      coverImageUrl: data.coverImageUrl?.trim() ?? "",
      spotifyPlaylistUrl: data.spotifyPlaylistUrl?.trim() ?? "",
      applePlaylistUrl: data.applePlaylistUrl?.trim() ?? "",
      youtubePlaylistUrl: data.youtubePlaylistUrl?.trim() ?? "",
      primaryPlatform: data.primaryPlatform?.trim() ?? "spotify",
      isPublic: data.isPublic ?? false,
      sortOrder: data.sortOrder ?? 0
    }
  });

  return toPlaylistRecord(playlist);
}

export type SpotifyRegenerationSummary = {
  refreshedCount: number;
  manualUnchangedCount: number;
  missingTrackUrlCount: number;
  invalidTrackUrlCount: number;
  clearedTargetCount: number;
  affectedReleaseCount: number;
};

export async function updatePlaylist(
  id: string,
  data: {
    name: string;
    slug: string;
    description?: string;
    coverImageUrl?: string;
    spotifyPlaylistUrl?: string;
    applePlaylistUrl?: string;
    youtubePlaylistUrl?: string;
    primaryPlatform?: string;
    isPublic?: boolean;
    sortOrder?: number;
    featuredReleaseId?: string | null;
  }
): Promise<{ playlist: PlaylistRecord; summary?: SpotifyRegenerationSummary }> {
  if (!data.name.trim()) {
    throw new Error("Playlist name cannot be empty.");
  }
  if (!data.slug.trim()) {
    throw new Error("Playlist slug cannot be empty.");
  }

  // Validate playlist URLs if provided
  if (data.spotifyPlaylistUrl) {
    if (!validateExternalUrl(data.spotifyPlaylistUrl)) {
      throw new Error("Spotify playlist URL must be a valid HTTPS link.");
    }
    try {
      parseSpotifyResourceUrl(data.spotifyPlaylistUrl, "playlist");
    } catch (err: any) {
      throw new Error(`Malformed Spotify Playlist URL: ${err.message}`);
    }
  }
  if (data.applePlaylistUrl && !validateExternalUrl(data.applePlaylistUrl)) {
    throw new Error("Apple playlist URL must be a valid HTTPS link.");
  }
  if (data.youtubePlaylistUrl && !validateExternalUrl(data.youtubePlaylistUrl)) {
    throw new Error("YouTube playlist URL must be a valid HTTPS link.");
  }
  if (data.youtubePlaylistUrl) {
    try {
      parseYouTubePlaylistUrl(data.youtubePlaylistUrl);
    } catch (error) {
      throw new Error(
        `Malformed YouTube Playlist URL: ${error instanceof Error ? error.message : "Invalid playlist URL."}`
      );
    }
  }

  const oldPlaylist = await prisma.playlist.findUnique({
    where: { id }
  });

  if (!oldPlaylist) {
    throw new Error("Playlist not found.");
  }

  // Check if Spotify playlist URL changed or was cleared
  const newSpotifyUrl = data.spotifyPlaylistUrl !== undefined ? data.spotifyPlaylistUrl.trim() : oldPlaylist.spotifyPlaylistUrl;
  const spotifyUrlChanged = newSpotifyUrl !== oldPlaylist.spotifyPlaylistUrl;
  const newYouTubeUrl = data.youtubePlaylistUrl !== undefined ? data.youtubePlaylistUrl.trim() : oldPlaylist.youtubePlaylistUrl;
  const youtubeUrlChanged = newYouTubeUrl !== oldPlaylist.youtubePlaylistUrl;

  const result = await prisma.$transaction(async (tx) => {
    const playlist = await tx.playlist.update({
      where: { id },
      data: {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() ?? "",
        coverImageUrl: data.coverImageUrl?.trim() ?? "",
        spotifyPlaylistUrl: data.spotifyPlaylistUrl?.trim() ?? "",
        applePlaylistUrl: data.applePlaylistUrl?.trim() ?? "",
        youtubePlaylistUrl: data.youtubePlaylistUrl?.trim() ?? "",
        primaryPlatform: data.primaryPlatform?.trim() ?? "spotify",
        isPublic: data.isPublic ?? false,
        sortOrder: data.sortOrder ?? 0,
        featuredReleaseId: data.featuredReleaseId
      }
    });

    if (!spotifyUrlChanged && !youtubeUrlChanged) {
      return { playlist: toPlaylistRecord(playlist) };
    }

    const memberships = await tx.playlistRelease.findMany({
      where: { playlistId: id }
    });

    const summary: SpotifyRegenerationSummary = {
      refreshedCount: 0,
      manualUnchangedCount: 0,
      missingTrackUrlCount: 0,
      invalidTrackUrlCount: 0,
      clearedTargetCount: 0,
      affectedReleaseCount: 0
    };

    for (const m of memberships) {
      if (m.spotifyTargetMode === "generated") {
        summary.affectedReleaseCount += 1;

        if (!newSpotifyUrl) {
          // Playlist URL is cleared: clear all generated targets
          if (m.spotifyTargetUrl) {
            summary.clearedTargetCount += 1;
          }
          await tx.playlistRelease.update({
            where: { playlistId_releaseId: { playlistId: id, releaseId: m.releaseId } },
            data: { spotifyTargetUrl: "" }
          });
        } else {
          if (!m.spotifyTrackUrl) {
            // Track URL is missing
            summary.missingTrackUrlCount += 1;
            if (m.spotifyTargetUrl) {
              summary.clearedTargetCount += 1;
            }
            await tx.playlistRelease.update({
              where: { playlistId_releaseId: { playlistId: id, releaseId: m.releaseId } },
              data: { spotifyTargetUrl: "" }
            });
          } else {
            // Generate context URL
            try {
              const res = buildSpotifyPlaylistContextUrl(m.spotifyTrackUrl, newSpotifyUrl);
              await tx.playlistRelease.update({
                where: { playlistId_releaseId: { playlistId: id, releaseId: m.releaseId } },
                data: { spotifyTargetUrl: res.targetUrl }
              });
              summary.refreshedCount += 1;
            } catch {
              // Tolerating legacy malformed track URLs in bulk regeneration only
              summary.invalidTrackUrlCount += 1;
              if (m.spotifyTargetUrl) {
                summary.clearedTargetCount += 1;
              }
              await tx.playlistRelease.update({
                where: { playlistId_releaseId: { playlistId: id, releaseId: m.releaseId } },
                data: { spotifyTargetUrl: "" }
              });
            }
          }
        }
      } else {
        summary.manualUnchangedCount += 1;
      }

      if (youtubeUrlChanged && m.youtubeTargetUrl && newYouTubeUrl) {
        try {
          const generated = buildYouTubePlaylistContextUrl(m.youtubeTargetUrl, newYouTubeUrl);
          await tx.playlistRelease.update({
            where: {playlistId_releaseId: {playlistId: id, releaseId: m.releaseId}},
            data: {youtubeTargetUrl: generated.targetUrl}
          });
        } catch {
          // Preserve legacy or non-video targets instead of blocking playlist settings updates.
        }
      }
    }

    return {
      playlist: toPlaylistRecord(playlist),
      summary
    };
  });

  return result;
}

export async function archivePlaylist(id: string): Promise<PlaylistRecord> {
  const playlist = await prisma.playlist.update({
    where: { id },
    data: { isArchived: true }
  });
  return toPlaylistRecord(playlist);
}

export async function restorePlaylist(id: string): Promise<PlaylistRecord> {
  const playlist = await prisma.playlist.update({
    where: { id },
    data: { isArchived: false }
  });
  return toPlaylistRecord(playlist);
}

export async function togglePlaylistPublicVisibility(id: string, isPublic: boolean): Promise<PlaylistRecord> {
  const playlist = await prisma.playlist.update({
    where: { id },
    data: { isPublic }
  });
  return toPlaylistRecord(playlist);
}

export async function setPlaylistFeaturedRelease(playlistId: string, releaseId: string | null): Promise<PlaylistRecord> {
  if (releaseId) {
    const isMember = await prisma.playlistRelease.findFirst({
      where: { playlistId, releaseId, isActive: true }
    });
    if (!isMember) {
      throw new Error("Featured release must be an active member of this playlist.");
    }
  }

  const playlist = await prisma.playlist.update({
    where: { id: playlistId },
    data: { featuredReleaseId: releaseId }
  });
  return toPlaylistRecord(playlist);
}

// Transactional memberships sync
export async function syncPlaylistMemberships(
  playlistId: string,
  memberships: Array<{
    releaseId: string;
    position: number;
    spotifyTargetUrl: string;
    spotifyTrackUrl: string;
    spotifyTargetMode: string;
    appleTargetUrl: string;
    youtubeTargetUrl: string;
    isActive: boolean;
  }>
) {
  // Reject duplicates
  const releaseIds = memberships.map((m) => m.releaseId);
  if (new Set(releaseIds).size !== releaseIds.length) {
    throw new Error("Duplicate release memberships are not allowed.");
  }

  const existingMemberships = await prisma.playlistRelease.findMany({
    where: {playlistId}
  });
  const playlistRecord = await prisma.playlist.findUnique({where: {id: playlistId}});
  if (!playlistRecord) {
    throw new Error("Playlist not found.");
  }
  const existingByRelease = new Map(existingMemberships.map((item) => [item.releaseId, item]));

  // Validate new and changed URLs. Unchanged legacy mismatches remain editable elsewhere
  // but continue to appear in paid-readiness diagnostics.
  for (const m of memberships) {
    const finalYouTubeTarget = m.youtubeTargetUrl && playlistRecord.youtubePlaylistUrl
      ? buildYouTubePlaylistContextUrl(m.youtubeTargetUrl, playlistRecord.youtubePlaylistUrl).targetUrl
      : m.youtubeTargetUrl;
    if (m.appleTargetUrl && !validateExternalUrl(m.appleTargetUrl)) {
      throw new Error("Apple track URL must be a valid HTTPS link.");
    }
    if (finalYouTubeTarget && !validateExternalUrl(finalYouTubeTarget)) {
      throw new Error("YouTube track URL must be a valid HTTPS link.");
    }

    if (m.spotifyTargetMode === "generated") {
      if (m.spotifyTrackUrl) {
        try {
          parseSpotifyResourceUrl(m.spotifyTrackUrl, "track");
        } catch (err: any) {
          throw new Error(`Malformed Spotify Track URL: ${err.message}`);
        }
      }
    } else if (m.spotifyTargetMode === "manual") {
      if (m.spotifyTargetUrl) {
        if (!validateExternalUrl(m.spotifyTargetUrl)) {
          throw new Error("Spotify Target URL must be a valid HTTPS link.");
        }
        const existing = existingByRelease.get(m.releaseId);
        if (existing?.spotifyTargetUrl !== m.spotifyTargetUrl) {
          const validation = validatePlaylistDestination("spotify", m.spotifyTargetUrl);
          if (!validation.valid) throw new Error(validation.issue);
        }
      }
    } else {
      throw new Error(`Invalid Spotify Target Mode: ${m.spotifyTargetMode}`);
    }

    const existing = existingByRelease.get(m.releaseId);
    if (m.appleTargetUrl && existing?.appleTargetUrl !== m.appleTargetUrl) {
      const validation = validatePlaylistDestination("apple_music", m.appleTargetUrl);
      if (!validation.valid) throw new Error(validation.issue);
    }
    if (finalYouTubeTarget && existing?.youtubeTargetUrl !== finalYouTubeTarget) {
      const platform = inferPlaylistPlatform(finalYouTubeTarget, "youtube_music");
      const validation = validatePlaylistDestination(platform, finalYouTubeTarget);
      if (!validation.valid) throw new Error(validation.issue);
    }
  }

  return prisma.$transaction(async (tx) => {
    const playlist = await tx.playlist.findUnique({
      where: { id: playlistId }
    });

    if (!playlist) {
      throw new Error("Playlist not found.");
    }

    // Delete existing
    await tx.playlistRelease.deleteMany({
      where: { playlistId }
    });

    // Sort to normalize positions
    const sorted = [...memberships].sort((a, b) => a.position - b.position);

    // Recreate with normalized consecutive positions starting from 0
    const created = await Promise.all(
      sorted.map(async (m, idx) => {
        let finalTargetUrl = m.spotifyTargetUrl.trim();

        if (m.spotifyTargetMode === "generated") {
          if (!m.spotifyTrackUrl || !playlist.spotifyPlaylistUrl) {
            finalTargetUrl = "";
          } else {
            try {
              const res = buildSpotifyPlaylistContextUrl(m.spotifyTrackUrl, playlist.spotifyPlaylistUrl);
              finalTargetUrl = res.targetUrl;
            } catch (err: any) {
              throw new Error(`Failed to generate context link for release: ${err.message}`);
            }
          }
        }

        return tx.playlistRelease.create({
          data: {
            playlistId,
            releaseId: m.releaseId,
            position: idx,
            spotifyTargetUrl: finalTargetUrl,
            spotifyTrackUrl: m.spotifyTrackUrl.trim(),
            spotifyTargetMode: m.spotifyTargetMode,
            appleTargetUrl: m.appleTargetUrl.trim(),
            youtubeTargetUrl: m.youtubeTargetUrl && playlist.youtubePlaylistUrl
              ? buildYouTubePlaylistContextUrl(m.youtubeTargetUrl, playlist.youtubePlaylistUrl).targetUrl
              : m.youtubeTargetUrl.trim(),
            isActive: m.isActive
          }
        });
      })
    );

    // Validate featuredReleaseId
    if (playlist.featuredReleaseId) {
      const activeFeaturedMember = created.find(
        (m) =>
          m.releaseId === playlist.featuredReleaseId &&
          m.isActive &&
          (m.spotifyTargetUrl || m.appleTargetUrl || m.youtubeTargetUrl)
      );

      if (!activeFeaturedMember) {
        await tx.playlist.update({
          where: { id: playlistId },
          data: { featuredReleaseId: null }
        });
      }
    }

    return created;
  });
}

// Scoped release-membership mutations
export async function syncReleasePlaylistMemberships(
  releaseId: string,
  memberships: Array<{
    playlistId: string;
    position: number;
    spotifyTargetUrl: string;
    spotifyTrackUrl: string;
    spotifyTargetMode: string;
    appleTargetUrl: string;
    youtubeTargetUrl: string;
    isActive: boolean;
  }>
) {
  return prisma.$transaction(async (tx) => {
    // Validate URLs and generate Spotify Targets
    for (const m of memberships) {
      if (m.appleTargetUrl && !validateExternalUrl(m.appleTargetUrl)) {
        throw new Error("Apple track URL must be a valid HTTPS link.");
      }
      if (m.youtubeTargetUrl && !validateExternalUrl(m.youtubeTargetUrl)) {
        throw new Error("YouTube track URL must be a valid HTTPS link.");
      }

      const playlist = await tx.playlist.findUnique({
        where: { id: m.playlistId }
      });

      if (!playlist) {
        throw new Error("Playlist not found.");
      }

      if (m.youtubeTargetUrl && playlist.youtubePlaylistUrl) {
        try {
          m.youtubeTargetUrl = buildYouTubePlaylistContextUrl(
            m.youtubeTargetUrl,
            playlist.youtubePlaylistUrl
          ).targetUrl;
        } catch (error) {
          throw new Error(
            `Failed to generate YouTube playlist context link: ${error instanceof Error ? error.message : "Invalid YouTube URL."}`
          );
        }
      }

      if (m.spotifyTargetMode === "generated") {
        if (m.spotifyTrackUrl) {
          try {
            parseSpotifyResourceUrl(m.spotifyTrackUrl, "track");
          } catch (err: any) {
            throw new Error(`Malformed Spotify Track URL: ${err.message}`);
          }
        }

        if (!m.spotifyTrackUrl || !playlist.spotifyPlaylistUrl) {
          m.spotifyTargetUrl = "";
        } else {
          try {
            const res = buildSpotifyPlaylistContextUrl(m.spotifyTrackUrl, playlist.spotifyPlaylistUrl);
            m.spotifyTargetUrl = res.targetUrl;
          } catch (err: any) {
            throw new Error(`Failed to generate context link: ${err.message}`);
          }
        }
      } else if (m.spotifyTargetMode === "manual") {
        if (m.spotifyTargetUrl) {
          if (!validateExternalUrl(m.spotifyTargetUrl)) {
            throw new Error("Spotify Target URL must be a valid HTTPS link.");
          }
        }
      } else {
        throw new Error(`Invalid Spotify Target Mode: ${m.spotifyTargetMode}`);
      }
    }

    // Find all playlists this release was previously in
    const previous = await tx.playlistRelease.findMany({
      where: { releaseId },
      select: { playlistId: true }
    });
    const previousPlaylistIds = previous.map((m) => m.playlistId);

    // Delete memberships for this release only
    await tx.playlistRelease.deleteMany({
      where: { releaseId }
    });

    // Create new memberships
    for (const m of memberships) {
      await tx.playlistRelease.create({
        data: {
          playlistId: m.playlistId,
          releaseId,
          position: m.position,
          spotifyTargetUrl: m.spotifyTargetUrl.trim(),
          spotifyTrackUrl: m.spotifyTrackUrl.trim(),
          spotifyTargetMode: m.spotifyTargetMode,
          appleTargetUrl: m.appleTargetUrl.trim(),
          youtubeTargetUrl: m.youtubeTargetUrl.trim(),
          isActive: m.isActive
        }
      });
    }

    // Collect all affected playlists to normalize positions and check featured status
    const currentPlaylistIds = memberships.map((m) => m.playlistId);
    const affectedPlaylistIds = Array.from(
      new Set([...previousPlaylistIds, ...currentPlaylistIds])
    );

    for (const pId of affectedPlaylistIds) {
      const listMembers = await tx.playlistRelease.findMany({
        where: { playlistId: pId },
        orderBy: { position: "asc" }
      });

      // Write normalized positions
      for (let i = 0; i < listMembers.length; i++) {
        await tx.playlistRelease.update({
          where: {
            playlistId_releaseId: {
              playlistId: pId,
              releaseId: listMembers[i].releaseId
            }
          },
          data: { position: i }
        });
      }

      // Check featuredReleaseId validation
      const playlist = await tx.playlist.findUnique({
        where: { id: pId }
      });

      if (playlist?.featuredReleaseId) {
        const activeFeatured = listMembers.find(
          (m) =>
            m.releaseId === playlist.featuredReleaseId &&
            m.isActive &&
            (m.releaseId === releaseId
              ? memberships.some(
                  (nm) =>
                    nm.playlistId === pId &&
                    nm.isActive &&
                    (nm.spotifyTargetUrl || nm.appleTargetUrl || nm.youtubeTargetUrl)
                )
              : (m.spotifyTargetUrl || m.appleTargetUrl || m.youtubeTargetUrl))
        );

        if (!activeFeatured) {
          await tx.playlist.update({
            where: { id: pId },
            data: { featuredReleaseId: null }
          });
        }
      }
    }
    return affectedPlaylistIds;
  });
}

// Public Resolvers
export async function readPublicPlaylistLanding(playlistSlug: string) {
  const playlist = await prisma.playlist.findFirst({
    where: {
      slug: playlistSlug,
      isPublic: true,
      isArchived: false
    },
    include: {
      releases: {
        where: {
          isActive: true,
          release: {
            isPublished: true
          },
          OR: [
            { spotifyTargetUrl: { not: "" } },
            { appleTargetUrl: { not: "" } },
            { youtubeTargetUrl: { not: "" } }
          ]
        },
        orderBy: {
          position: "asc"
        },
        include: {
          release: true
        }
      },
      featuredRelease: true
    }
  });

  if (!playlist) return null;

  return {
    playlist: toPlaylistRecord(playlist),
    memberships: playlist.releases.map(toPlaylistReleaseRecord)
  };
}

export async function readPublicPlaylistCampaign(playlistSlug: string, releaseSlug: string) {
  const playlist = await prisma.playlist.findFirst({
    where: {
      slug: playlistSlug,
      isPublic: true,
      isArchived: false
    }
  });

  if (!playlist) return null;

  const focusedMembership = await prisma.playlistRelease.findFirst({
    where: {
      playlistId: playlist.id,
      isActive: true,
      release: {
        slug: releaseSlug,
        isPublished: true
      },
      OR: [
        { spotifyTargetUrl: { not: "" } },
        { appleTargetUrl: { not: "" } },
        { youtubeTargetUrl: { not: "" } }
      ]
    },
    include: {
      release: true
    }
  });

  if (!focusedMembership) return null;

  const previewMemberships = await prisma.playlistRelease.findMany({
    where: {
      playlistId: playlist.id,
      isActive: true,
      releaseId: { not: focusedMembership.releaseId },
      release: {
        isPublished: true
      },
      OR: [
        { spotifyTargetUrl: { not: "" } },
        { appleTargetUrl: { not: "" } },
        { youtubeTargetUrl: { not: "" } }
      ]
    },
    orderBy: {
      position: "asc"
    },
    take: 5,
    include: {
      release: true
    }
  });

  return {
    playlist: toPlaylistRecord(playlist),
    focusedMembership: toPlaylistReleaseRecord(focusedMembership),
    previewMemberships: previewMemberships.map(toPlaylistReleaseRecord)
  };
}
