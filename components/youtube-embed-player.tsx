"use client";

import { useEffect, useRef } from "react";

type YouTubeEmbedPlayerProps = {
  playlistId: string;
  embedUrl: string;
};

export function YouTubeEmbedPlayer({ playlistId, embedUrl }: YouTubeEmbedPlayerProps) {
  const playerRef = useRef<any>(null);
  const currentVideoIdRef = useRef<string>("");
  const trackerRef = useRef<boolean>(false);

  useEffect(() => {
    if (trackerRef.current) return;
    trackerRef.current = true;

    // Track initial iframe impression
    trackEvent("exclusive_embed_impression", { playlistId });

    // Load the IFrame Player API if not loaded
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const extractVideoId = (url: string): string => {
      try {
        const parsed = new URL(url);
        if (parsed.searchParams.has("v")) {
          return parsed.searchParams.get("v") || "";
        }
        const paths = parsed.pathname.split("/");
        const embedIdx = paths.indexOf("embed");
        if (embedIdx !== -1 && paths[embedIdx + 1]) {
          return paths[embedIdx + 1];
        }
        const vIdx = paths.indexOf("v");
        if (vIdx !== -1 && paths[vIdx + 1]) {
          return paths[vIdx + 1];
        }
        if (parsed.hostname === "youtu.be" && paths[1]) {
          return paths[1];
        }
      } catch {}
      return "";
    };

    const handlePlayerStateChange = (event: any) => {
      const state = event.data;
      const player = event.target;
      let videoId = "";
      try {
        videoId = extractVideoId(player.getVideoUrl());
      } catch {}

      // Playback States:
      // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
      if (state === 1) { // Playing
        if (videoId && videoId !== currentVideoIdRef.current) {
          // If the video ID has changed from our previous tracked ID, fire a video change event
          if (currentVideoIdRef.current !== "") {
            trackEvent("exclusive_youtube_video_change", { playlistId, videoId });
          }
          currentVideoIdRef.current = videoId;
        }
        trackEvent("exclusive_youtube_play", { playlistId, videoId });
      } else if (state === 2) { // Paused
        trackEvent("exclusive_youtube_pause", { playlistId, videoId });
      } else if (state === 0) { // Completed / Ended
        trackEvent("exclusive_youtube_complete", { playlistId, videoId });
      }
    };

    const handlePlayerError = (event: any) => {
      trackEvent("exclusive_youtube_error", { playlistId, errorCode: String(event.data) });
    };

    // Callback when API is ready
    const initPlayer = () => {
      playerRef.current = new (window as any).YT.Player("youtube-player-iframe", {
        events: {
          onStateChange: handlePlayerStateChange,
          onError: handlePlayerError
        }
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      // Define global callback or poll
      const previousCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (previousCallback) {
          try { previousCallback(); } catch {}
        }
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
      }
    };
  }, [playlistId]);

  function trackEvent(eventType: string, extra: Record<string, any> = {}) {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        page: "preview",
        ...extra
      })
    }).catch(err => console.error("Failed to track youtube analytic event:", err));
  }

  // Append enablejsapi parameter to control player and capture events
  const embedSrc = `${embedUrl}&enablejsapi=1`;

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-black/40 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/5 bg-neutral-950">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
          id="youtube-player-iframe"
          src={embedSrc}
          title="Upcoming Music Exclusives"
        />
      </div>
    </div>
  );
}
