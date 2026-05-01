import {mergeParsedMetaRows, parseMetaCsv} from "../lib/ads/meta-csv";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const deliveryCsv = `Ad name,Ad set name,Campaign name,Reporting starts,Reporting ends,Amount spent,Impressions,Reach,Results,Cost per result,Quality ranking
beast mode ad 6,beast mode ad set,Beast Mode,2026-04-01,2026-04-07,$20.00,"1,000",900,40,$0.50,Average`;

const engagementCsv = `Ad name,Reporting starts,Reporting ends,Amount spent,Link clicks,CPC,CTR,Page engagement,Post reactions,Post comments,Post saves,Post shares,Instagram follows
beast mode ad 6,2026-04-01,2026-04-07,$99.00,200,$0.10,20%,320,50,8,6,2,1`;

const videoCsv = `Ad name,Reporting starts,Reporting ends,ThruPlays,Video plays at 25%,Video plays at 50%,Video plays at 75%,Video plays at 95%,Video plays at 100%
beast mode ad 6,2026-04-01,2026-04-07,70,55,45,38,34,30`;

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
assert(row.results === 40, `Expected results to stay from delivery view, received ${row.results}.`);
assert(row.link_clicks === 200, `Expected engagement link clicks to merge in, received ${row.link_clicks}.`);
assert(row.cpc === 0.1, `Expected engagement CPC to merge in, received ${row.cpc}.`);
assert(row.thru_plays === 70, `Expected video ThruPlays to merge in, received ${row.thru_plays}.`);
assert(row.video_100 === 30, `Expected video 100% plays to merge in, received ${row.video_100}.`);

console.log("Ads merge smoke passed: metric-view CSVs merge into one non-additive ad row.");
