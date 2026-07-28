import "server-only";

import type {PublicReleaseCategory, PublicReleaseRecord} from "@/lib/types";
import {getPublicProjectPath, getPublicProjectSeriesId} from "@/lib/public-projects";
import {
  getPublicHttpUrl,
  getPublicSiteBaseUrl,
  getPublicSiteUrl
} from "@/lib/public-site-url";

import {
  getPublicReleaseDiscoveryMetadata,
  parseCollaborators
} from "@/lib/public-utils";
import {stringifyJsonLd} from "@/lib/json-ld";
import {PUBLIC_ARTIST_ID} from "@/lib/public-site-schema";

type JsonObject = Record<string, unknown>;

type PublicReleaseJsonLdInput = {
  artistName: string;
  projectCategories?: PublicReleaseCategory[];
  release: PublicReleaseRecord;
};

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

export {stringifyJsonLd};

export function buildPublicReleaseJsonLd({
  artistName,
  projectCategories = [],
  release
}: PublicReleaseJsonLdInput) {
  const categories = release.categories ?? [];
  const genres = release.genres ?? [];
  const languages = release.languages ?? [];
  const moods = release.moods ?? [];
  const themes = release.themes ?? [];
  const listenerContexts = release.listener_contexts ?? [];
  const baseUrl = getPublicSiteBaseUrl();
  const canonicalUrl = getPublicSiteUrl(`/music/${encodeURIComponent(release.slug)}`);
  const categoryWorks = projectCategories.map((category) =>
    compactObject({
      "@type": "CreativeWorkSeries",
      "@id": getPublicProjectSeriesId(baseUrl, category.slug),
      name: category.name,
      url: getPublicSiteUrl(getPublicProjectPath(category.slug))
    })
  );
  const {
    coverArtAltText,
    metaDescription,
    socialShareDescription
  } = getPublicReleaseDiscoveryMetadata(release);
  const description =
    release.inspiration_context?.trim() ||
    release.public_long_description?.trim() ||
    socialShareDescription ||
    metaDescription ||
    release.public_description?.trim();
  const sameAs = Array.from(
    new Set(
      [
        getPublicHttpUrl(release.spotify_url),
        getPublicHttpUrl(release.apple_music_url),
        getPublicHttpUrl(release.youtube_url),
        getPublicHttpUrl(release.featured_video_url)
      ].filter(Boolean)
    )
  );
  const image = getPublicHttpUrl(release.cover_art_path);
  const collaborators = parseCollaborators(release.collaborator_name);
  const hasPublicLyrics =
    release.public_lyrics_enabled && Boolean(release.lyrics?.trim());

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
      "@type": "Person",
      "@id": PUBLIC_ARTIST_ID,
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
    genre:
      genres.length > 0
        ? genres
        : release.type === "nerdcore"
          ? ["Nerdcore"]
          : ["Hip-Hop/Rap"],
    inLanguage: languages,
    isPartOf: categoryWorks,
    keywords: [
      release.type,
      ...categories.map((category) => category.name),
      ...moods,
      ...themes,
      ...listenerContexts
    ],
    sameAs,
    recordingOf: hasPublicLyrics
      ? compactObject({
          "@type": "MusicComposition",
          name: release.title,
          lyrics: compactObject({
            "@type": "CreativeWork",
            text: release.lyrics?.trim()
          })
        })
      : undefined
  });

  const breadcrumbItems = projectCategories.length === 1
    ? [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: getPublicSiteUrl("/")
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Projects",
          item: getPublicSiteUrl("/projects")
        },
        {
          "@type": "ListItem",
          position: 3,
          name: projectCategories[0].name,
          item: getPublicSiteUrl(getPublicProjectPath(projectCategories[0].slug))
        },
        {
          "@type": "ListItem",
          position: 4,
          name: release.title,
          item: canonicalUrl
        }
      ]
    : [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: getPublicSiteUrl("/")
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Music",
          item: getPublicSiteUrl("/music")
        },
        {
          "@type": "ListItem",
          position: 3,
          name: release.title,
          item: canonicalUrl
        }
      ];
  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: breadcrumbItems
  };

  return {
    "@context": "https://schema.org",
    "@graph": [musicRecording, breadcrumbList]
  };
}
