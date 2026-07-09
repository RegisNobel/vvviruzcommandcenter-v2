"use client";

import {useState, useEffect} from "react";
import {Copy, Check, ExternalLink, RefreshCw} from "lucide-react";
import {parseSpotifyResourceUrl} from "@/lib/spotify-links";

export type SpotifyTargetStatus =
  | "generated"
  | "manual"
  | "missing_playlist_url"
  | "missing_track_url"
  | "invalid_playlist_url"
  | "invalid_track_url"
  | "generation_failed";

interface SpotifyMembershipControlsProps {
  trackUrl: string;
  targetMode: string;
  targetUrl: string;
  playlistUrl: string;
  isRegenerating?: boolean;
  onChange: (updates: {
    spotifyTrackUrl?: string;
    spotifyTargetMode?: string;
    spotifyTargetUrl?: string;
  }) => void;
  onRegenerate?: () => void;
}

export function SpotifyMembershipControls({
  trackUrl,
  targetMode,
  targetUrl,
  playlistUrl,
  isRegenerating = false,
  onChange,
  onRegenerate
}: SpotifyMembershipControlsProps) {
  const [copied, setCopied] = useState(false);

  // Determine status cleanly without inferring from display strings
  let status: SpotifyTargetStatus = "generated";
  if (targetMode === "manual") {
    status = "manual";
  } else {
    if (!playlistUrl) {
      status = "missing_playlist_url";
    } else if (!trackUrl) {
      status = "missing_track_url";
    } else {
      let playlistValid = false;
      let trackValid = false;

      try {
        parseSpotifyResourceUrl(playlistUrl, "playlist");
        playlistValid = true;
      } catch {
        status = "invalid_playlist_url";
      }

      if (playlistValid) {
        try {
          parseSpotifyResourceUrl(trackUrl, "track");
          trackValid = true;
        } catch {
          status = "invalid_track_url";
        }
      }

      if (playlistValid && trackValid) {
        if (!targetUrl) {
          status = "generation_failed";
        } else {
          status = "generated";
        }
      }
    }
  }

  const handleCopy = async (val: string) => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "generated":
        return (
          <span className="status-badge-ready px-2 py-0.5 text-[10px]">
            Generated Context Link
          </span>
        );
      case "manual":
        return (
          <span className="status-badge-warning px-2 py-0.5 text-[10px]">
            Manual Spotify Target
          </span>
        );
      case "missing_playlist_url":
        return (
          <span className="status-badge-danger px-2 py-0.5 text-[10px]">
            Missing Playlist URL
          </span>
        );
      case "missing_track_url":
        return (
          <span className="status-badge-neutral px-2 py-0.5 text-[10px]">
            Missing Track URL
          </span>
        );
      case "invalid_playlist_url":
        return (
          <span className="status-badge-danger px-2 py-0.5 text-[10px]">
            Invalid Playlist URL
          </span>
        );
      case "invalid_track_url":
        return (
          <span className="status-badge-danger px-2 py-0.5 text-[10px]">
            Invalid Track URL
          </span>
        );
      case "generation_failed":
        return (
          <span className="status-badge-danger px-2 py-0.5 text-[10px]">
            Generation Failed
          </span>
        );
    }
  };

  return (
    <div className="inset-surface space-y-4 p-4">
      {/* Mode selection & status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-ink uppercase tracking-wide">Spotify Mode</label>
          <select
            className="rounded-md border border-edge bg-input px-2.5 py-1 text-xs font-semibold text-ink outline-none focus:border-[rgba(246,201,69,0.58)]"
            value={targetMode}
            onChange={(e) => {
              const newMode = e.target.value;
              onChange({
                spotifyTargetMode: newMode,
                // When switching generated -> manual, targetUrl is preserved as initial value
                spotifyTargetUrl: newMode === "manual" ? targetUrl : undefined
              });
            }}
          >
            <option value="generated">Generated Context Link</option>
            <option value="manual">Manual Target URL</option>
          </select>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Target Mode Inputs */}
      {targetMode === "generated" ? (
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-muted">Spotify Track URL</label>
            <input
              type="text"
              className="field-input mt-1.5 w-full font-mono text-xs"
              placeholder="https://open.spotify.com/track/..."
              value={trackUrl}
              onChange={(e) => onChange({ spotifyTrackUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted">Generated Spotify Target Link</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                readOnly
                className="field-input w-full font-mono text-xs bg-black/20 text-muted opacity-80"
                placeholder="Target URL will be computed by server..."
                value={targetUrl}
              />
              <button
                type="button"
                disabled={!targetUrl}
                onClick={() => handleCopy(targetUrl)}
                className="rounded-md border border-edge bg-surface-elevated px-3 text-xs text-ink transition hover:bg-surface-hover disabled:opacity-50"
                title="Copy Direct Spotify Context Link"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              {targetUrl && (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-md border border-edge bg-surface-elevated px-3 text-ink transition hover:bg-surface-hover"
                  title="Test Spotify Context Link"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {onRegenerate && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={isRegenerating || !trackUrl || !playlistUrl}
                onClick={onRegenerate}
                className="action-button-secondary gap-1.5 border-[rgba(246,201,69,0.3)] bg-[var(--brand-primary-soft)] px-3 py-1.5 text-xs text-brand-primary hover:bg-[rgba(246,201,69,0.18)] disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRegenerating ? "animate-spin" : ""} />
                {isRegenerating ? "Regenerating..." : "Regenerate Link"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-muted">Spotify Target URL (Manual)</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                className="field-input w-full font-mono text-xs"
                placeholder="https://open.spotify.com/track/... or any HTTPS target"
                value={targetUrl}
                onChange={(e) => onChange({ spotifyTargetUrl: e.target.value })}
              />
              <button
                type="button"
                disabled={!targetUrl}
                onClick={() => handleCopy(targetUrl)}
                className="rounded-md border border-edge bg-surface-elevated px-3 text-xs text-ink transition hover:bg-surface-hover disabled:opacity-50"
                title="Copy Spotify Target"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              {targetUrl && (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded border border-[#30343b] bg-[#15181c] px-3 text-ink transition hover:border-[#545962] hover:bg-[#1b1f24]"
                  title="Test Spotify Target"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Helper text */}
      <p className="text-[10px] leading-relaxed text-muted bg-[#121519]/50 p-2.5 rounded border border-white/5 mt-2">
        Generated context links open the selected track with this playlist supplied as its Spotify playback context. The playlist context is optimized for mobile Spotify traffic. On desktop or web, Spotify may open the individual track without playlist context. This is an acceptable fallback.
      </p>
    </div>
  );
}
