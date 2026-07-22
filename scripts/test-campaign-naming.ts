import {strict as assert} from "node:assert";

import {parseAdName} from "../lib/ads/naming-parser";
import {generateCampaignNaming} from "../lib/campaign-naming";

const generated = generateCampaignNaming({
  audience: "Anime Fans",
  copy: {
    hook_type: "identity-callout",
    song_section: "verse"
  },
  phase: "Launch",
  platform: "Meta",
  releaseSlug: "Mad Bunny",
  revision: "2",
  visual: "AMV"
});

assert.equal(
  generated.adName,
  "mad_bunny_amv_verse_rev2_meta_anime_fans_launch_identity_callout"
);
assert.equal(generated.utm.utm_campaign, "mad_bunny");
assert.equal(generated.utm.utm_content, generated.adName);
assert.equal(generated.utm.utm_term, "anime_fans");
assert.deepEqual(parseAdName(generated.adName), {
  release: "mad_bunny",
  visual: "amv",
  songSection: "verse",
  revision: "rev2"
});

console.log("Campaign naming generator checks passed.");
