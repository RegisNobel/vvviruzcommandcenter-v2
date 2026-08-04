import {CURRENT_OBSERVATION_RESOLUTION_VERSION} from "./analytics-resolution-version";

export const RETENTION_FORMULA_VERSION = 1 as const;
export const RETENTION_STATUSES = ["VALID", "WARNING", "EXCLUDED", "INSUFFICIENT"] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export const RETENTION_CONFIDENCE = ["HIGH", "MODERATE", "LOW", "INSUFFICIENT"] as const;
export type RetentionConfidence = (typeof RETENTION_CONFIDENCE)[number];

export const RETENTION_REASON_CODES = [
  "MISSING_BASELINE_DAYS",
  "MISSING_CAMPAIGN_DAYS",
  "MISSING_POST_WINDOW",
  "OPEN_CAMPAIGN",
  "UNKNOWN_CAMPAIGN_END",
  "ZERO_BASELINE",
  "NON_POSITIVE_INCREMENTAL_LIFT",
  "OVERLAPPING_RELEASE",
  "OVERLAPPING_CAMPAIGN",
  "DIFFERENT_RELEASE_CAMPAIGN_OVERLAP",
  "AMBIGUOUS_RELEASE_MAPPING",
  "CONFLICTING_TRACK_TIMELINES",
  "EXCESSIVE_MISSING_DAYS",
  "INCOMPLETE_SOURCE_DATA",
  "CROSS_EXPORT_DISCREPANCY",
  "TIMEZONE_UNCERTAIN",
  "REPORT_PERIOD_USER_ENTERED",
  "FLOOR_BELOW_BASELINE",
  "LIFT_RETAINED_ABOVE_100",
  "TRACK_STREAMS_NOT_LISTENERS",
  "NO_SOURCE_OF_STREAM_DATA",
  "FORMULA_INPUT_UNAVAILABLE",
  "FUTURE_WINDOW_INCOMPLETE"
] as const;
export type RetentionReasonCode = (typeof RETENTION_REASON_CODES)[number];

export type ProvenanceKind = "IMPORTED" | "CALCULATED" | "USER_ENTERED" | "ESTIMATED";
export type RetentionProvenance = {
  kind: ProvenanceKind;
  label: string;
  sourceId?: string;
  details?: string;
};

export type DataCompleteness = {
  startDate: string | null;
  endDate: string | null;
  expectedDateCount: number;
  presentDateCount: number;
  missingDateCount: number;
  missingDates: string[];
  completenessPercentage: number;
};

export type WindowStatistics = {
  label: string;
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  formula: string;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  standardDeviation: number | null;
  sum: number | null;
  completeness: DataCompleteness;
  provenance: RetentionProvenance[];
};

export type NumericMetric = {
  label: string;
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  formula: string;
  value: number | null;
  percentage: number | null;
  absoluteDifference: number | null;
  explanation?: string;
  provenance: RetentionProvenance[];
};

export type DailyRatioValue = {date: string; numerator: number; denominator: number; value: number};
export type RatioSeries = {
  label: string;
  formula: string;
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  daily: DailyRatioValue[];
  current: DailyRatioValue | null;
  baseline: WindowStatistics;
  campaign: WindowStatistics;
  postCampaign: WindowStatistics;
  provenance: RetentionProvenance[];
};

export type CampaignIntervalInput = {
  id: string;
  startDate: string;
  endDate: string | null;
  timezone: string;
  sourceType: string;
};

export type CampaignMetrics = {
  activeDates: string[];
  activeDayCount: number;
  daily: WindowStatistics;
  oneDayMaximum: NumericMetric;
  oneDayMaximumDate: string | null;
  sevenDayPeak: NumericMetric;
  sevenDayPeakStartDate: string | null;
  sevenDayPeakEndDate: string | null;
  finalSevenDayAverage: NumericMetric;
  finalSevenActiveDates: string[];
};

export type TrackPersistenceResult = {
  label: "Track stream persistence";
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  launchSevenDays: WindowStatistics;
  days14To28: WindowStatistics;
  latestSevenDays: WindowStatistics;
  peakDailyStreams: number | null;
  peakDate: string | null;
  persistenceRatio: NumericMetric;
  latestVersusLaunchRatio: NumericMetric;
  inputImportIds: string[];
  trackIdentity: string | null;
  provenance: RetentionProvenance[];
};

