import assert from "node:assert/strict";

import {
  getHomepageStreamingTarget,
  mergeHomepageFeaturedReleases,
  moveHomepageFeaturedRelease
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
    moveHomepageFeaturedRelease(["hero", "support-one", "support-two"], "support-two", -1),
    ["hero", "support-two", "support-one"],
    "Featured releases should move without losing their editorial order."
  );
  assert.deepEqual(
    moveHomepageFeaturedRelease(["hero", "support-one"], "hero", -1),
    ["hero", "support-one"],
    "Moving beyond an ordered list boundary should be a no-op."
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

  console.log("Homepage brand architecture checks passed.");
}

run();
