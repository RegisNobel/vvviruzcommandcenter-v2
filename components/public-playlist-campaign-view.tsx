"use client";

import {useEffect} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Disc,
  Play,
  Plus,
  ChevronRight
} from "lucide-react";
import type {
  PlaylistRecord,
  PlaylistReleaseRecord,
  SiteSettingsRecord
} from "@/lib/types";
import {formatCollaboratorsList} from "@/lib/public-utils";

function getUtmParams() {
  if (typeof window === "undefined") {
    return {
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmContent: "",
      utmTerm: ""
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || ""
  };
}

function trackEvent(playlistSlug: string, releaseId: string, payload: Record<string, any>) {
  const utm = getUtmParams();
  const body = JSON.stringify({
    page: "playlist",
    path: `${window.location.pathname}${window.location.search}`,
    hubPath: `/listen/${playlistSlug}`,
    releaseId,
    ...utm,
    ...payload
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", new Blob([body], {type: "application/json"}));
    return;
  }

  void fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  });
}

function resolvePrimaryTrackTarget(
  membership: PlaylistReleaseRecord,
  preferredPlatform: string
) {
  const spotify = membership.spotifyTargetUrl?.trim() || "";
  const apple = membership.appleTargetUrl?.trim() || "";
  const youtube = membership.youtubeTargetUrl?.trim() || "";

  const platformLower = preferredPlatform.toLowerCase();
  if (platformLower === "spotify" && spotify) {
    return { platform: "spotify", url: spotify, label: "Spotify" };
  }
  if (platformLower === "apple" && apple) {
    return { platform: "apple", url: apple, label: "Apple Music" };
  }
  if (platformLower === "youtube" && youtube) {
    return { platform: "youtube", url: youtube, label: "YouTube Music" };
  }

  // Fallbacks in priority order
  if (spotify) return { platform: "spotify", url: spotify, label: "Spotify" };
  if (apple) return { platform: "apple", url: apple, label: "Apple Music" };
  if (youtube) return { platform: "youtube", url: youtube, label: "YouTube Music" };

  return null;
}

function getSecondaryTrackTargets(
  membership: PlaylistReleaseRecord,
  primaryPlatform: string
) {
  const targets = [];
  const spotify = membership.spotifyTargetUrl?.trim() || "";
  const apple = membership.appleTargetUrl?.trim() || "";
  const youtube = membership.youtubeTargetUrl?.trim() || "";

  if (primaryPlatform !== "spotify" && spotify) {
    targets.push({ platform: "spotify", url: spotify, label: "Spotify" });
  }
  if (primaryPlatform !== "apple" && apple) {
    targets.push({ platform: "apple", url: apple, label: "Apple Music" });
  }
  if (primaryPlatform !== "youtube" && youtube) {
    targets.push({ platform: "youtube", url: youtube, label: "YouTube Music" });
  }

  return targets;
}

