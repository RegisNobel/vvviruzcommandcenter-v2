"use client";

import {useEffect, useRef} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Disc,
  Play,
  ChevronRight
} from "lucide-react";
import type {
  PlaylistRecord,
  PlaylistReleaseRecord,
  SiteSettingsRecord
} from "@/lib/types";
import {formatCollaboratorsList} from "@/lib/public-utils";
import {normalizePlaylistPlatform, withApprovedAttribution} from "@/lib/playlist-analytics";

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

function createEventId(prefix: string) {
  const randomId = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}.${Date.now()}.${randomId}`;
}

function withInternalNavigationMarker(path: string, attributionQuery: string) {
  const attributed = withApprovedAttribution(path, new URLSearchParams(attributionQuery));
  return `${attributed}${attributed.includes("?") ? "&" : "?"}vcc_nav=internal`;
}

function getOriginalReferrer(playlistId: string) {
  try {
    const key = `vcc_playlist_referrer_${playlistId}`;
    const saved = window.sessionStorage.getItem(key);
    if (saved !== null) return saved;
    const referrer = document.referrer && new URL(document.referrer).origin !== window.location.origin
      ? document.referrer
      : "";
    window.sessionStorage.setItem(key, referrer);
    return referrer;
  } catch {
    return "";
  }
}

function trackMetaPixel(
  method: "track" | "trackCustom",
  eventName: string,
  params: Record<string, string | string[]>,
  eventId: string,
  attempt = 0
) {
  if (typeof window.fbq !== "function") {
    if (attempt < 10) {
      window.setTimeout(
        () => trackMetaPixel(method, eventName, params, eventId, attempt + 1),
        250
      );
    }
    return;
  }
  window.fbq(method, eventName, params, {eventID: eventId});
}

function trackEvent(
  playlistId: string,
  playlistSlug: string,
  releaseId: string,
  eventId: string,
  payload: Record<string, unknown>
) {
  const utm = getUtmParams();
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    eventId,
    page: "playlist",
    path: `${window.location.pathname}${window.location.search}`,
    hubPath: `/listen/${playlistSlug}`,
    playlistId,
    playlistSlug,
    releaseId,
    originalReferrer: getOriginalReferrer(playlistId),
    fbclid: params.get("fbclid") || "",
    shortLinkContext: params.get("sl_ctx") || "",
    ...utm,
    ...payload
  });

  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon(
      "/api/analytics/track",
      new Blob([body], {type: "application/json"})
    );
    if (queued) return;
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
    return { platform: "apple_music", url: apple, label: "Apple Music" };
  }
  if (platformLower === "youtube" && youtube) {
    return { platform: "youtube_music", url: youtube, label: "YouTube Music" };
  }

  // Fallbacks in priority order
  if (spotify) return { platform: "spotify", url: spotify, label: "Spotify" };
  if (apple) return { platform: "apple_music", url: apple, label: "Apple Music" };
  if (youtube) return { platform: "youtube_music", url: youtube, label: "YouTube Music" };

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
  if (primaryPlatform !== "apple_music" && apple) {
    targets.push({ platform: "apple_music", url: apple, label: "Apple Music" });
  }
  if (primaryPlatform !== "youtube_music" && youtube) {
    targets.push({ platform: "youtube_music", url: youtube, label: "YouTube Music" });
  }

  return targets;
}

export function PublicPlaylistCampaignView({
  playlist,
  focusedMembership,
  previewMemberships,
  siteSettings,
  attributionQuery
}: {
  playlist: PlaylistRecord;
  focusedMembership: PlaylistReleaseRecord;
  previewMemberships: PlaylistReleaseRecord[];
  siteSettings: SiteSettingsRecord;
  attributionQuery: string;
}) {
  const pageViewEventId = useRef<string | null>(null);
  if (!pageViewEventId.current && typeof window !== "undefined") {
    pageViewEventId.current = createEventId("playlist-view-content");
  }

  // Log page view on mount
  useEffect(() => {
    const eventId = pageViewEventId.current || createEventId("playlist-view-content");
    const utm = getUtmParams();
    trackEvent(playlist.id, playlist.slug, focusedMembership.releaseId, eventId, {
      eventType: "playlist_page_view",
      entryType: new URLSearchParams(window.location.search).get("vcc_nav") === "internal"
        ? "internal_navigation"
        : undefined,
      metaEventName: "ViewContent"
    });
    trackMetaPixel("track", "ViewContent", {
      content_ids: [focusedMembership.releaseId],
      content_name: focusedMembership.release_title || "Playlist release",
      content_type: "music_release",
      page: "playlist",
      playlist_id: playlist.id,
      playlist_slug: playlist.slug,
      utm_source: utm.utmSource,
      utm_medium: utm.utmMedium,
      utm_campaign: utm.utmCampaign,
      utm_content: utm.utmContent,
      utm_term: utm.utmTerm
    }, eventId);
  }, [playlist.id, playlist.slug, focusedMembership.releaseId, focusedMembership.release_title]);

  // Track click handler
  const handleTrackClick = (platform: string, targetUrl: string) => {
    const normalizedPlatform = normalizePlaylistPlatform(platform);
    const eventId = createEventId("playlist-streaming-click");
    trackEvent(playlist.id, playlist.slug, focusedMembership.releaseId, eventId, {
      eventType: "playlist_track_click",
      linkType: normalizedPlatform,
      linkLabel: normalizedPlatform,
      platform: normalizedPlatform,
      targetUrl,
      metaEventName: "StreamingOutboundClick"
    });
    trackMetaPixel("trackCustom", "StreamingOutboundClick", {
      content_category: "streaming_outbound_click",
      content_ids: [focusedMembership.releaseId],
      content_name: focusedMembership.release_title || "Playlist release",
      content_type: "music_release",
      page: "playlist",
      playlist_id: playlist.id,
      playlist_slug: playlist.slug,
      platform: normalizedPlatform
    }, eventId);
  };

  // Resolve platform buttons
  const primaryTarget = resolvePrimaryTrackTarget(focusedMembership, playlist.primaryPlatform);
  const secondaryTargets = primaryTarget
    ? getSecondaryTrackTargets(focusedMembership, primaryTarget.platform)
    : [];
  const youtubeTarget = primaryTarget?.platform === "youtube_music"
    ? primaryTarget
    : secondaryTargets.find((target) => target.platform === "youtube_music");
  const textTargets = secondaryTargets.filter((target) => target.platform !== "youtube_music");

  const artistDisplay = focusedMembership.release_collaborator
    ? `${siteSettings.artist_name} feat. ${formatCollaboratorsList(focusedMembership.release_collaborator_name)}`
    : siteSettings.artist_name;
  const coverArtPath = focusedMembership.release_cover_art_path?.trim() || "";
  const hasCoverArt = Boolean(coverArtPath);

  return (
    <main className="public-conversion-shell min-h-screen pb-24 text-[#ebe5d9]">
      {hasCoverArt ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 scale-[1.08] opacity-70">
            <Image
              alt=""
              className="object-cover object-center blur-[42px]"
              fill
              sizes="360px"
              src={coverArtPath}
              unoptimized
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.52),rgba(7,9,13,0.92)_38%,rgba(7,9,13,0.99))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(246,201,69,0.1),transparent_38%)]" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(246,201,69,0.14),transparent_35%),linear-gradient(180deg,rgba(7,9,13,0.88),rgba(7,9,13,1))]"
        />
      )}

      <div className="relative mx-auto max-w-[540px] space-y-10 pt-4 sm:pt-8">
        
        {/* 1. Focused Release Hero */}
        <section className="text-center space-y-6">
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
              className="mx-auto max-w-full text-balance break-words text-2xl font-bold leading-tight tracking-tight text-[#f3ede2] sm:text-3xl"
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
        {(primaryTarget || youtubeTarget) && (
          <section className="space-y-3 px-2">
            {primaryTarget && primaryTarget.platform !== "youtube_music" && (
              <a
                className="public-action-primary group flex w-full gap-3 py-4 shadow-[0_0_40px_rgba(201,163,71,0.18)]"
                href={primaryTarget.url}
                onClick={() => handleTrackClick(primaryTarget.platform, primaryTarget.url)}
                rel="noreferrer"
                target="_blank"
              >
                <Play className="fill-current text-[#090b0e]" size={16} />
                <span className="text-center leading-none">
                  Listen to {focusedMembership.release_title} on {primaryTarget.label}
                </span>
              </a>
            )}
            {youtubeTarget && (
              <a
                className="group flex w-full items-center justify-center gap-3 rounded-md border border-[#ff3855] bg-[#e11d2e] px-5 py-4 text-sm font-semibold text-white shadow-[0_0_34px_rgba(225,29,46,0.2)] transition hover:border-[#ff5a6e] hover:bg-[#f02a3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6678]/70"
                href={youtubeTarget.url}
                onClick={() => handleTrackClick(youtubeTarget.platform, youtubeTarget.url)}
                rel="noreferrer"
                target="_blank"
              >
                <Play className="fill-current" size={16} />
                <span className="text-center leading-none">
                  Watch {focusedMembership.release_title} on YouTube
                </span>
              </a>
            )}
          </section>
        )}

        {/* 3. Secondary Track Platform Links */}
        {textTargets.length > 0 && (
          <section className="text-center text-xs text-[#969ca5] font-semibold tracking-wide space-x-1">
            {textTargets.map((target, idx) => (
              <span key={target.platform}>
                <a
                  className="hover:text-[#ebe5d9] transition px-1"
                  href={target.url}
                  onClick={() => handleTrackClick(target.platform, target.url)}
                  target="_blank"
                >
                  {target.label}
                </a>
                {idx < textTargets.length - 1 && <span className="opacity-40"> / </span>}
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
                href={withInternalNavigationMarker(
                  `/listen/${playlist.slug}/${m.release_slug}`,
                  attributionQuery
                )}
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
                        className="break-words text-sm font-bold leading-5 text-[#f3ede2] transition group-hover:text-[#c9a347]"
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

      </div>
    </main>
  );
}
