import assert from "node:assert/strict";

import {
  addDays,
  calculateBaselineGrowth,
  calculateCampaignMetrics,
  calculateIncrementalLift,
  calculateLiftRetained,
  completeness,
  dailyRatios,
  datesInclusive,
  mean,
  median,
  standardDeviation,
  summarizeWindow
} from "../lib/analytics/retention-calculations";
import {completenessAssessment} from "../lib/analytics/retention-confidence";
import {calculateRetentionAnalysis} from "../lib/analytics/retention-engine";
import {calculateTrackPersistence} from "../lib/analytics/track-persistence";
import type {
  AudienceObservationInput,
  RetentionCalculationInput,
  TrackObservationInput
} from "../lib/analytics/retention-types";

function artistRows(start: string, end: string, listeners: (date: string, index: number) => number) {
  return datesInclusive(start, end).map<AudienceObservationInput>((date, index) => ({
    date,
    listeners: listeners(date, index),
    monthlyListeners: 1000,
    monthlyActiveListeners: 400,
    streams: 200,
    playlistAdds: 10,
    saves: 20,
    followers: 100 + index,
    importId: "artist-import"
  }));
}

function trackRows(start: string, end: string, streams = 100) {
  return datesInclusive(start, end).map<TrackObservationInput>((date, index) => ({
    date,
    streams: streams + index,
    importId: "track-import",
    spotifyTrackId: "spotify-track"
  }));
}

assert.equal(mean([1, 2, 3]), 2);
assert.equal(median([4, 1, 3, 2]), 2.5);
assert.equal(standardDeviation([2, 2, 2]), 0);
assert.deepEqual(datesInclusive("2024-02-28", "2024-03-01"), [
  "2024-02-28",
  "2024-02-29",
  "2024-03-01"
]);
assert.equal(addDays("2026-03-08", 1), "2026-03-09", "UTC dates ignore local DST");

const full = completeness(datesInclusive("2026-01-01", "2026-01-28"), datesInclusive("2026-01-01", "2026-01-28"));
assert.deepEqual(completenessAssessment(full, "MISSING_BASELINE_DAYS"), {
  status: "VALID",
  confidence: "HIGH",
  reasonCodes: []
});
const oneMissing = completeness(datesInclusive("2026-01-01", "2026-01-28"), datesInclusive("2026-01-02", "2026-01-28"));
assert.equal(completenessAssessment(oneMissing, "MISSING_BASELINE_DAYS").confidence, "MODERATE");
const twoMissing = completeness(datesInclusive("2026-01-01", "2026-01-28"), datesInclusive("2026-01-03", "2026-01-28"));
assert.equal(completenessAssessment(twoMissing, "MISSING_BASELINE_DAYS").confidence, "LOW");
const fourMissing = completeness(datesInclusive("2026-01-01", "2026-01-28"), datesInclusive("2026-01-05", "2026-01-28"));
assert.equal(completenessAssessment(fourMissing, "MISSING_BASELINE_DAYS").status, "INSUFFICIENT");

const gapSummary = summarizeWindow(
  "gaps",
  [{date: "2026-01-01", value: 10}, {date: "2026-01-03", value: 30}],
  datesInclusive("2026-01-01", "2026-01-03"),
  (row) => row.value,
  "INCOMPLETE_SOURCE_DATA"
);
assert.equal(gapSummary.mean, 20, "missing dates are not zero-filled");
assert.deepEqual(gapSummary.completeness.missingDates, ["2026-01-02"]);

const pausedRows = artistRows("2026-04-01", "2026-04-20", (_date, index) => 100 + index);
const pausedCampaign = calculateCampaignMetrics(
  pausedRows,
  [
    {id: "one", startDate: "2026-04-01", endDate: "2026-04-05", timezone: "UTC", sourceType: "MANUAL"},
    {id: "two", startDate: "2026-04-10", endDate: "2026-04-16", timezone: "UTC", sourceType: "MANUAL"}
  ],
  "2026-04-20"
);
assert.equal(pausedCampaign.activeDayCount, 12);
assert.equal(pausedCampaign.sevenDayPeakStartDate, "2026-04-10", "rolling peak does not bridge a pause");
assert.deepEqual(pausedCampaign.finalSevenActiveDates, datesInclusive("2026-04-10", "2026-04-16"));
const shortCampaign = calculateCampaignMetrics(
  pausedRows,
  [{id: "short", startDate: "2026-04-01", endDate: "2026-04-06", timezone: "UTC", sourceType: "MANUAL"}],
  "2026-04-20"
);
assert.equal(shortCampaign.sevenDayPeak.status, "INSUFFICIENT");
const openCampaign = calculateCampaignMetrics(
  pausedRows,
  [{id: "open", startDate: "2026-04-01", endDate: null, timezone: "UTC", sourceType: "MANUAL"}],
  "2026-04-10"
);
assert.equal(openCampaign.sevenDayPeak.status, "VALID", "open campaign peak uses only measured days through cutoff");

