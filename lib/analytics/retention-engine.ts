import {
  addDays,
  calculateBaselineGrowth,
  calculateCampaignMetrics,
  calculateIncrementalLift,
  calculateLiftRetained,
  dailyRatios,
  datesInclusive,
  snapshotChange,
  summarizeWindow
} from "./retention-calculations";
import {
  lowerConfidence,
  uniqueReasons,
  worstConfidence,
  worstStatus
} from "./retention-confidence";
import {calculateTrackPersistence} from "./track-persistence";
import {CURRENT_OBSERVATION_RESOLUTION_VERSION} from "./analytics-resolution-version";
import {RETENTION_FORMULA_VERSION} from "./retention-types";
import type {
  DailyRatioValue,
  NumericMetric,
  RatioSeries,
  RetentionAnalysisResult,
  RetentionCalculationInput,
  RetentionConfidence,
  RetentionReasonCode,
  RetentionStatus,
  WindowStatistics
} from "./retention-types";

const IMPORTED_AUDIENCE = [{kind: "IMPORTED" as const, label: "Spotify Artist Audience Timeline"}];
const CALCULATED = [{kind: "CALCULATED" as const, label: "Deterministic formula from measured inputs"}];

function ratioSeries(
  label: string,
  formula: string,
  daily: DailyRatioValue[],
  windows: {baseline: string[]; campaign: string[]; post: string[]}
): RatioSeries {
  const provenance = [...IMPORTED_AUDIENCE, ...CALCULATED];
  const summarize = (windowLabel: string, dates: string[], missingCode: RetentionReasonCode) =>
    summarizeWindow(windowLabel, daily, dates, (row) => row.value, missingCode, provenance);
  const baseline = summarize(`${label}: primary baseline`, windows.baseline, "MISSING_BASELINE_DAYS");
  const campaign = summarize(`${label}: campaign`, windows.campaign, "MISSING_CAMPAIGN_DAYS");
  const postCampaign = summarize(`${label}: post-campaign`, windows.post, "MISSING_POST_WINDOW");
  return {
    label,
    formula,
    status: worstStatus(baseline.status, campaign.status, postCampaign.status),
    confidence: worstConfidence(baseline.confidence, campaign.confidence, postCampaign.confidence),
    reasonCodes: uniqueReasons([
      ...baseline.reasonCodes,
      ...campaign.reasonCodes,
      ...postCampaign.reasonCodes
    ]),
    daily,
    current: daily.at(-1) ?? null,
    baseline,
    campaign,
    postCampaign,
    provenance
  };
}

function overrideMetric(
  value: NumericMetric,
  status: RetentionStatus,
  confidence: RetentionConfidence,
  reasons: RetentionReasonCode[]
): NumericMetric {
  return {...value, status, confidence, reasonCodes: uniqueReasons([...value.reasonCodes, ...reasons])};
}

function overrideWindow(
  value: WindowStatistics,
  status: RetentionStatus,
  confidence: RetentionConfidence,
  reasons: RetentionReasonCode[]
): WindowStatistics {
  return {...value, status, confidence, reasonCodes: uniqueReasons([...value.reasonCodes, ...reasons])};
}