export type RetentionOverlap = {
  type: string;
  releaseId?: string;
  releaseTitle?: string;
  campaignId?: string;
  campaignName?: string;
  startDate?: string | null;
  endDate?: string | null;
  eventDate?: string | null;
  affectedWindow: "BASELINE" | "CAMPAIGN" | "POST_CAMPAIGN" | "FUTURE_REVIEW";
};

export type ImportProvenance = {
  importId: string;
  importType: string;
  parserVersion: string | null;
  normalizationVersion: number;
  acceptedAt: string | null;
  periodDatesUserConfirmed: boolean;
};

export type MappingResolutionEvidence = {
  rowId: string;
  importId: string;
  rowIdentityKey: string;
  mappingStatus: string;
  confirmedReleaseId: string | null;
  mappingConfidence: string;
  mappingVersion: number;
  appliedAliasStatus: string | null;
};

export type RetentionAnalysisResult = {
  artistId: string;
  releaseId: string;
  campaignId: string;
  formulaVersion: typeof RETENTION_FORMULA_VERSION;
  currentObservationResolutionVersion: typeof CURRENT_OBSERVATION_RESOLUTION_VERSION;
  calculatedAt: string;
  dataCutoffDate: string | null;
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  interpretation: string;
  inputs: {
    releaseDate: string;
    confirmedCampaignIntervals: CampaignIntervalInput[];
    artistObservationCount: number;
    trackObservationCount: number;
  };
  windows: {
    primaryBaseline: {startDate: string; endDate: string};
    recentBaseline: {startDate: string; endDate: string};
    campaignActiveDates: string[];
    postCampaignFloor: {startDate: string | null; endDate: string | null};
  };
  baseline: {primary: WindowStatistics; recent: WindowStatistics};
  campaign: CampaignMetrics;
  postCampaignFloor: WindowStatistics;
  growth: {baselineGrowth: NumericMetric; incrementalLift: NumericMetric; liftRetained: NumericMetric};
  audienceRatios: {
    rollingMonthlyActiveListenerRatio: RatioSeries;
    streamsPerListener: RatioSeries;
    saveActionsPerListener: RatioSeries;
    playlistAddActionsPerListener: RatioSeries;
  };
  followerSnapshotChanges: {
    baseline: NumericMetric;
    campaign: NumericMetric;
    postCampaign: NumericMetric;
  };
  trackPersistence: TrackPersistenceResult;
  overlaps: RetentionOverlap[];
  inputImports: ImportProvenance[];
  inputImportIds: string[];
  mappingResolution: MappingResolutionEvidence[];
  reconciliationWarnings: Array<{importId: string; key: string; severity: string; message: string}>;
  provenance: RetentionProvenance[];
};

export type AudienceObservationInput = {
  date: string;
  listeners: number;
  monthlyListeners: number;
  monthlyActiveListeners: number;
  streams: number;
  playlistAdds: number;
  saves: number;
  followers: number;
  importId: string;
};

export type TrackObservationInput = {
  date: string;
  streams: number;
  importId: string;
  spotifyTrackId: string | null;
};

export type RetentionCalculationInput = {
  artistId: string;
  releaseId: string;
  campaignId: string;
  releaseDate: string;
  confirmedCampaignIntervals: CampaignIntervalInput[];
  audienceObservations: AudienceObservationInput[];
  trackObservations: TrackObservationInput[];
  overlaps: RetentionOverlap[];
  inputImports: ImportProvenance[];
  mappingResolution: MappingResolutionEvidence[];
  reconciliationWarnings: RetentionAnalysisResult["reconciliationWarnings"];
  dataCutoffDate: string | null;
  calculatedAt: string;
  conflictingTrackTimelines: boolean;
  incompleteTrackIdentity: boolean;
  ambiguousReleaseMapping: boolean;
  reportPeriodUserEntered: boolean;
  timezoneUncertain: boolean;
};
