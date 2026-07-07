export type YouTubePlaylistDetails = {
  playlistId: string;
  publicUrl: string;
  embedUrl: string;
};

/**
 * Validates, parses, and normalizes YouTube playlist links.
 * Supports: youtube.com, music.youtube.com, and youtu.be.
 */
export function parseAndNormalizeYouTubePlaylist(urlStr: string): YouTubePlaylistDetails {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new Error("Playlist URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Playlist URL must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Playlist URL must use HTTP or HTTPS.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowedHosts = ["youtube.com", "www.youtube.com", "youtu.be", "music.youtube.com"];
  if (!allowedHosts.some(h => host === h || host.endsWith("." + h))) {
    throw new Error("Private External URL must be a valid YouTube host (youtube.com, music.youtube.com, or youtu.be).");
  }
  
  let playlistId = parsed.searchParams.get("list");
  if (!playlistId && host === "youtu.be") {
    playlistId = parsed.searchParams.get("list");
  }
  
  if (!playlistId || !/^[A-Za-z0-9_-]{10,50}$/.test(playlistId)) {
    throw new Error("YouTube playlist URL must contain a valid playlist ID (e.g. ?list=PL...).");
  }

  return {
    playlistId,
    publicUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}`
  };
}
