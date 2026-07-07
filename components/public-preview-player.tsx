"use client";

import Link from "next/link";
import {Play, Pause, SkipForward, SkipBack, Sparkles, Volume2, VolumeX} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import type {UpcomingPreviewTrack} from "@/lib/types";

type ReleaseInfo = {
  id: string;
  title: string;
  coverArtPath: string | null;
};

type PublicPreviewPlayerProps = {
  tracks: UpcomingPreviewTrack[];
  releases: ReleaseInfo[];
};

export function PublicPreviewPlayer({tracks: initialTracks, releases}: PublicPreviewPlayerProps) {
  const activeTracks = initialTracks.filter((t) => t.isActive);



  // Shuffle queue state
  const [queue, setQueue] = useState<UpcomingPreviewTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<UpcomingPreviewTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasFiredImpression, setHasFiredImpression] = useState(false);

  // Milestones track list: 25%, 50%, 75%
  const [milestonesFired, setMilestonesFired] = useState({
    25: false,
    50: false,
    75: false
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Session Shuffling / Bag Initialization
  useEffect(() => {
    if (activeTracks.length > 0) {
      const shuffled = [...activeTracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setCurrentTrack(shuffled[0] || null);
    }
  }, [initialTracks]);

  // 2. Analytics Impression Trigger (Fires once per player mount/session)
  useEffect(() => {
    if (!hasFiredImpression && currentTrack) {
      trackEvent("preview_player_impression", {trackId: currentTrack.id});
      setHasFiredImpression(true);
    }
  }, [currentTrack, hasFiredImpression]);

  // Helper to send analytics events
  function trackEvent(eventType: string, extra: Record<string, any> = {}) {
    const payload = {
      eventType,
      pageType: "preview",
      metadata: JSON.stringify({
        trackId: currentTrack?.id,
        title: getTrackTitle(),
        url: currentTrack?.audioUrl,
        ...extra
      })
    };

    fetch("/api/analytics/track", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    }).catch((err) => console.error("Failed to track preview event:", err));
  }

  // Derive metadata from linked release or fallbacks
  function getTrackTitle() {
    if (!currentTrack) return "No track selected";
    if (currentTrack.releaseId) {
      const rel = releases.find((r) => r.id === currentTrack.releaseId);
      return currentTrack.titleOverride || rel?.title || "Untitled Preview";
    }
    return currentTrack.titleOverride || "Untitled Preview";
  }

  function getTrackArtwork() {
    if (!currentTrack) return "/placeholder-artwork.png";
    if (currentTrack.releaseId) {
      const rel = releases.find((r) => r.id === currentTrack.releaseId);
      return currentTrack.artworkUrlOverride || rel?.coverArtPath || "/placeholder-artwork.png";
    }
    return currentTrack.artworkUrlOverride || "/placeholder-artwork.png";
  }

  // Audio lifecycle hook
  useEffect(() => {
    if (!currentTrack) return;

    // Reset audio and state
    const audio = new Audio(currentTrack.audioUrl);
    audioRef.current = audio;

    audio.muted = isMuted;
    setCurrentTime(0);
    setDuration(0);
    setMilestonesFired({25: false, 50: false, 75: false});

    // Event listeners
    const onTimeUpdate = () => {
      const time = audio.currentTime;
      const dur = audio.duration || 0;
      setCurrentTime(time);

      if (dur > 0) {
        const pct = (time / dur) * 100;
        // Check milestones
        const newMilestones = {...milestonesFired};
        let updated = false;

        if (pct >= 25 && !milestonesFired[25]) {
          newMilestones[25] = true;
          updated = true;
          trackEvent("preview_milestone", {percent: 25});
        }
        if (pct >= 50 && !milestonesFired[50]) {
          newMilestones[50] = true;
          updated = true;
          trackEvent("preview_milestone", {percent: 50});
        }
        if (pct >= 75 && !milestonesFired[75]) {
          newMilestones[75] = true;
          updated = true;
          trackEvent("preview_milestone", {percent: 75});
        }

        if (updated) {
          setMilestonesFired(newMilestones);
        }
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      trackEvent("preview_complete");
      handleNext();
    };

    const onError = () => {
      trackEvent("preview_error", {error: "Audio playback failure"});
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Audio playback error on track change:", err);
        setIsPlaying(false);
      });
    }

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [currentTrack]);

  // Handle play/pause toggles
  function togglePlay() {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      trackEvent("preview_pause");
    } else {
      audioRef.current.play().catch((err) => console.error("Audio playback error:", err));
      setIsPlaying(true);
      trackEvent("preview_play");
    }
  }

  // Shuffle Bag rotation: Play next track
  function handleNext() {
    if (activeTracks.length <= 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.error(err));
        setIsPlaying(true);
        trackEvent("preview_next");
      }
      return;
    }

    // Find current index in queue
    const currIdx = queue.findIndex((t) => t.id === currentTrack?.id);
    let nextIdx = currIdx + 1;

    let newQueue = [...queue];
    if (nextIdx >= queue.length) {
      // Reshuffle the bag to prevent back-to-back repetitions
      const lastTrack = queue[queue.length - 1];
      let shuffled = [...activeTracks].sort(() => Math.random() - 0.5);
      
      // Ensure the new first track isn't the same as the last track
      if (shuffled[0]?.id === lastTrack?.id && activeTracks.length > 1) {
        shuffled.push(shuffled.shift()!);
      }
      
      newQueue = shuffled;
      nextIdx = 0;
    }

    setQueue(newQueue);
    setCurrentTrack(newQueue[nextIdx] || null);
    setIsPlaying(true);
    trackEvent("preview_next");
  }

  // Play previous track
  function handlePrev() {
    if (activeTracks.length <= 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setIsPlaying(true);
        trackEvent("preview_previous");
      }
      return;
    }

    const currIdx = queue.findIndex((t) => t.id === currentTrack?.id);
    let prevIdx = currIdx - 1;

    if (prevIdx < 0) {
      prevIdx = queue.length - 1;
    }

    setCurrentTrack(queue[prevIdx] || null);
    setIsPlaying(true);
    trackEvent("preview_previous");
  }

  // Mute toggle
  function toggleMute() {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  }

  // Seeking progress bar handler
  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || duration === 0 || !progressContainerRef.current) return;

    const rect = progressContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }

  // Format time helpers
  function formatTime(seconds: number) {
    if (Number.isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  if (activeTracks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 md:px-8">
      <div className="mx-auto max-w-[960px] rounded-3xl border border-white/10 bg-[#0f1217]/86 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300">
        
        {/* Progress seeking track */}
        <div 
          ref={progressContainerRef}
          className="group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-t-3xl bg-white/10"
          onClick={handleProgressClick}
        >
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#c9a347] to-[#e6c167] transition-all duration-75"
            style={{width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`}}
          />
          <div className="absolute top-0 h-full w-1 bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
          {/* Track Details */}
          <div className="flex items-center gap-4 min-w-0 sm:flex-1">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md">
              <img
                alt="Track art"
                className="h-full w-full object-cover"
                src={getTrackArtwork()}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d2af5a]">
                Upcoming Preview
              </p>
              <h5 className="truncate text-sm font-semibold tracking-tight text-[#f7f1e6]">
                {getTrackTitle()}
              </h5>
            </div>
          </div>

          {/* Player controls */}
          <div className="flex items-center justify-center gap-5 sm:flex-initial">
            <button
              className="p-2 text-[#a1a7b0] transition hover:text-[#f7f1e6]"
              onClick={handlePrev}
              title="Previous"
              type="button"
            >
              <SkipBack size={18} />
            </button>

            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c9a347]/30 bg-[#c9a347]/10 text-[#f2dfb0] transition hover:border-[#c9a347]/50 hover:bg-[#c9a347]/20"
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              type="button"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play className="ml-0.5" size={18} fill="currentColor" />}
            </button>

            <button
              className="p-2 text-[#a1a7b0] transition hover:text-[#f7f1e6]"
              onClick={handleNext}
              title="Next"
              type="button"
            >
              <SkipForward size={18} />
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <span className="text-[10px] font-medium tabular-nums text-[#7c838c]">
                {formatTime(currentTime)}
              </span>
              <span className="text-[10px] font-medium text-[#545962]">/</span>
              <span className="text-[10px] font-medium tabular-nums text-[#7c838c]">
                {formatTime(duration)}
              </span>
            </div>

            <button
              className="p-2 text-[#a1a7b0] transition hover:text-[#f7f1e6]"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              type="button"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* Exclusives CTA */}
          <div className="flex sm:flex-initial">
            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c9a347] to-[#e6c167] px-5 py-2.5 text-xs font-bold text-[#13161a] shadow-lg shadow-[#c9a347]/12 transition duration-300 hover:scale-[1.02] hover:shadow-[#c9a347]/20 active:scale-[0.98] sm:w-auto"
              href="/exclusives"
              onClick={() => trackEvent("preview_exclusives_cta")}
            >
              <Sparkles size={13} fill="currentColor" />
              Get Full Unreleased Songs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
