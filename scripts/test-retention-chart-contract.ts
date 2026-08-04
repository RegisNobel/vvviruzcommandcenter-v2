import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {resolve} from "node:path";

import {addDays, datesInclusive} from "../lib/analytics/retention-calculations";
import {buildRetentionChartPayload, shapeDashboardAnalysis} from "../lib/analytics/retention-dashboard";
import type {ReleaseRetentionAnalysisContext} from "../lib/analytics/retention-data";
import {calculateRetentionAnalysis} from "../lib/analytics/retention-engine";
import type {RetentionCalculationInput} from "../lib/analytics/retention-types";

const allDates = datesInclusive("2024-01-01", addDays("2024-01-01", 999));
const missing = new Set(["2024-06-05", "2025-12-11", "2026-06-12"]);
const audienceObservations = allDates.flatMap((date, index) => missing.has(date) ? [] : [{
  date,
  listeners: 1000 + Math.round(Math.sin(index / 9) * 80) + (date >= "2024-06-01" && date <= "2024-07-18" ? 500 : 0),
  monthlyListeners: 18000 + index * 4,
  monthlyActiveListeners: 7200 + index * 2,
  streams: 2400 + index,
  playlistAdds: 30 + (index % 7),
  saves: 60 + (index % 11),
  followers: 5000 + index,
  importId: "safe-audience-import"
}]);
const trackObservations = allDates.filter((date) => date >= "2024-04-01").map((date, index) => ({date, streams: Math.max(100, 2000 - index), importId: "safe-track-import", spotifyTrackId: "spotify-track-safe"}));
const input: RetentionCalculationInput = {
  artistId: "artist-profile-vvviruz",
  releaseId: "release-safe",
  campaignId: "campaign-safe",
  releaseDate: "2024-04-01",
  confirmedCampaignIntervals: [
    {id: "interval-one", startDate: "2024-06-01", endDate: "2024-06-20", timezone: "America/New_York", sourceType: "MANUAL"},
    {id: "interval-two", startDate: "2024-06-28", endDate: "2024-07-18", timezone: "America/New_York", sourceType: "MANUAL"}
  ],
  audienceObservations,
  trackObservations,
  overlaps: [{type: "OTHER_RELEASE_PUBLISHED", releaseId: "other-release", releaseTitle: "Other release", eventDate: "2024-08-05", affectedWindow: "POST_CAMPAIGN"}],
  inputImports: [{importId: "safe-audience-import", importType: "ARTIST_AUDIENCE_TIMELINE", parserVersion: "spotify-sfa-v1", normalizationVersion: 1, acceptedAt: "2026-08-01T00:00:00.000Z", periodDatesUserConfirmed: false}],
  mappingResolution: [{rowId: "safe-row", importId: "safe-track-import", rowIdentityKey: "safe", mappingStatus: "CONFIRMED", confirmedReleaseId: "release-safe", mappingConfidence: "EXACT_ALIAS", mappingVersion: 2, appliedAliasStatus: "ACTIVE"}],
  reconciliationWarnings: [],
  dataCutoffDate: allDates.at(-1)!,
  calculatedAt: "2026-09-26T00:00:00.000Z",
  conflictingTrackTimelines: false,
  incompleteTrackIdentity: false,
  ambiguousReleaseMapping: false,
  reportPeriodUserEntered: false,
  timezoneUncertain: false
};
const context: ReleaseRetentionAnalysisContext = {
  analysis: calculateRetentionAnalysis(input),
  release: {id: "release-safe", title: "Safe release", releaseDate: input.releaseDate, artistId: input.artistId},
  campaign: {id: "campaign-safe", name: "Safe campaign", platform: "META", status: "ENDED"},
  audienceObservations,
  trackObservations,
  timelineEvents: [
    {id: "start", eventType: "CAMPAIGN_STARTED", eventDate: "2024-06-01", timezone: "America/New_York", title: "Campaign started", source: "SYSTEM_INTERVAL_SYNC"},
    {id: "pause", eventType: "CAMPAIGN_PAUSED", eventDate: "2024-06-20", timezone: "America/New_York", title: "Campaign paused", source: "SYSTEM_INTERVAL_SYNC"},
    {id: "resume", eventType: "CAMPAIGN_RESUMED", eventDate: "2024-06-28", timezone: "America/New_York", title: "Campaign resumed", source: "SYSTEM_INTERVAL_SYNC"},
    {id: "creative", eventType: "CREATIVE_CHANGED", eventDate: "2024-07-02", timezone: "America/New_York", title: "Creative changed", source: "USER_ENTERED"}
  ]
};

for (const count of [180, 365, 1000] as const) {
  const startedAt = performance.now();
  const payload = buildRetentionChartPayload(context, {rangeDays: count});
  const elapsed = performance.now() - startedAt;
  assert.equal(payload.series.length, count);
  assert.ok(elapsed < 250, `${count} points adapt without obvious CPU lag (${elapsed.toFixed(1)}ms)`);
}

const payload = buildRetentionChartPayload(context, {rangeDays: 1000});
const shaped = shapeDashboardAnalysis(context, {rangeDays: 1000});
assert.equal(payload.contractVersion, 1);
assert.equal(payload.campaignIntervals.length, 2);
assert.ok(payload.campaignIntervals.every((interval) => interval.confirmationStatus === "CONFIRMED"));
assert.equal(payload.series.find((point) => point.date === "2024-06-21")?.windowTags.includes("CAMPAIGN"), false, "campaign pause remains unshaded");
assert.equal(payload.series.find((point) => point.date === "2024-06-05")?.artistListeners, null, "missing date remains null");
assert.equal(payload.series.find((point) => point.date === "2024-06-07")?.listenerMovingAverage7, null, "moving average remains unavailable across a gap");
assert.ok(payload.windows.some((window) => window.kind === "POST_CAMPAIGN" && window.status === "EXCLUDED"));
assert.ok(payload.markers.some((marker) => marker.kind === "OVERLAPPING_RELEASE" && marker.date === "2024-08-05"));
assert.ok(payload.markers.every((marker) => /^\d{4}-\d{2}-\d{2}$/.test(marker.date)), "markers are UTC date-only strings");
assert.equal(shaped.confidence.attributionConfidence, "LOW");
assert.equal(shaped.confidence.overallConfidence, context.analysis.confidence, "Stage 7 confidence remains unchanged");
assert.ok(!/rawFileStorageKey|originalValues|fileHash|storageKey|previewToken/i.test(JSON.stringify(payload)), "client payload contains no private import fields");

const component = readFileSync(resolve(process.cwd(), "components/retention-timeline-chart.tsx"), "utf8");
const loader = readFileSync(resolve(process.cwd(), "components/retention-timeline-chart-loader.tsx"), "utf8");
assert.ok(component.includes("connectNulls={false}"), "every line preserves null gaps");
assert.ok(component.includes("isAnimationActive={false}"), "production chart disables animation");
assert.ok(component.includes("accessibilityLayer"), "Recharts accessibility layer is enabled");
assert.ok(component.includes("Keyboard date inspector"), "tooltip has a non-hover alternative");
assert.ok(component.includes("Complete event list"), "critical information is not chart-only");
assert.ok(loader.includes("ssr: false"), "Recharts remains a client-only dynamic island");
assert.ok(!/calculateRetention|calculateLift|sevenDay.*reduce|rawFileStorageKey/i.test(component), "chart component contains no retention or private-data logic");

console.log("Production chart adapter, honest gaps, confidence shaping, privacy, and 180/365/1000-point checks passed.");
