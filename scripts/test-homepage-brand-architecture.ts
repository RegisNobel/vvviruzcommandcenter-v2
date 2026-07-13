import assert from "node:assert/strict";

import {
  getHomepageStreamingTarget,
  isHomepageProjectEligible,
  mergeHomepageFeaturedReleases
} from "../lib/homepage-brand";

function run() {
  const configured = [{id: "hero"}, {id: "support-one"}];
  const fallback = [{id: "support-one"}, {id: "support-two"}, {id: "support-three"}];
  const merged = mergeHomepageFeaturedReleases(configured, fallback);

  assert.deepEqual(
    merged.map((release) => release.id),
    ["hero", "support-one", "support-two"],
    "Configured releases should remain first, duplicates should be removed, and fallback should fill the limit."
  );

  assert.deepEqual(
    mergeHomepageFeaturedReleases([], fallback, 1).map((release) => release.id),
    ["support-one"],
    "A deterministic fallback should provide the hero when no release is configured."
  );

  assert.deepEqual(
    getHomepageStreamingTarget({
      apple_music_url: "https://music.apple.com/example",
      spotify_url: "https://open.spotify.com/track/example",
      youtube_url: "https://youtube.com/watch?v=example"
    }),
    {
      href: "https://open.spotify.com/track/example",
      label: "Listen on Spotify",
      platform: "spotify"
    },
    "Spotify should be the preferred homepage listening destination when available."
  );

  assert.equal(
    getHomepageStreamingTarget({apple_music_url: "", spotify_url: "", youtube_url: ""}),
    null,
    "The homepage must not label an internal release page as a streaming destination."
  );

  assert.equal(
    isHomepageProjectEligible({releaseCount: 2, slug: "multiversus"}),
    true,
    "Projects with at least two public releases should be eligible."
  );
  assert.equal(
    isHomepageProjectEligible({releaseCount: 1, slug: "switch"}),
    false,
    "Single-release categories should not be promoted as established projects."
  );
  assert.equal(
    isHomepageProjectEligible({releaseCount: 8, slug: "vault"}),
    false,
    "The Vault category is not a public music project card."
  );

  console.log("Homepage brand architecture checks passed.");
}

run();
