export type YouTubeVideoResource = {
  videoId: string;
};

export type YouTubePlaylistResource = {
  playlistId: string;
};

export type YouTubePlaylistContextResult = YouTubeVideoResource &
  YouTubePlaylistResource & {
    targetUrl: string;
  };

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

function parseYouTubeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("https://")) {
    throw new Error("YouTube URL must use https:// protocol.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("Invalid YouTube URL syntax.");
  }

  if (!YOUTUBE_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error("Invalid YouTube hostname.");
  }

  return parsedUrl;
}

export function parseYouTubeVideoUrl(input: string): YouTubeVideoResource {
  const parsedUrl = parseYouTubeUrl(input);
  const videoId = parsedUrl.hostname.toLowerCase() === "youtu.be"
    ? parsedUrl.pathname.split("/").filter(Boolean)[0]
    : parsedUrl.searchParams.get("v") ||
      parsedUrl.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/)?.[1];

  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    throw new Error("YouTube URL is missing a valid video ID.");
  }

  return {videoId};
}

export function parseYouTubePlaylistUrl(input: string): YouTubePlaylistResource {
  const parsedUrl = parseYouTubeUrl(input);
  const playlistId = parsedUrl.searchParams.get("list");

  if (!playlistId || !/^[a-zA-Z0-9_-]{8,80}$/.test(playlistId)) {
    throw new Error("YouTube URL is missing a valid playlist ID.");
  }

  return {playlistId};
}

export function buildYouTubePlaylistContextUrl(
  videoUrl: string,
  playlistUrl: string
): YouTubePlaylistContextResult {
  const {videoId} = parseYouTubeVideoUrl(videoUrl);
  const {playlistId} = parseYouTubePlaylistUrl(playlistUrl);

  return {
    videoId,
    playlistId,
    targetUrl: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`
  };
}
