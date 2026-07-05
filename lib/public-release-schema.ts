import "server-only";

import type {PublicReleaseRecord} from "@/lib/types";

import {
  getPublicReleaseDiscoveryMetadata,
  normalizeExternalUrl,
  parseCollaborators
} from "@/lib/public-utils";

type JsonObject = Record<string, unknown>;

type PublicReleaseJsonLdInput = {
  artistName: string;
  release: PublicReleaseRecord;
};

function getPublicSiteBaseUrl() {
  const value =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  return value.replace(/\/+$/, "");
}

function getHttpUrl(value: string | null | undefined, baseUrl: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const url = trimmed.startsWith("/") ? trimmed : normalizeExternalUrl(trimmed);

  if (!url) {
    return "";
  }

  try {
    const parsed = trimmed.startsWith("/") ? new URL(url, baseUrl) : new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function compactObject<T extends JsonObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined || entry === "") {
        return false;
      }

      if (Array.isArray(entry)) {
        return entry.length > 0;
      }

      return true;
    })
  ) as T;
}

export function stringifyJsonLd(value: JsonObject) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildPublicReleaseJsonLd({
  artistName,
  release
}: PublicReleaseJsonLdInput) {
  const baseUrl = getPublicSiteBaseUrl();
  const canonicalUrl = `${baseUrl}/music/${encodeURIComponent(release.slug)}`;
  const categoryWorks = release.categories.map((category) =>
    compactObject({
      "@type": "CreativeWorkSeries",
      name: category.name,
      url: `${baseUrl}/music?category=${encodeURIComponent(category.slug)}`
    })
  );
  const {
    coverArtAltText,
    metaDescription,
    socialShareDescription
  } = getPublicReleaseDiscoveryMetadata(release);
  const description =
    release.public_long_description.trim() ||
    socialShareDescription ||
    metaDescription ||
    release.public_description.trim();
  const sameAs = Array.from(
    new Set(
      [
        getHttpUrl(release.spotify_url, baseUrl),
        getHttpUrl(release.apple_music_url, baseUrl),
        getHttpUrl(release.youtube_url, baseUrl),
        getHttpUrl(release.featured_video_url, baseUrl)
      ].filter(Boolean)
    )
  );
  const image = getHttpUrl(release.cover_art_path, baseUrl);
  const collaborators = parseCollaborators(release.collaborator_name);
  const hasPublicLyrics =
    release.public_lyrics_enabled && release.lyrics.trim().length > 0;

  const musicRecording = compactObject({
    "@type": "MusicRecording",
    "@id": `${canonicalUrl}#music-recording`,
    name: release.title,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    description,
    datePublished: release.release_date || undefined,
    image: image
      ? compactObject({
          "@type": "ImageObject",
          url: image,
          caption: coverArtAltText
        })
      : undefined,
    byArtist: compactObject({
      "@type": "MusicGroup",
      name: artistName,
      url: baseUrl
    }),
    contributor:
      release.collaborator && collaborators.length > 0
        ? collaborators.map((name) =>
            compactObject({
              "@type": "Person",
              name
            })
          )
        : undefined,
    genre: [release.type, ...release.categories.map((category) => category.name)],
    isPartOf: categoryWorks,
    keywords: [release.type, ...release.categories.map((category) => category.name)],
    sameAs,
    recordingOf: hasPublicLyrics
      ? compactObject({
          "@type": "MusicComposition",
          name: release.title,
          lyrics: compactObject({
            "@type": "CreativeWork",
            text: release.lyrics.trim()
          })
        })
      : undefined
  });

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Music",
        item: `${baseUrl}/music`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: release.title,
        item: canonicalUrl
      }
    ]
  };

  return {
    "@context": "https://schema.org",
    "@graph": [musicRecording, breadcrumbList]
  };
}
