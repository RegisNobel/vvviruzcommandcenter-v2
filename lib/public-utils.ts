import type {PublicReleaseRecord} from "@/lib/types";

type PublicReleaseDiscoveryMetadataInput = Pick<
  Partial<PublicReleaseRecord>,
  | "cover_art_alt_text"
  | "meta_description"
  | "public_description"
  | "seo_title"
  | "social_share_description"
  | "social_share_title"
  | "title"
>;

function safeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeExternalUrl(url: string | null | undefined) {
  const value = safeText(url);

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

export function getPublicCardTitleSize(
  title: string,
  variant: "standard" | "compact" = "standard"
) {
  const characterCount = Array.from(title.trim()).length;

  if (variant === "compact") {
    if (characterCount > 44) {
      return "text-sm";
    }

    if (characterCount > 30) {
      return "text-base";
    }

    return "text-lg";
  }

  if (characterCount > 44) {
    return "text-lg";
  }

  if (characterCount > 30) {
    return "text-xl";
  }

  return "text-2xl";
}

export function getSpotifyEmbedUrl(url: string | null | undefined) {
  const value = safeText(url);

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
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

export function getYouTubeEmbedUrl(url: string | null | undefined) {
  const value = safeText(url);

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

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

export function getPublicReleaseDiscoveryMetadata(
  release: PublicReleaseDiscoveryMetadataInput
) {
  const title = safeText(release.title) || "Untitled release";
  const publicDescription = safeText(release.public_description);
  const seoTitle = safeText(release.seo_title) || title;
  const metaDescription = safeText(release.meta_description) || publicDescription;
  const coverArtAltText =
    safeText(release.cover_art_alt_text) || `${title} cover art`;
  const socialShareTitle =
    safeText(release.social_share_title) || seoTitle || title;
  const socialShareDescription =
    safeText(release.social_share_description) || metaDescription || publicDescription;

  return {
    coverArtAltText,
    metaDescription,
    seoTitle,
    socialShareDescription,
    socialShareTitle
  };
}

export type LinksSearchParams = Record<string, string | string[] | undefined>;

function shouldPassthroughParam(key: string) {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey.startsWith("utm_") ||
    normalizedKey === "fbclid" ||
    normalizedKey === "gclid" ||
    normalizedKey === "msclkid"
  );
}

export function createPassthroughParams(searchParams: LinksSearchParams) {
  const passthroughParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (!shouldPassthroughParam(key)) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (item) {
        passthroughParams.append(key, item);
      }
    }
  }

  return passthroughParams;
}

/**
 * Parses a collaborator name string into a list of unique, non-empty, trimmed names.
 * Limits the number of collaborators to a maximum of 10.
 */
export function parseCollaborators(collaboratorName: string | null | undefined): string[] {
  if (typeof collaboratorName !== "string") return [];
  const names: string[] = [];
  const rawNames = collaboratorName.split(",");
  for (const raw of rawNames) {
    const trimmed = raw.trim();
    if (trimmed && !names.includes(trimmed)) {
      names.push(trimmed);
      if (names.length >= 10) {
        break; // Cap at 10 collaborators
      }
    }
  }
  return names;
}

/**
 * Formats a list of collaborator names into a human-readable string.
 * Example: ["Dominion KC", "Alice", "Bob"] -> "Dominion KC, Alice & Bob"
 */
export function formatCollaboratorsList(names: string[] | string | null | undefined): string {
  const parsedNames = Array.isArray(names) ? names : parseCollaborators(names);
  if (parsedNames.length === 0) return "";
  if (parsedNames.length === 1) return parsedNames[0];
  if (parsedNames.length === 2) return `${parsedNames[0]} & ${parsedNames[1]}`;
  return `${parsedNames.slice(0, -1).join(", ")} & ${parsedNames[parsedNames.length - 1]}`;
}
