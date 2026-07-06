export type SpotifyResourceType = "track" | "playlist";

export type ParsedSpotifyResource = {
  type: SpotifyResourceType;
  id: string;
  shareToken: string | null;
};

export type SpotifyContextLinkResult = {
  trackId: string;
  playlistId: string;
  shareToken: string | null;
  targetUrl: string;
};

export function parseSpotifyResourceUrl(
  input: string,
  expectedType: SpotifyResourceType
): ParsedSpotifyResource {
  const trimmed = input.trim();
  if (!trimmed.startsWith("https://")) {
    throw new Error("Spotify URL must use https:// protocol.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL syntax.");
  }

  if (parsedUrl.hostname !== "open.spotify.com") {
    throw new Error("Invalid Spotify hostname.");
  }

  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const typeIndex = segments.indexOf(expectedType);

  if (typeIndex === -1 || typeIndex === segments.length - 1) {
    throw new Error(`URL is missing the expected '${expectedType}' resource segment.`);
  }

  const id = segments[typeIndex + 1];
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    throw new Error("Invalid Spotify ID character format.");
  }

  const shareToken = parsedUrl.searchParams.get("si") || null;

  return {
    type: expectedType,
    id,
    shareToken
  };
}

export function buildSpotifyPlaylistContextUrl(
  trackUrl: string,
  playlistUrl: string,
  options?: {
    preserveShareToken?: boolean;
  }
): SpotifyContextLinkResult {
  const track = parseSpotifyResourceUrl(trackUrl, "track");
  const playlist = parseSpotifyResourceUrl(playlistUrl, "playlist");

  const shareToken = playlist.shareToken || track.shareToken;
  let targetUrl = `https://open.spotify.com/track/${track.id}?context=spotify:playlist:${playlist.id}`;

  if (options?.preserveShareToken && shareToken) {
    targetUrl += `&si=${shareToken}`;
  }

  return {
    trackId: track.id,
    playlistId: playlist.id,
    shareToken,
    targetUrl
  };
}
