import assert from "node:assert/strict";

import {
  getArtistFeaturedItemHref,
  parseArtistProfileSnapshot
} from "../lib/artist-profiles";

const release = {
  id: "release-1",
  slug: "first-release",
  title: "First Release",
  catalogScope: "ARTIST" as const,
  primaryArtistProfileId: "artist-1",
  primaryArtistName: "Artist",
  credits: [],
  releaseDate: "2026-01-01",
  type: "nerdcore",
  coverArtUrl: "",
  coverArtAlt: "",
  description: "",
  story: "",
  context: "",
  languages: [],
  genres: [],
  moods: [],
  themes: [],
  listenerContexts: [],
  streamingLinks: {spotify: "", appleMusic: "", youtube: ""},
  featuredVideoUrl: "",
  lyrics: "",
  publicLyricsEnabled: false,
  lyricsRightsConfirmed: false,
  editorialEnabled: false,
  annotations: []
};

const baseSnapshot = {
  artistProfileId: "artist-1",
  slug: "artist",
  displayName: "Artist",
  location: "",
  locationCountryCode: "",
  themeFamily: "signal-noir",
  longBio: "",
  differentiator: "",
  genres: [],
  primaryCta: {label: "", url: ""},
  secondaryCta: {label: "", url: ""},
  profileImage: {url: "", alt: ""},
  pageCopy: {
    signalLabel: "Signal",
    heroEyebrow: "Managed artist profile",
    storyLabel: "Story",
    storyHeading: "Story",
    fingerprintLabel: "Fingerprint",
    featuredButtonLabel: "Explore",
    selectedLabel: "Selected",
    selectedHeading: "More",
    platformLabel: "Platforms"
  },
  seo: {title: "", description: "", socialImageUrl: ""},
  links: [],
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const legacy = parseArtistProfileSnapshot(
  JSON.stringify({
    ...baseSnapshot,
    schemaVersion: 4,
    featuredItems: [
      {
        itemType: "single",
        eyebrow: "",
        title: release.title,
        subtitle: "",
        description: "",
        url: "",
        coverArtUrl: "",
        coverArtAlt: "",
        isStartHere: true,
        releaseId: release.id,
        editorialRelease: release
      }
    ]
  })
);

assert(legacy);
assert.equal(legacy.expansion.catalogEnabled, false);
assert.equal(legacy.releaseLibrary.length, 1);
assert.equal(legacy.releaseLibrary[0]?.editorialEnabled, true);

const expanded = parseArtistProfileSnapshot(
  JSON.stringify({
    ...baseSnapshot,
    schemaVersion: 5,
    featuredItems: [],
    featuredStories: [],
    expansion: {
      catalogEnabled: true,
      catalogTitle: "Releases",
      catalogIntro: "",
      catalogCtaLabel: "View all releases",
      catalogReleaseIds: [release.id],
      editorialReleaseIds: [release.id],
      featuredStoriesEnabled: false,
      featuredStoriesLabel: "Featured stories",
      featuredStoriesHeading: "Go deeper"
    },
    releaseLibrary: [release]
  })
);

assert(expanded);
assert.equal(expanded.expansion.catalogEnabled, true);
assert.deepEqual(expanded.expansion.catalogReleaseIds, [release.id]);
assert.equal(expanded.releaseLibrary[0]?.editorialEnabled, true);

const sharedRelease = {
  ...release,
  id: "release-shared",
  slug: "shared-release",
  catalogScope: "VVVIRUZ" as const,
  primaryArtistProfileId: "",
  primaryArtistName: "vvviruz",
  editorialEnabled: true
};
const sharedItem = {
  itemType: "collaboration" as const,
  eyebrow: "Start Here",
  title: sharedRelease.title,
  subtitle: "",
  description: "",
  url: "https://example.com/shared-release",
  coverArtUrl: "",
  coverArtAlt: "",
  isStartHere: true,
  releaseId: sharedRelease.id,
  editorialRelease: sharedRelease
};

assert.equal(
  getArtistFeaturedItemHref({slug: "artist"}, sharedItem, "private-token"),
  "/preview/artists/private-token/music/shared-release"
);
assert.equal(
  getArtistFeaturedItemHref({slug: "artist"}, sharedItem),
  "/artists/artist/music/shared-release"
);

console.log("Artist profile expansion snapshot tests passed.");
