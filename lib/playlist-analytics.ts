export const playlistPlatforms = [
  "spotify",
  "apple_music",
  "youtube_music",
  "youtube",
  "other"
] as const;

export type PlaylistPlatform = (typeof playlistPlatforms)[number];

export const approvedAttributionParams = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "sl_ctx"
] as const;

export function normalizePlaylistPlatform(value: string): PlaylistPlatform {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized === "apple" || normalized === "apple_music") return "apple_music";
  if (normalized === "youtube_music") return "youtube_music";
  if (normalized === "youtube") return "youtube";
  if (normalized === "spotify") return "spotify";
  return "other";
}

export function copyApprovedAttributionParams(
  source: URLSearchParams,
  destination: URLSearchParams
) {
  for (const key of approvedAttributionParams) {
    const value = source.get(key)?.trim();
    if (value) destination.set(key, value);
  }
}

export function withApprovedAttribution(path: string, source: URLSearchParams) {
  const url = new URL(path, "https://vvviruz.local");
  copyApprovedAttributionParams(source, url.searchParams);
  return `${url.pathname}${url.search}`;
}

const allowedHosts: Record<Exclude<PlaylistPlatform, "other">, string[]> = {
  spotify: ["open.spotify.com"],
  apple_music: ["music.apple.com"],
  youtube_music: ["music.youtube.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be"]
};

export function validatePlaylistDestination(platform: PlaylistPlatform, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {valid: true, issue: ""};

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return {valid: false, issue: "Destination must use HTTPS."};
    }

    if (platform === "other") return {valid: true, issue: ""};
    const valid = allowedHosts[platform].includes(url.hostname.toLowerCase());
    return valid
      ? {valid: true, issue: ""}
      : {
          valid: false,
          issue: `This destination is labeled ${platform.replaceAll("_", " ")}, but points to ${url.hostname}.`
        };
  } catch {
    return {valid: false, issue: "Destination must be a valid HTTPS URL."};
  }
}

export function inferPlaylistPlatform(value: string, fallback: PlaylistPlatform): PlaylistPlatform {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === "open.spotify.com") return "spotify";
    if (hostname === "music.apple.com") return "apple_music";
    if (hostname === "music.youtube.com") return "youtube_music";
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(hostname)) return "youtube";
  } catch {
    return fallback;
  }
  return fallback;
}
