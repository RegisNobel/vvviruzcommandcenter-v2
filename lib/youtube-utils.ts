/**
 * Validates, parses, and extracts the 11-character YouTube video ID.
 * Supports: youtube.com, www.youtube.com, m.youtube.com, music.youtube.com, and youtu.be.
 * Supports shorts and embedded paths.
 */
export function extractYouTubeVideoId(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new Error("YouTube URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("YouTube URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("YouTube URL must use HTTPS.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowedHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"];
  if (!allowedHosts.some(h => host === h || host.endsWith("." + h))) {
    throw new Error("YouTube URL must be from a valid YouTube host.");
  }

  let videoId: string | null = null;
  if (host === "youtu.be") {
    // path contains video id, e.g., youtu.be/VIDEO_ID
    videoId = parsed.pathname.substring(1);
  } else {
    // Check v query parameter first (standard watch URLs and music watch URLs)
    videoId = parsed.searchParams.get("v");
    if (!videoId) {
      if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/v/")) {
        const parts = parsed.pathname.split("/");
        videoId = parts[2] || null;
      } else if (parsed.pathname.startsWith("/shorts/")) {
        const parts = parsed.pathname.split("/");
        videoId = parts[2] || null;
      }
    }
  }

  if (videoId) {
    videoId = videoId.split("?")[0].split("/")[0];
  }

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error("YouTube URL must contain a valid 11-character video ID.");
  }

  return videoId;
}

/**
 * Generates the canonical YouTube watch URL.
 */
export function getCanonicalYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
