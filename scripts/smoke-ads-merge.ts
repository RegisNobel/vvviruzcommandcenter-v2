import {mergeParsedMetaRows, parseMetaCsv} from "../lib/ads/meta-csv";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const deliveryCsv = `Ad name,Ad set name,Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Impressions,Reach,Frequency,"CPM (cost per 1,000 impressions) (USD)",Results,Result indicator,Cost per results,Quality ranking
beast mode ad 6,beast mode ad set,Beast Mode,2026-04-01,2026-04-07,$20.00,"1,000",900,1.11,$20.00,40,conversions:offsite_conversion.fb_pixel_custom.StreamingOutboundClick,$0.50,Average`;

const engagementCsv = `Ad name,Reporting starts,Reporting ends,Amount spent (USD),Link clicks,CPC (cost per link click) (USD),CTR (link click-through rate),Clicks (all),CTR (all),CPC (all) (USD),Landing page views,Cost per landing page view (USD),Page engagement,Post reactions,Post comments,Post saves,Post shares,Facebook likes,Instagram follows
beast mode ad 6,2026-04-01,2026-04-07,$99.00,200,$0.10,20%,240,24%,$0.08,180,$0.11,320,50,8,6,2,3,1`;

const videoCsv = `Ad name,Reporting starts,Reporting ends,2-second continuous video plays,3-second video plays,Cost per 3-second video play (USD),ThruPlays,Cost per ThruPlay (USD),Video plays at 25%,Video plays at 50%,Video plays at 75%,Video plays at 95%,Video plays at 100%
beast mode ad 6,2026-04-01,2026-04-07,500,300,$0.07,70,$0.29,55,45,38,34,30`;

const parsedRows = [
  parseMetaCsv("engagement.csv", engagementCsv),
  parseMetaCsv("video.csv", videoCsv),
  parseMetaCsv("delivery.csv", deliveryCsv)
].flatMap((file) => file.rows);

const merged = mergeParsedMetaRows(parsedRows);
const row = merged[0];

assert(merged.length === 1, `Expected 1 merged ad row, received ${merged.length}.`);
assert(row.ad_name === "beast mode ad 6", "Expected Beast Mode ad name to be retained.");
assert(row.ad_set_name === "beast mode ad set", "Expected ad set name to enrich the merged row.");
assert(row.spend === 20, `Expected delivery spend to win without doubling, received ${row.spend}.`);
assert(row.impressions === 1000, `Expected impressions to stay from delivery view, received ${row.impressions}.`);
assert(row.reach === 900, `Expected reach to stay from delivery view, received ${row.reach}.`);
assert(row.frequency === 1.11, `Expected frequency to import, received ${row.frequency}.`);
assert(row.cpm === 20, `Expected CPM to import, received ${row.cpm}.`);
assert(row.results === 40, `Expected results to stay from delivery view, received ${row.results}.`);
assert(row.result_indicator.includes("StreamingOutboundClick"), `Expected result indicator to import, received ${row.result_indicator}.`);
assert(row.link_clicks === 200, `Expected engagement link clicks to merge in, received ${row.link_clicks}.`);
assert(row.cpc === 0.1, `Expected engagement CPC to merge in, received ${row.cpc}.`);
assert(row.clicks_all === 240, `Expected all-click count to merge in, received ${row.clicks_all}.`);
assert(row.landing_page_views === 180, `Expected landing page views to merge in, received ${row.landing_page_views}.`);
assert(row.cost_per_landing_page_view === 0.11, `Expected cost per landing page view to merge in, received ${row.cost_per_landing_page_view}.`);
assert(row.facebook_likes === 3, `Expected Facebook likes to merge in, received ${row.facebook_likes}.`);
assert(row.two_second_continuous_plays === 500, `Expected 2-second plays to merge in, received ${row.two_second_continuous_plays}.`);
assert(row.three_second_plays === 300, `Expected 3-second plays to merge in, received ${row.three_second_plays}.`);
assert(row.cost_per_three_second_play === 0.07, `Expected cost per 3-second play to merge in, received ${row.cost_per_three_second_play}.`);
assert(row.thru_plays === 70, `Expected video ThruPlays to merge in, received ${row.thru_plays}.`);
assert(row.cost_per_thru_play === 0.29, `Expected video Cost per ThruPlay to merge in, received ${row.cost_per_thru_play}.`);
assert(row.video_100 === 30, `Expected video 100% plays to merge in, received ${row.video_100}.`);

console.log("Ads merge smoke passed: metric-view CSVs merge into one non-additive ad row.");
