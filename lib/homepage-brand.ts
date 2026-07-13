import {normalizeExternalUrl} from "@/lib/public-utils";
import type {PublicReleaseRecord} from "@/lib/types";

export const HOMEPAGE_FEATURED_LIMIT = 3;
export const HOMEPAGE_PROJECT_LIMIT = 4;

export type HomepageStreamingTarget = {
  href: string;
  label: string;
  platform: "spotify" | "apple_music" | "youtube";
};

export function getHomepageStreamingTarget(
  release: Pick<PublicReleaseRecord, "apple_music_url" | "spotify_url" | "youtube_url">
): HomepageStreamingTarget | null {
  const targets: HomepageStreamingTarget[] = [
    {
      href: normalizeExternalUrl(release.spotify_url),
      label: "Listen on Spotify",
      platform: "spotify"
    },
    {
      href: normalizeExternalUrl(release.apple_music_url),
      label: "Listen on Apple Music",
      platform: "apple_music"
    },
    {
      href: normalizeExternalUrl(release.youtube_url),
      label: "Listen on YouTube",
      platform: "youtube"
    }
  ];

  return targets.find((target) => target.href) ?? null;
}

export function mergeHomepageFeaturedReleases<T extends {id: string}>(
  selected: T[],
  fallback: T[],
  limit = HOMEPAGE_FEATURED_LIMIT
) {
  const releases: T[] = [];
  const seenIds = new Set<string>();

  for (const release of [...selected, ...fallback]) {
    if (!release.id || seenIds.has(release.id)) {
      continue;
    }

    releases.push(release);
    seenIds.add(release.id);

    if (releases.length >= limit) {
      break;
    }
  }

  return releases;
}
