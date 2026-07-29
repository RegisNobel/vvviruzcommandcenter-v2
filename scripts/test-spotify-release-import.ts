import assert from "node:assert/strict";

import {createEmptyRelease} from "../lib/releases";
import {applySpotifyReleaseMetadata} from "../lib/spotify-release-import";
import {parseSpotifyReleaseUrl} from "../lib/spotify-links";

const track = parseSpotifyReleaseUrl(
  "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7?si=share-token"
);
assert.deepEqual(track, {
  type: "track",
  id: "3qceBC43IHqDyjfJZOzQw7",
  canonicalUrl:
    "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7"
});

const album = parseSpotifyReleaseUrl(
  "https://open.spotify.com/intl-fr/album/01VcHKTZb2YtmL2j8ZBGzE"
);
assert.equal(album.type, "album");
assert.equal(album.id, "01VcHKTZb2YtmL2j8ZBGzE");

assert.throws(
  () =>
    parseSpotifyReleaseUrl(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
    ),
  /track or album/
);
assert.throws(
  () => parseSpotifyReleaseUrl("https://example.com/track/not-spotify"),
  /open\.spotify\.com/
);

const draft = createEmptyRelease({
  title: "Untitled YONKO release",
  catalog_scope: "ARTIST"
});
const metadata = {
  title: "Something good",
  artworkUrl: "https://image-cdn-ak.spotifycdn.com/image/example",
  spotifyUrl: track.canonicalUrl,
  resourceType: track.type,
  resourceId: track.id
};
const firstImport = applySpotifyReleaseMetadata(draft, metadata, {
  isSlugLocked: true
});
assert.equal(firstImport.release.title, "Something good");
assert.equal(firstImport.release.slug, "something-good");
assert.equal(firstImport.release.cover_art?.url, metadata.artworkUrl);
assert.equal(firstImport.release.cover_art_alt_text, "Something good cover artwork");
assert.equal(firstImport.release.seo_title, "Something good");
assert.equal(firstImport.release.streaming_links.spotify, track.canonicalUrl);

const completedDraft = {
  ...draft,
  title: "Hand-written title",
  slug: "custom-slug",
  cover_art: {
    id: "uploaded",
    fileName: "custom.png",
    url: "/api/assets/releases/custom.png",
    mimeType: "image/png"
  },
  cover_art_path: "/api/assets/releases/custom.png",
  cover_art_alt_text: "Custom artwork description",
  seo_title: "Custom SEO title",
  social_share_title: "Custom share title"
};
const secondImport = applySpotifyReleaseMetadata(completedDraft, metadata, {
  isSlugLocked: false
});
assert.equal(secondImport.release.title, completedDraft.title);
assert.equal(secondImport.release.slug, completedDraft.slug);
assert.deepEqual(secondImport.release.cover_art, completedDraft.cover_art);
assert.equal(secondImport.release.cover_art_alt_text, completedDraft.cover_art_alt_text);
assert.equal(secondImport.release.seo_title, completedDraft.seo_title);
assert.equal(secondImport.release.social_share_title, completedDraft.social_share_title);
assert.equal(secondImport.release.streaming_links.spotify, track.canonicalUrl);
assert.deepEqual(secondImport.importedFields, ["Spotify link"]);

console.log("Spotify release import tests passed.");