assert.equal(calculateBaselineGrowth(100, 120).percentage, 20);
assert.equal(calculateBaselineGrowth(100, 80).status, "WARNING");
assert.equal(calculateBaselineGrowth(0, 80).status, "INSUFFICIENT");
assert.equal(calculateIncrementalLift(100, 90).status, "WARNING");
assert.equal(calculateLiftRetained(100, 200, 235).percentage, 135, "retained lift is not clamped");
assert.ok(calculateLiftRetained(100, 200, 235).reasonCodes.includes("LIFT_RETAINED_ABOVE_100"));
assert.equal(calculateLiftRetained(100, 200, 80).percentage, -20);
assert.ok(calculateLiftRetained(100, 200, 80).reasonCodes.includes("FLOOR_BELOW_BASELINE"));
assert.equal(calculateLiftRetained(100, 100, 120).status, "INSUFFICIENT");

const ratios = dailyRatios(
  [
    {...artistRows("2026-01-01", "2026-01-01", () => 0)[0], listeners: 0},
    artistRows("2026-01-02", "2026-01-02", () => 100)[0]
  ],
  (row) => row.saves,
  (row) => row.listeners
);
assert.equal(ratios.length, 1, "zero listeners produce no ratio");
assert.equal(ratios[0].value, 0.2);

const tracks = trackRows("2026-01-01", "2026-02-10", 100);
const persistence = calculateTrackPersistence(tracks, "2026-01-01");
assert.equal(persistence.launchSevenDays.mean, 103);
assert.equal(persistence.days14To28.completeness.expectedDateCount, 15);
assert.equal(persistence.latestSevenDays.completeness.expectedDateCount, 7);
assert.equal(persistence.peakDate, "2026-02-10");
assert.equal(calculateTrackPersistence(tracks.map((row) => ({...row, streams: 0})), "2026-01-01").persistenceRatio.status, "INSUFFICIENT");
assert.equal(calculateTrackPersistence(tracks, "2026-01-01", {conflictingTimelines: true}).status, "INSUFFICIENT");
assert.equal(persistence.label, "Track stream persistence");
assert.ok(!JSON.stringify(persistence).toLowerCase().includes("listener retention"));

const baseInput: RetentionCalculationInput = {
  artistId: "artist",
  releaseId: "release",
  campaignId: "campaign",
  releaseDate: "2026-02-01",
  confirmedCampaignIntervals: [
    {id: "interval", startDate: "2026-02-01", endDate: "2026-02-14", timezone: "UTC", sourceType: "MANUAL"}
  ],
  audienceObservations: artistRows("2026-01-04", "2026-03-14", (date) =>
    date < "2026-02-01" ? 100 : date <= "2026-02-14" ? 200 : 150
  ),
  trackObservations: tracks,
  overlaps: [],
  inputImports: [{importId: "artist-import", importType: "ARTIST_AUDIENCE_TIMELINE", parserVersion: "1", normalizationVersion: 1, acceptedAt: "2026-03-15T00:00:00.000Z", periodDatesUserConfirmed: false}],
  mappingResolution: [],
  reconciliationWarnings: [],
  dataCutoffDate: "2026-03-14",
  calculatedAt: "2026-03-15T00:00:00.000Z",
  conflictingTrackTimelines: false,
  incompleteTrackIdentity: false,
  ambiguousReleaseMapping: false,
  reportPeriodUserEntered: false,
  timezoneUncertain: false
};
const analysis = calculateRetentionAnalysis(baseInput);
assert.deepEqual(calculateRetentionAnalysis(baseInput), analysis, "fixed inputs and timestamp are deterministic");
assert.equal(analysis.formulaVersion, 1);
assert.equal(analysis.windows.primaryBaseline.startDate, "2026-01-04");
assert.equal(analysis.windows.primaryBaseline.endDate, "2026-01-31");
assert.equal(analysis.windows.postCampaignFloor.startDate, "2026-02-28");
assert.equal(analysis.windows.postCampaignFloor.endDate, "2026-03-14");
assert.equal(analysis.growth.liftRetained.percentage, 50);
assert.equal(analysis.audienceRatios.rollingMonthlyActiveListenerRatio.current?.value, 0.4);
assert.equal(analysis.status, "VALID");
assert.equal(analysis.confidence, "MODERATE", "causal confidence is never implied by complete inputs");
assert.ok(analysis.reasonCodes.includes("NO_SOURCE_OF_STREAM_DATA"));
assert.ok(analysis.interpretation.includes("not verified organic retention"));

const excluded = calculateRetentionAnalysis({
  ...baseInput,
  overlaps: [{type: "OTHER_RELEASE_PUBLISHED", releaseId: "other", eventDate: "2026-03-01", affectedWindow: "POST_CAMPAIGN"}]
});
assert.equal(excluded.postCampaignFloor.status, "EXCLUDED");
assert.notEqual(excluded.postCampaignFloor.mean, null, "excluded results retain honest raw values");
assert.equal(excluded.growth.liftRetained.status, "EXCLUDED");
const open = calculateRetentionAnalysis({
  ...baseInput,
  confirmedCampaignIntervals: [{...baseInput.confirmedCampaignIntervals[0], endDate: null}]
});
assert.equal(open.status, "INSUFFICIENT");
assert.ok(open.reasonCodes.includes("OPEN_CAMPAIGN"));

console.log("Retention formulas, windows, gaps, confidence, overlaps, ratios, and track persistence checks passed.");
