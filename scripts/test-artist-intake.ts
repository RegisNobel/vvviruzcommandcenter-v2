import assert from "node:assert/strict";

import {
  artistIntakeResponseSchema,
  artistIntakeSubmissionSchema,
  createEmptyArtistIntakeResponse
} from "../lib/artist-intake";

const draft = createEmptyArtistIntakeResponse("Test Artist", "artist@example.com");
assert.equal(artistIntakeResponseSchema.safeParse(draft).success, true);
assert.equal(artistIntakeSubmissionSchema.safeParse(draft).success, false);

const complete = structuredClone(draft);
complete.artist.countryCode = "US";
complete.artist.profileImageUrl = "https://example.com/profile.jpg";
complete.artist.imageRightsConfirmed = true;
complete.artist.soundDescription = "Melodic rap with dense character writing.";
complete.artist.differentiator = "Self-produced records with bilingual wordplay.";
complete.artist.genres = ["Hip-hop", "Nerdcore"];
complete.releases[0].title = "First Signal";
complete.releases[0].spotifyUrl = "https://open.spotify.com/track/example";
complete.releases[0].coverArtUrl = "https://example.com/cover.jpg";
complete.releases[0].coverArtRightsConfirmed = true;
complete.releases[0].trackSummary = "A focused introduction to the artist's sound.";
complete.submissionConfirmed = true;

const submitted = artistIntakeSubmissionSchema.safeParse(complete);
assert.equal(submitted.success, true);

complete.releases.push({
  ...structuredClone(complete.releases[0]),
  id: crypto.randomUUID(),
  title: "Second Signal"
});
assert.equal(
  artistIntakeSubmissionSchema.safeParse(complete).success,
  false,
  "Only one release can be Start Here."
);

console.log("Artist intake schema tests passed.");