export function PublicPlaylistCampaignView({
  playlist,
  focusedMembership,
  previewMemberships,
  siteSettings
}: {
  playlist: PlaylistRecord;
  focusedMembership: PlaylistReleaseRecord;
  previewMemberships: PlaylistReleaseRecord[];
  siteSettings: SiteSettingsRecord;
}) {
  // Log page view on mount
  useEffect(() => {
    trackEvent(playlist.slug, focusedMembership.releaseId, {
      eventType: "playlist_page_view"
    });
  }, [playlist.slug, focusedMembership.releaseId]);

  // Track click handler
  const handleTrackClick = (platform: string, targetUrl: string) => {
    trackEvent(playlist.slug, focusedMembership.releaseId, {
      eventType: "playlist_track_click",
      linkType: "track",
      linkLabel: platform,
      targetUrl
    });
  };

  // Follow click handler
  const handleFollowClick = (platform: string, playlistUrl: string) => {
    trackEvent(playlist.slug, focusedMembership.releaseId, {
      eventType: "playlist_follow_click",
      linkType: "playlist",
      linkLabel: platform,
      targetUrl: playlistUrl
    });
  };

  // Resolve platform buttons
  const primaryTarget = resolvePrimaryTrackTarget(focusedMembership, playlist.primaryPlatform);
  const secondaryTargets = primaryTarget
    ? getSecondaryTrackTargets(focusedMembership, primaryTarget.platform)
    : [];

  const artistDisplay = focusedMembership.release_collaborator
    ? `${siteSettings.artist_name} feat. ${formatCollaboratorsList(focusedMembership.release_collaborator_name)}`
    : siteSettings.artist_name;

  return (
    <main className="public-conversion-shell min-h-screen pb-24 text-[#ebe5d9]">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-[#c9a347]/10 via-[#c9a347]/0 to-transparent blur-[120px]" />

      <div className="relative mx-auto max-w-[540px] space-y-10 pt-4 sm:pt-8">
        
        {/* 1. Focused Release Hero */}
        <section className="text-center space-y-6">
          {/* Playlist Context Pill */}
          <div className="public-eyebrow inline-flex rounded-full border border-[#c9a347]/20 bg-[#c9a347]/5 px-3.5 py-1 text-[#d8b864] shadow-sm">
            Part of {playlist.name}
          </div>

          {/* Artwork Container */}
          <div className="public-art-stage relative mx-auto aspect-square w-[320px] overflow-hidden sm:w-[360px]">
            {focusedMembership.release_cover_art_path ? (
              <Image
                alt={`${focusedMembership.release_title} Cover Art`}
                className="object-cover transition-transform duration-700 hover:scale-105"
                fill
                priority
                src={focusedMembership.release_cover_art_path}
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#171a21]">
                <Disc className="animate-spin text-muted" size={48} />
              </div>
            )}
          </div>

          {/* Text block */}
          <div className="space-y-2 px-2">
            <h1
              className="mx-auto max-w-full truncate whitespace-nowrap text-3xl font-bold tracking-tight text-[#f3ede2]"
              title={`${artistDisplay} - ${focusedMembership.release_title}`}
            >
              {artistDisplay} - {focusedMembership.release_title}
            </h1>
            {focusedMembership.release_public_description && (
              <p className="mt-3 text-sm leading-6 text-[#9ca2ad] max-w-sm mx-auto">
                {focusedMembership.release_public_description}
              </p>
            )}
          </div>
        </section>

        {/* 2. Primary Track CTA */}
        {primaryTarget && (
          <section className="px-2">
            <a
              className="public-action-primary group flex w-full gap-3 py-4 shadow-[0_0_40px_rgba(201,163,71,0.18)]"
              href={primaryTarget.url}
              onClick={() => handleTrackClick(primaryTarget.platform, primaryTarget.url)}
              target="_blank"
            >
              <Play className="fill-current text-[#090b0e]" size={16} />
              <span className="text-center leading-none">
                Listen to {focusedMembership.release_title} on {primaryTarget.label}
              </span>
            </a>
          </section>
        )}

        {/* 3. Secondary Track Platform Links */}
        {secondaryTargets.length > 0 && (
          <section className="text-center text-xs text-[#969ca5] font-semibold tracking-wide space-x-1">
            {secondaryTargets.map((target, idx) => (
              <span key={target.platform}>
                <a
                  className="hover:text-[#ebe5d9] transition px-1"
                  href={target.url}
                  onClick={() => handleTrackClick(target.platform, target.url)}
                  target="_blank"
                >
                  {target.label}
                </a>
                {idx < secondaryTargets.length - 1 && <span className="opacity-40">·</span>}
              </span>
            ))}
          </section>
        )}

        {/* 4. Compact Playlist Preview */}
        {previewMemberships.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#868c96] px-1">
              Up Next on Playlist
            </h3>

            <div className="public-form-surface divide-y divide-white/5 overflow-hidden">
              {previewMemberships.map((m) => {
                const previewArtist = m.release_collaborator
                  ? `${siteSettings.artist_name} feat. ${formatCollaboratorsList(m.release_collaborator_name)}`
                  : siteSettings.artist_name;

                return (
                  <Link
                    className="group flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors"
                    href={`/listen/${playlist.slug}/${m.release_slug}`}
                    key={m.releaseId}
                  >
                    <div className="relative h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/5">
                      {m.release_cover_art_path ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          src={m.release_cover_art_path}
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          <Disc size={16} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4
                        className="truncate text-sm font-bold text-[#f3ede2] transition group-hover:text-[#c9a347]"
                        title={`${previewArtist} - ${m.release_title}`}
                      >
                        {previewArtist} - {m.release_title}
                      </h4>
                      <p className="text-[11px] text-[#8b919b]">Up next</p>
                    </div>

                    <ChevronRight className="text-[#565b63] group-hover:text-[#ebe5d9] group-hover:translate-x-0.5 transition" size={16} />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Playlist Follow CTA */}
        {(playlist.spotifyPlaylistUrl || playlist.applePlaylistUrl || playlist.youtubePlaylistUrl) && (
          <section className="public-form-surface space-y-4 p-6">
            <div className="text-center">
              <h3 className="text-sm font-bold text-[#f3ede2]">Grow the Asset</h3>
              <p className="text-[11px] text-[#8b919b] mt-1">
                Save the playlist to your library for offline listening & updates.
              </p>
            </div>

            <div className="grid gap-2">
              {playlist.spotifyPlaylistUrl && (
                <a
                  className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100 hover:border-emerald-500/40 transition"
                  href={playlist.spotifyPlaylistUrl}
                  onClick={() => handleFollowClick("spotify", playlist.spotifyPlaylistUrl)}
                  target="_blank"
                >
                  <span>Follow Playlist on Spotify</span>
                  <Plus size={14} />
                </a>
              )}

              {playlist.applePlaylistUrl && (
                <a
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-4 py-3 text-xs font-semibold text-[#f3ede2] hover:border-white/20 transition"
                  href={playlist.applePlaylistUrl}
                  onClick={() => handleFollowClick("apple", playlist.applePlaylistUrl)}
                  target="_blank"
                >
                  <span>Follow Playlist on Apple Music</span>
                  <Plus size={14} />
                </a>
              )}

              {playlist.youtubePlaylistUrl && (
                <a
                  className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-100 hover:border-rose-500/40 transition"
                  href={playlist.youtubePlaylistUrl}
                  onClick={() => handleFollowClick("youtube", playlist.youtubePlaylistUrl)}
                  target="_blank"
                >
                  <span>Follow Playlist on YouTube Music</span>
                  <Plus size={14} />
                </a>
              )}
            </div>
          </section>
        )}

        {/* 6. Minimal Footer */}
        <footer className="text-center pt-8 text-[10px] text-[#5c616b] font-medium tracking-wider space-y-1.5">
          <p>© {new Date().getFullYear()} {siteSettings.artist_name}. All rights reserved.</p>
          <p className="opacity-75">POWERED BY COMMAND CENTER</p>
        </footer>

      </div>
    </main>
  );
}
