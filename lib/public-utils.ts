import type {PublicReleaseRecord} from "@/lib/types";

export function normalizeExternalUrl(url: string) {
  const value = url.trim();

  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  ) {
    return value;
  }

  return `https://${value}`;
}

export function formatPublicReleaseDate(value: string) {
  if (!value) {
    return "Release date coming soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function getSpotifyEmbedUrl(url: string) {
  if (!url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const [, resourceType, resourceId] = parsed.pathname.split("/");

    if (!resourceType || !resourceId) {
      return null;
    }

    const allowedTypes = new Set(["track", "album", "playlist"]);

    if (!allowedTypes.has(resourceType)) {
      return null;
    }

    return `https://open.spotify.com/embed/${resourceType}/${resourceId}`;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: string) {
  if (!url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getReleaseListenHref(release: PublicReleaseRecord) {
  return (
    normalizeExternalUrl(release.spotify_url) ||
    normalizeExternalUrl(release.apple_music_url) ||
    normalizeExternalUrl(release.youtube_url) ||
    `/music/${release.slug}`
  );
}
