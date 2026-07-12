import assert from "node:assert/strict";

import {
  normalizePlaylistPlatform,
  validatePlaylistDestination,
  withApprovedAttribution
} from "../lib/playlist-analytics";

const attributed = withApprovedAttribution(
  "/listen/n2dc/stay?existing=kept",
  new URLSearchParams({
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "playlist_test",
    utm_content: "ad_1",
    fbclid: "click-id",
    unsupported: "drop-me"
  })
);

assert.equal(
  attributed,
  "/listen/n2dc/stay?existing=kept&utm_source=meta&utm_medium=paid_social&utm_campaign=playlist_test&utm_content=ad_1&fbclid=click-id"
);
assert.equal(normalizePlaylistPlatform("Apple Music"), "apple_music");
assert.equal(normalizePlaylistPlatform("youtube-music"), "youtube_music");
assert.equal(validatePlaylistDestination("spotify", "https://open.spotify.com/track/123").valid, true);
assert.equal(validatePlaylistDestination("spotify", "https://bandlab.com/track/123").valid, false);
assert.equal(validatePlaylistDestination("youtube", "javascript:alert(1)").valid, false);

console.log("Playlist analytics utility checks passed.");