export function calculateRetentionAnalysis(input: RetentionCalculationInput): RetentionAnalysisResult {
  const primaryDates = datesInclusive(addDays(input.releaseDate, -28), addDays(input.releaseDate, -1));
  const recentDates = datesInclusive(addDays(input.releaseDate, -7), addDays(input.releaseDate, -1));
  const baselinePrimary = summarizeWindow(
    "Pre-release 28-day listener baseline",
    input.audienceObservations,
    primaryDates,
    (row) => row.listeners,
    "MISSING_BASELINE_DAYS",
    [...IMPORTED_AUDIENCE, ...CALCULATED]
  );
  const baselineRecent = summarizeWindow(
    "Pre-release recent seven-day listener baseline",
    input.audienceObservations,
    recentDates,
    (row) => row.listeners,
    "MISSING_BASELINE_DAYS",
    [...IMPORTED_AUDIENCE, ...CALCULATED]
  );
  const campaign = calculateCampaignMetrics(
    input.audienceObservations,
    input.confirmedCampaignIntervals,
    input.dataCutoffDate
  );
  const closedEnds = input.confirmedCampaignIntervals.flatMap((interval) =>
    interval.endDate ? [interval.endDate] : []
  );
  const hasOpenCampaign = input.confirmedCampaignIntervals.some((interval) => !interval.endDate);
  const finalCampaignDate = hasOpenCampaign ? null : closedEnds.sort().at(-1) ?? null;
  const postDates = finalCampaignDate
    ? datesInclusive(addDays(finalCampaignDate, 14), addDays(finalCampaignDate, 28))
    : [];
  let postCampaignFloor = summarizeWindow(
    "Post-campaign listener floor, days 14 through 28",
    input.audienceObservations,
    postDates,
    (row) => row.listeners,
    "MISSING_POST_WINDOW",
    [...IMPORTED_AUDIENCE, ...CALCULATED]
  );

  const overallReasons: RetentionReasonCode[] = ["NO_SOURCE_OF_STREAM_DATA"];
  if (hasOpenCampaign) {
    overallReasons.push("OPEN_CAMPAIGN", "UNKNOWN_CAMPAIGN_END");
    postCampaignFloor = overrideWindow(
      postCampaignFloor,
      "INSUFFICIENT",
      "INSUFFICIENT",
      ["OPEN_CAMPAIGN", "UNKNOWN_CAMPAIGN_END"]
    );
  } else if (
    postDates.length &&
    (!input.dataCutoffDate || input.dataCutoffDate < postDates.at(-1)!)
  ) {
    overallReasons.push("FUTURE_WINDOW_INCOMPLETE", "MISSING_POST_WINDOW");
    postCampaignFloor = overrideWindow(
      postCampaignFloor,
      "INSUFFICIENT",
      "INSUFFICIENT",
      ["FUTURE_WINDOW_INCOMPLETE", "MISSING_POST_WINDOW"]
    );
  }

  const postContamination = input.overlaps.some(
    (overlap) =>
      overlap.affectedWindow === "POST_CAMPAIGN" &&
      (overlap.type === "OTHER_RELEASE_PUBLISHED" ||
        overlap.type === "DIFFERENT_RELEASE_CAMPAIGN")
  );
  if (postContamination) {
    const reasons: RetentionReasonCode[] = [];
    if (
      input.overlaps.some(
        (overlap) =>
          overlap.affectedWindow === "POST_CAMPAIGN" &&
          overlap.type === "OTHER_RELEASE_PUBLISHED"
      )
    ) {
      reasons.push("OVERLAPPING_RELEASE");
    }
    if (
      input.overlaps.some(
        (overlap) =>
          overlap.affectedWindow === "POST_CAMPAIGN" &&
          overlap.type === "DIFFERENT_RELEASE_CAMPAIGN"
      )
    ) {
      reasons.push("DIFFERENT_RELEASE_CAMPAIGN_OVERLAP");
    }
    overallReasons.push(...reasons);
    postCampaignFloor = overrideWindow(postCampaignFloor, "EXCLUDED", "LOW", reasons);
  }

  let baselineGrowth = calculateBaselineGrowth(baselinePrimary.mean, postCampaignFloor.mean);
  let incrementalLift = calculateIncrementalLift(
    baselinePrimary.mean,
    campaign.sevenDayPeak.value
  );
  let liftRetained = calculateLiftRetained(
    baselinePrimary.mean,
    campaign.sevenDayPeak.value,
    postCampaignFloor.mean
  );
  if (postCampaignFloor.status === "EXCLUDED") {
    baselineGrowth = overrideMetric(baselineGrowth, "EXCLUDED", "LOW", postCampaignFloor.reasonCodes);
    liftRetained = overrideMetric(liftRetained, "EXCLUDED", "LOW", postCampaignFloor.reasonCodes);
  } else if (postCampaignFloor.status === "INSUFFICIENT") {
    baselineGrowth = overrideMetric(
      baselineGrowth,
      "INSUFFICIENT",
      "INSUFFICIENT",
      postCampaignFloor.reasonCodes
    );
    liftRetained = overrideMetric(
      liftRetained,
      "INSUFFICIENT",
      "INSUFFICIENT",
      postCampaignFloor.reasonCodes
    );
  }

  const ratioWindows = {baseline: primaryDates, campaign: campaign.activeDates, post: postDates};
  const rollingMonthlyActiveListenerRatio = ratioSeries(
    "Rolling monthly active listener ratio",
    "monthlyActiveListeners / monthlyListeners",
    dailyRatios(
      input.audienceObservations,
      (row) => row.monthlyActiveListeners,
      (row) => row.monthlyListeners
    ),
    ratioWindows
  );
  const streamsPerListener = ratioSeries(
    "Streams per listener",
    "streams / listeners",
    dailyRatios(input.audienceObservations, (row) => row.streams, (row) => row.listeners),
    ratioWindows
  );
  const saveActionsPerListener = ratioSeries(
    "Save actions per listener",
    "saves / listeners",
    dailyRatios(input.audienceObservations, (row) => row.saves, (row) => row.listeners),
    ratioWindows
  );
  const playlistAddActionsPerListener = ratioSeries(
    "Playlist-add actions per listener",
    "playlistAdds / listeners",
    dailyRatios(input.audienceObservations, (row) => row.playlistAdds, (row) => row.listeners),
    ratioWindows
  );
  const trackPersistence = calculateTrackPersistence(input.trackObservations, input.releaseDate, {
    conflictingTimelines: input.conflictingTrackTimelines,
    incompleteIdentity: input.incompleteTrackIdentity
  });

  const overlapReasons = input.overlaps.flatMap<RetentionReasonCode>((overlap) => {
    if (overlap.type === "OTHER_RELEASE_PUBLISHED") return ["OVERLAPPING_RELEASE"];
    if (overlap.type === "SAME_RELEASE_CAMPAIGN") return ["OVERLAPPING_CAMPAIGN"];
    if (overlap.type === "DIFFERENT_RELEASE_CAMPAIGN") {
      return ["DIFFERENT_RELEASE_CAMPAIGN_OVERLAP"];
    }
    return [];
  });
  overallReasons.push(...overlapReasons);
  if (input.ambiguousReleaseMapping) overallReasons.push("AMBIGUOUS_RELEASE_MAPPING");
  if (input.conflictingTrackTimelines) overallReasons.push("CONFLICTING_TRACK_TIMELINES");
  if (input.reconciliationWarnings.length) overallReasons.push("CROSS_EXPORT_DISCREPANCY");
  if (input.reportPeriodUserEntered) overallReasons.push("REPORT_PERIOD_USER_ENTERED");
  if (input.timezoneUncertain) overallReasons.push("TIMEZONE_UNCERTAIN");
  overallReasons.push(
    ...baselinePrimary.reasonCodes,
    ...campaign.daily.reasonCodes,
    ...postCampaignFloor.reasonCodes,
    ...baselineGrowth.reasonCodes,
    ...incrementalLift.reasonCodes,
    ...liftRetained.reasonCodes
  );

  let status = worstStatus(
    baselinePrimary.status,
    campaign.daily.status,
    campaign.sevenDayPeak.status,
    postCampaignFloor.status,
    baselineGrowth.status,
    incrementalLift.status,
    liftRetained.status
  );
  let confidence = lowerConfidence(
    worstConfidence(
      baselinePrimary.confidence,
      campaign.daily.confidence,
      campaign.sevenDayPeak.confidence,
      postCampaignFloor.confidence
    ),
    "MODERATE"
  );
  if (overlapReasons.length || input.reconciliationWarnings.length || input.timezoneUncertain) {
    confidence = lowerConfidence(confidence, "LOW");
    if (status === "VALID") status = "WARNING";
  }
  if (input.ambiguousReleaseMapping || input.conflictingTrackTimelines || hasOpenCampaign) {
    status = "INSUFFICIENT";
    confidence = "INSUFFICIENT";
  }

  return {
    artistId: input.artistId,
    releaseId: input.releaseId,
    campaignId: input.campaignId,
    formulaVersion: RETENTION_FORMULA_VERSION,
    currentObservationResolutionVersion: CURRENT_OBSERVATION_RESOLUTION_VERSION,
    calculatedAt: input.calculatedAt,
    dataCutoffDate: input.dataCutoffDate,
    status,
    confidence,
    reasonCodes: uniqueReasons(overallReasons),
    interpretation:
      "Post-campaign listener retention is an audience trend correlated with the selected release and campaign windows; it is not verified organic retention or proof that advertising caused the outcome.",
    inputs: {
      releaseDate: input.releaseDate,
      confirmedCampaignIntervals: input.confirmedCampaignIntervals,
      artistObservationCount: input.audienceObservations.length,
      trackObservationCount: input.trackObservations.length
    },
    windows: {
      primaryBaseline: {startDate: primaryDates[0], endDate: primaryDates.at(-1)!},
      recentBaseline: {startDate: recentDates[0], endDate: recentDates.at(-1)!},
      campaignActiveDates: campaign.activeDates,
      postCampaignFloor: {
        startDate: postDates[0] ?? null,
        endDate: postDates.at(-1) ?? null
      }
    },
    baseline: {primary: baselinePrimary, recent: baselineRecent},
    campaign,
    postCampaignFloor,
    growth: {baselineGrowth, incrementalLift, liftRetained},
    audienceRatios: {
      rollingMonthlyActiveListenerRatio,
      streamsPerListener,
      saveActionsPerListener,
      playlistAddActionsPerListener
    },
    followerSnapshotChanges: {
      baseline: snapshotChange("Baseline follower snapshot change", input.audienceObservations, primaryDates),
      campaign: snapshotChange(
        "Campaign follower snapshot change",
        input.audienceObservations,
        campaign.activeDates
      ),
      postCampaign: snapshotChange(
        "Post-campaign follower snapshot change",
        input.audienceObservations,
        postDates
      )
    },
    trackPersistence,
    overlaps: input.overlaps,
    inputImports: input.inputImports,
    inputImportIds: input.inputImports.map((item) => item.importId),
    mappingResolution: input.mappingResolution,
    reconciliationWarnings: input.reconciliationWarnings,
    provenance: [
      ...IMPORTED_AUDIENCE,
      {kind: "IMPORTED" as const, label: "Spotify Track Stream Timeline"},
      {kind: "USER_ENTERED" as const, label: "Confirmed release and campaign calendar dates"},
      ...CALCULATED
    ]
  };
}
