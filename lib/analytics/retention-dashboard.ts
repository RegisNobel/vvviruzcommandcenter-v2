import "server-only";

import {prisma} from "@/lib/db/prisma";
import {
  CANONICAL_ANALYTICS_ARTIST_ID,
  readCanonicalAnalyticsArtist,
  readCurrentAnalyticsDataset
} from "@/lib/repositories/analytics-imports";
import {AdminError} from "@/lib/server/admin-error-response";
import {writeOperationalLog} from "@/lib/server/operational-log";

import {
  addDays,
  datesInclusive,
  mean,
  summarizeWindow
} from "./retention-calculations";
import {
  readReleaseRetentionAnalysisContext,
  RetentionCampaignRequiredError,
  type ReleaseRetentionAnalysisContext
} from "./retention-data";
import {
  RETENTION_CHART_CONTRACT_VERSION,
  type RetentionChartMarker,
  type RetentionChartMarkerKind,
  type RetentionChartPayload,
  type RetentionChartPoint,
  type RetentionChartWindowKind
} from "./retention-chart-contract";
import type {
  DataCompleteness,
  NumericMetric,
  RetentionAnalysisResult,
  RetentionConfidence,
  RetentionProvenance,
  RetentionReasonCode,
  RetentionStatus,
  TrackPersistenceResult,
  WindowStatistics
} from "./retention-types";

export type DashboardConfidence = {
  dataConfidence: RetentionConfidence;
  attributionConfidence: RetentionConfidence;
  overallConfidence: RetentionConfidence;
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: number | null;
  format: "INTEGER" | "DECIMAL" | "PERCENTAGE";
  status: RetentionStatus;
  confidence: RetentionConfidence;
  window: {startDate: string | null; endDate: string | null};
  completeness: DataCompleteness | null;
  provenance: RetentionProvenance[];
  formula: string;
  explanation: string;
  reasonCodes: RetentionReasonCode[];
};

export type DashboardCurrentMetric = {
  id: string;
  label: string;
  value: number | null;
  format: "INTEGER" | "DECIMAL" | "PERCENTAGE";
  sourceType: "IMPORTED" | "CALCULATED";
  source: string;
  metricDate: string | null;
  freshnessLabel: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
};

export type DashboardCampaignChoice = {
  id: string;
  name: string;
  platform: string;
  status: string;
  confirmedIntervalCount: number;
  suggestedIntervalCount: number;
};

export type DashboardReleaseChoice = {
  id: string;
  title: string;
  releaseDate: string;
  campaigns: DashboardCampaignChoice[];
};

export type DashboardInterpretation = {
  status: RetentionStatus;
  headline: string;
  detail: string;
  notes: string[];
};

export type DashboardAnalysis = {
  release: ReleaseRetentionAnalysisContext["release"];
  campaign: ReleaseRetentionAnalysisContext["campaign"];
  analysis: RetentionAnalysisResult;
  confidence: DashboardConfidence;
  interpretation: DashboardInterpretation;
  primaryMetrics: DashboardMetric[];
  trackMetrics: DashboardMetric[];
  chart: RetentionChartPayload;
};

export type DashboardComparisonRow = {
  releaseId: string;
  releaseTitle: string;
  releaseDate: string;
  campaignId: string;
  campaignName: string;
  status: RetentionStatus;
  confidence: DashboardConfidence;
  preReleaseBaseline: number | null;
  campaignPeak: number | null;
  postCampaignFloor: number | null;
  baselineGrowthPercentage: number | null;
  incrementalLift: number | null;
  liftRetainedPercentage: number | null;
  trackPersistencePercentage: number | null;
  completenessPercentage: number;
  calculatedAt: string;
};

export type DashboardSelectionState =
  | "READY"
  | "NO_AUDIENCE_IMPORT"
  | "NO_RELEASE"
  | "NO_CAMPAIGN"
  | "UNCONFIRMED_CAMPAIGN"
  | "AMBIGUOUS_CAMPAIGN"
  | "INVALID_SELECTION"
  | "DATA_UNAVAILABLE";

export type RetentionDashboardData = {
  generatedAt: string;
  canonicalArtist: {id: string; displayName: string; slug: string};
  lastAudienceDataDate: string | null;
  freshness: {status: "CURRENT" | "AGING" | "STALE" | "UNAVAILABLE"; label: string; ageDays: number | null};
  importStatus: {
    status: "CURRENT" | "MISSING";
    currentAudienceImportCount: number;
    latestImportId: string | null;
    normalizedDataRetained: boolean;
    rawFileStatus: "AVAILABLE" | "EXPIRED" | "NOT_RETAINED" | "UNAVAILABLE";
  };
  currentMetrics: DashboardCurrentMetric[];
  audienceTrend: {
    current: WindowStatistics | null;
    previous: WindowStatistics | null;
    absoluteChange: number | null;
    percentageChange: number | null;
    streamsPerListener: number | null;
    activeListenerRatio: number | null;
  };
  releases: DashboardReleaseChoice[];
  selectedReleaseId: string | null;
  selectedCampaignId: string | null;
  rangeDays: 180 | 365 | 1000;
  selectionState: DashboardSelectionState;
  selectionMessage: string;
  analysis: DashboardAnalysis | null;
  comparisonRows: DashboardComparisonRow[];
};

type DashboardQuery = {
  releaseId?: string | null;
  campaignId?: string | null;
  range?: string | null;
  comparisonStatus?: string | null;
  comparisonConfidence?: string | null;
  comparisonRelease?: string | null;
  comparisonCampaign?: string | null;
  comparisonDateFrom?: string | null;
  comparisonDateTo?: string | null;
};

export type RetentionDashboardProfile = {
  rangeDays: number;
  comparisonLimit: number;
  comparisonAnalysisCount: number;
  estimatedQueryCount: number;
  currentAudienceLookupMs: number;
  releaseCampaignChoicesMs: number;
  selectedAnalysisCalculationMs: number;
  comparisonCalculationsMs: number;
  chartContextAssemblyMs: number;
  dtoSerializationMs: number;
  payloadBytes: number;
  chartRowCount: number;
  serverDurationMs: number;
};

const IMPORTED_AUDIENCE: RetentionProvenance = {
  kind: "IMPORTED",
  label: "Spotify Artist Audience Timeline"
};
const IMPORTED_TRACK: RetentionProvenance = {
  kind: "IMPORTED",
  label: "Spotify Track Stream Timeline"
};
const CALCULATED: RetentionProvenance = {
  kind: "CALCULATED",
  label: "Server-provided deterministic calculation"
};
const CONFIRMED_DATES: RetentionProvenance = {
  kind: "USER_ENTERED",
  label: "Confirmed release and campaign dates"
};

const DATA_LOW_REASONS = new Set<RetentionReasonCode>([
  "EXCESSIVE_MISSING_DAYS",
  "INCOMPLETE_SOURCE_DATA",
  "CROSS_EXPORT_DISCREPANCY"
]);
const DATA_MODERATE_REASONS = new Set<RetentionReasonCode>([
  "MISSING_BASELINE_DAYS",
  "MISSING_CAMPAIGN_DAYS",
  "TIMEZONE_UNCERTAIN",
  "REPORT_PERIOD_USER_ENTERED"
]);

const EVENT_KIND: Partial<Record<string, RetentionChartMarkerKind>> = {
  RELEASE_PUBLISHED: "RELEASE",
  CAMPAIGN_STARTED: "CAMPAIGN_STARTED",
  CAMPAIGN_PAUSED: "CAMPAIGN_PAUSED",
  CAMPAIGN_RESUMED: "CAMPAIGN_RESUMED",
  CAMPAIGN_ENDED: "CAMPAIGN_ENDED",
  BUDGET_CHANGED: "BUDGET_CHANGED",
  CREATIVE_CHANGED: "CREATIVE_CHANGED",
  AUDIENCE_CHANGED: "AUDIENCE_CHANGED",
  ORGANIC_CONTENT_POSTED: "ORGANIC_CONTENT_POSTED",
  OTHER_RELEASE_PUBLISHED: "OVERLAPPING_RELEASE"
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rangeDays(value: string | null | undefined): 180 | 365 | 1000 {
  return value === "365" ? 365 : value === "1000" ? 1000 : 180;
}

function daysApart(earlier: string, later: string) {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`)) /
        86_400_000
    )
  );
}

function freshnessFor(lastDate: string | null, today: string) {
  if (!lastDate) {
    return {status: "UNAVAILABLE" as const, label: "No audience timeline", ageDays: null};
  }
  const ageDays = daysApart(lastDate, today);
  if (ageDays <= 2) return {status: "CURRENT" as const, label: `${ageDays} days old`, ageDays};
  if (ageDays <= 7) return {status: "AGING" as const, label: `${ageDays} days old`, ageDays};
  return {status: "STALE" as const, label: `${ageDays} days old — import newer data`, ageDays};
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function ratioMap(values: Array<{date: string; value: number}>) {
  return new Map(values.map((item) => [item.date, item.value]));
}

function windowIncludes(date: string, startDate: string | null, endDate: string | null) {
  return Boolean(startDate && endDate && date >= startDate && date <= endDate);
}

function serverMovingAverage(
  dates: string[],
  index: number,
  audienceByDate: Map<string, ReleaseRetentionAnalysisContext["audienceObservations"][number]>
) {
  if (index < 6) return null;
  const values = dates
    .slice(index - 6, index + 1)
    .map((date) => audienceByDate.get(date)?.listeners ?? null);
  return values.every((value): value is number => value !== null) ? mean(values) : null;
}

function markerStatus(analysis: RetentionAnalysisResult, date: string): RetentionStatus {
  if (
    analysis.overlaps.some(
      (overlap) => overlap.eventDate === date && overlap.affectedWindow === "POST_CAMPAIGN"
    )
  ) {
    return "EXCLUDED";
  }
  return "VALID";
}

function dedupeMarkers(markers: RetentionChartMarker[]) {
  const seen = new Set<string>();
  return markers.filter((marker) => {
    const key = `${marker.kind}:${marker.date}:${marker.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildRetentionChartPayload(
  context: ReleaseRetentionAnalysisContext,
  options: {rangeDays?: 180 | 365 | 1000} = {}
): RetentionChartPayload {
  const {analysis} = context;
  const cutoff = analysis.dataCutoffDate ?? context.audienceObservations.at(-1)?.date;
  if (!cutoff) throw new Error("A chart cutoff date is required when analysis data exists.");
  const count = options.rangeDays ?? 180;
  const dates = datesInclusive(addDays(cutoff, -(count - 1)), cutoff);
  const audienceByDate = new Map(context.audienceObservations.map((row) => [row.date, row]));
  const trackByDate = new Map(context.trackObservations.map((row) => [row.date, row]));
  const streamsRatio = ratioMap(analysis.audienceRatios.streamsPerListener.daily);
  const activeRatio = ratioMap(analysis.audienceRatios.rollingMonthlyActiveListenerRatio.daily);
  const savesRatio = ratioMap(analysis.audienceRatios.saveActionsPerListener.daily);
  const playlistRatio = ratioMap(analysis.audienceRatios.playlistAddActionsPerListener.daily);
  const campaignDates = new Set(analysis.windows.campaignActiveDates);
  const points: RetentionChartPoint[] = dates.map((date, index) => {
    const audience = audienceByDate.get(date);
    const track = trackByDate.get(date);
    const windowTags: RetentionChartWindowKind[] = [];
    if (
      windowIncludes(
        date,
        analysis.windows.primaryBaseline.startDate,
        analysis.windows.primaryBaseline.endDate
      )
    ) {
      windowTags.push("BASELINE");
    }
    if (campaignDates.has(date)) windowTags.push("CAMPAIGN");
    if (
      windowIncludes(
        date,
        analysis.windows.postCampaignFloor.startDate,
        analysis.windows.postCampaignFloor.endDate
      )
    ) {
      windowTags.push("POST_CAMPAIGN");
    }
    return {
      date,
      artistListeners: audience?.listeners ?? null,
      listenerMovingAverage7: serverMovingAverage(dates, index, audienceByDate),
      monthlyListeners: audience?.monthlyListeners ?? null,
      monthlyActiveListeners: audience?.monthlyActiveListeners ?? null,
      artistStreams: audience?.streams ?? null,
      trackStreams: track?.streams ?? null,
      streamsPerListener: streamsRatio.get(date) ?? null,
      monthlyActiveListenerRatio: activeRatio.get(date) ?? null,
      saveActionsPerListener: savesRatio.get(date) ?? null,
      playlistAddActionsPerListener: playlistRatio.get(date) ?? null,
      missing: {artistAudience: !audience, trackStreams: !track},
      windowTags
    };
  });
  const windows: RetentionChartPayload["windows"] = [
    {
      id: "primary-baseline",
      kind: "BASELINE" as const,
      label: "Pre-release baseline",
      startDate: analysis.windows.primaryBaseline.startDate,
      endDate: analysis.windows.primaryBaseline.endDate,
      status: analysis.baseline.primary.status,
      confidence: analysis.baseline.primary.confidence,
      reasonCodes: analysis.baseline.primary.reasonCodes,
      provenance: analysis.baseline.primary.provenance
    },
    ...analysis.inputs.confirmedCampaignIntervals.flatMap((interval, index) =>
      interval.endDate
        ? [
            {
              id: interval.id,
              kind: "CAMPAIGN" as const,
              label: `Campaign interval ${index + 1}`,
              startDate: interval.startDate,
              endDate: interval.endDate,
              status: analysis.campaign.daily.status,
              confidence: analysis.campaign.daily.confidence,
              reasonCodes: analysis.campaign.daily.reasonCodes,
              provenance: [CONFIRMED_DATES]
            }
          ]
        : []
    ),
    ...(analysis.windows.postCampaignFloor.startDate && analysis.windows.postCampaignFloor.endDate
      ? [
          {
            id: "post-campaign-floor",
            kind: "POST_CAMPAIGN" as const,
            label:
              analysis.postCampaignFloor.status === "EXCLUDED"
                ? "Excluded post-campaign floor"
                : "Post-campaign floor",
            startDate: analysis.windows.postCampaignFloor.startDate,
            endDate: analysis.windows.postCampaignFloor.endDate,
            status: analysis.postCampaignFloor.status,
            confidence: analysis.postCampaignFloor.confidence,
            reasonCodes: analysis.postCampaignFloor.reasonCodes,
            provenance: analysis.postCampaignFloor.provenance
          }
        ]
      : [])
  ].filter((window) => window.startDate <= cutoff && window.endDate >= dates[0]);
  const eventMarkers = context.timelineEvents.flatMap<RetentionChartMarker>((event) => {
    const kind = EVENT_KIND[event.eventType];
    return kind
      ? [
          {
            id: event.id,
            kind,
            date: event.eventDate,
            label: event.title,
            status: markerStatus(analysis, event.eventDate),
            provenance: [CONFIRMED_DATES]
          }
        ]
      : [];
  });
  const overlapMarkers = analysis.overlaps.flatMap<RetentionChartMarker>((overlap, index) =>
    overlap.eventDate
      ? [
          {
            id: `overlap-${index}`,
            kind: "OVERLAPPING_RELEASE",
            date: overlap.eventDate,
            label: overlap.releaseTitle
              ? `${overlap.releaseTitle} published`
              : "Another release published",
            status: overlap.affectedWindow === "POST_CAMPAIGN" ? "EXCLUDED" : "WARNING",
            provenance: [CONFIRMED_DATES]
          }
        ]
      : []
  );
  const peakMarkers: RetentionChartMarker[] = [
    ...(analysis.campaign.oneDayMaximumDate
      ? [
          {
            id: "one-day-peak",
            kind: "ONE_DAY_PEAK" as const,
            date: analysis.campaign.oneDayMaximumDate,
            label: "Campaign one-day maximum",
            status: analysis.campaign.oneDayMaximum.status,
            provenance: analysis.campaign.oneDayMaximum.provenance
          }
        ]
      : []),
    ...(analysis.campaign.sevenDayPeakEndDate
      ? [
          {
            id: "seven-day-peak",
            kind: "SEVEN_DAY_PEAK" as const,
            date: analysis.campaign.sevenDayPeakEndDate,
            label: "Campaign seven-day peak",
            status: analysis.campaign.sevenDayPeak.status,
            provenance: analysis.campaign.sevenDayPeak.provenance
          }
        ]
      : [])
  ];
  const markers = dedupeMarkers([
    {
      id: "release-date",
      kind: "RELEASE",
      date: context.release.releaseDate,
      label: `${context.release.title} published`,
      status: "VALID",
      provenance: [CONFIRMED_DATES]
    },
    ...eventMarkers,
    ...overlapMarkers,
    ...peakMarkers
  ]).filter((marker) => marker.date >= dates[0] && marker.date <= cutoff);
  const gapDates = points.filter((point) => point.missing.artistAudience).map((point) => point.date);
  const presentDays = points.length - gapDates.length;
  const gapsAffectConfidence = analysis.reasonCodes.some((reason) =>
    ["MISSING_BASELINE_DAYS", "MISSING_CAMPAIGN_DAYS", "MISSING_POST_WINDOW", "EXCESSIVE_MISSING_DAYS"].includes(reason)
  );
  return {
    contractVersion: RETENTION_CHART_CONTRACT_VERSION,
    series: points,
    windows,
    campaignIntervals: analysis.inputs.confirmedCampaignIntervals.map((interval, index) => ({
      id: interval.id,
      label: `Confirmed interval ${index + 1}`,
      startDate: interval.startDate,
      endDate: interval.endDate,
      timezone: interval.timezone,
      confirmationStatus: "CONFIRMED",
      provenance: [CONFIRMED_DATES]
    })),
    markers,
    analysis: {
      formulaVersion: analysis.formulaVersion,
      currentObservationResolutionVersion: analysis.currentObservationResolutionVersion,
      calculatedAt: analysis.calculatedAt,
      dataCutoffDate: cutoff,
      status: analysis.status,
      confidence: analysis.confidence,
      reasonCodes: analysis.reasonCodes,
      interpretation: analysis.interpretation,
      provenance: analysis.provenance
    },
    seriesDefinitions: [
      {key: "artistListeners", label: "Daily artist listeners", formula: "Imported daily value; missing remains null", provenance: [IMPORTED_AUDIENCE]},
      {key: "listenerMovingAverage7", label: "Seven-day listener average", formula: "Server-provided mean of seven consecutive present daily values", provenance: [IMPORTED_AUDIENCE, CALCULATED]},
      {key: "monthlyListeners", label: "Rolling monthly listeners", formula: "Imported rolling metric", provenance: [IMPORTED_AUDIENCE]},
      {key: "monthlyActiveListeners", label: "Rolling monthly active listeners", formula: "Imported rolling metric", provenance: [IMPORTED_AUDIENCE]},
      {key: "artistStreams", label: "Daily artist streams", formula: "Imported daily value", provenance: [IMPORTED_AUDIENCE]},
      {key: "trackStreams", label: "Daily track streams", formula: "Imported daily track value; not listener retention", provenance: [IMPORTED_TRACK]},
      {key: "streamsPerListener", label: "Streams per listener", formula: analysis.audienceRatios.streamsPerListener.formula, provenance: analysis.audienceRatios.streamsPerListener.provenance},
      {key: "monthlyActiveListenerRatio", label: "Rolling active-listener ratio", formula: analysis.audienceRatios.rollingMonthlyActiveListenerRatio.formula, provenance: analysis.audienceRatios.rollingMonthlyActiveListenerRatio.provenance},
      {key: "saveActionsPerListener", label: "Save actions per listener", formula: analysis.audienceRatios.saveActionsPerListener.formula, provenance: analysis.audienceRatios.saveActionsPerListener.provenance},
      {key: "playlistAddActionsPerListener", label: "Playlist-add actions per listener", formula: analysis.audienceRatios.playlistAddActionsPerListener.formula, provenance: analysis.audienceRatios.playlistAddActionsPerListener.provenance}
    ],
    accessibilitySummary: {
      title: `${context.release.title} audience and track timeline`,
      description: `${context.campaign.name} has ${analysis.inputs.confirmedCampaignIntervals.length} confirmed campaign interval${analysis.inputs.confirmedCampaignIntervals.length === 1 ? "" : "s"}. ${gapDates.length} audience date${gapDates.length === 1 ? " is" : "s are"} missing in the selected range. ${analysis.interpretation}`,
      gapDates,
      gapCount: gapDates.length,
      completenessPercentage: points.length ? (presentDays / points.length) * 100 : 0,
      gapsAffectConfidence,
      excludedWindowLabels: windows.filter((window) => window.status === "EXCLUDED").map((window) => window.label)
    }
  };
}

export function shapeDashboardConfidence(analysis: RetentionAnalysisResult): DashboardConfidence {
  const reasons = new Set(analysis.reasonCodes);
  let dataConfidence: RetentionConfidence = "HIGH";
  if (reasons.has("AMBIGUOUS_RELEASE_MAPPING") || reasons.has("CONFLICTING_TRACK_TIMELINES")) {
    dataConfidence = "INSUFFICIENT";
  } else if ([...DATA_LOW_REASONS].some((reason) => reasons.has(reason))) {
    dataConfidence = "LOW";
  } else if ([...DATA_MODERATE_REASONS].some((reason) => reasons.has(reason))) {
    dataConfidence = "MODERATE";
  }
  let attributionConfidence: RetentionConfidence = "MODERATE";
  if (
    reasons.has("OPEN_CAMPAIGN") ||
    reasons.has("FUTURE_WINDOW_INCOMPLETE") ||
    reasons.has("AMBIGUOUS_RELEASE_MAPPING")
  ) {
    attributionConfidence = "INSUFFICIENT";
  } else if (
    reasons.has("OVERLAPPING_RELEASE") ||
    reasons.has("DIFFERENT_RELEASE_CAMPAIGN_OVERLAP") ||
    reasons.has("TIMEZONE_UNCERTAIN")
  ) {
    attributionConfidence = "LOW";
  }
  return {
    dataConfidence,
    attributionConfidence,
    overallConfidence: analysis.confidence
  };
}

function percentageText(value: number | null) {
  return value === null ? null : `${new Intl.NumberFormat("en-US", {maximumFractionDigits: 1}).format(value)}%`;
}

export function buildDashboardInterpretation(
  analysis: RetentionAnalysisResult
): DashboardInterpretation {
  const reasons = new Set(analysis.reasonCodes);
  const notes: string[] = [];
  if (reasons.has("OVERLAPPING_CAMPAIGN")) {
    notes.push("Another campaign for this release overlaps a measured window.");
  }
  if (reasons.has("DIFFERENT_RELEASE_CAMPAIGN_OVERLAP")) {
    notes.push("A different release campaign overlaps a measured window.");
  }
  if (reasons.has("MISSING_BASELINE_DAYS") || reasons.has("MISSING_CAMPAIGN_DAYS")) {
    notes.push("Missing dates remain gaps and reduce data confidence.");
  }
  if (reasons.has("TIMEZONE_UNCERTAIN")) {
    notes.push("Campaign evidence includes timezone uncertainty.");
  }
  if (reasons.has("CONFLICTING_TRACK_TIMELINES")) {
    notes.push("Conflicting track identities are not merged; track persistence is unavailable.");
  }
  if (reasons.has("AMBIGUOUS_RELEASE_MAPPING")) {
    notes.push("Current release mapping is ambiguous and must be resolved before interpretation.");
  }
  if (reasons.has("NON_POSITIVE_INCREMENTAL_LIFT")) {
    notes.push("The campaign peak did not create positive measured lift above baseline.");
  }
  if (reasons.has("LIFT_RETAINED_ABOVE_100")) {
    notes.push("Lift retained is above 100% because the measured floor exceeded the campaign lift reference; it is not clamped.");
  }
  if (reasons.has("FLOOR_BELOW_BASELINE")) {
    notes.push("The measured post-campaign floor is below the pre-release baseline.");
  }
  if (reasons.has("OPEN_CAMPAIGN")) {
    return {
      status: "INSUFFICIENT",
      headline: "The selected campaign is still open.",
      detail: "Current campaign metrics remain visible, but a final post-campaign listener floor and lift-retained value cannot be calculated.",
      notes
    };
  }
  if (reasons.has("FUTURE_WINDOW_INCOMPLETE")) {
    return {
      status: "INSUFFICIENT",
      headline: "The full post-campaign window is not available yet.",
      detail: analysis.windows.postCampaignFloor.endDate
        ? `The final floor can be evaluated after ${analysis.windows.postCampaignFloor.endDate}. No unavailable value is shown as zero.`
        : "The final floor window cannot yet be evaluated.",
      notes
    };
  }
  if (reasons.has("OVERLAPPING_RELEASE")) {
    return {
      status: "EXCLUDED",
      headline: "The post-campaign floor is excluded from retention interpretation.",
      detail: "A release occurred inside the floor window. The raw measured floor is shown for context, but it is not attributed to this campaign.",
      notes
    };
  }
  if (analysis.status === "INSUFFICIENT") {
    return {
      status: "INSUFFICIENT",
      headline: "The analysis is not complete enough for retention interpretation.",
      detail: "Review the missing inputs, campaign confirmation, mapping, and conflict reasons below.",
      notes
    };
  }
  const growth = percentageText(analysis.growth.baselineGrowth.percentage);
  return {
    status: analysis.status,
    headline: growth
      ? `The measured post-campaign listener floor is ${growth} relative to the pre-release baseline.`
      : "Measured audience behavior is available for the selected windows.",
    detail:
      analysis.status === "WARNING"
        ? "The values are shown without clamping, but warnings limit how confidently the windows can be compared."
        : "This is measured post-campaign retention context, not proof that advertising caused the observed audience change.",
    notes
  };
}

function metricFromWindow(id: string, value: WindowStatistics, explanation: string): DashboardMetric {
  return {
    id,
    label: value.label,
    value: value.mean,
    format: "INTEGER",
    status: value.status,
    confidence: value.confidence,
    window: {startDate: value.completeness.startDate, endDate: value.completeness.endDate},
    completeness: value.completeness,
    provenance: value.provenance,
    formula: value.formula,
    explanation,
    reasonCodes: value.reasonCodes
  };
}

function metricFromNumeric(
  id: string,
  value: NumericMetric,
  window: {startDate: string | null; endDate: string | null},
  completeness: DataCompleteness | null,
  format: DashboardMetric["format"],
  explanation: string
): DashboardMetric {
  return {
    id,
    label: value.label,
    value: format === "PERCENTAGE" ? value.percentage : value.value,
    format,
    status: value.status,
    confidence: value.confidence,
    window,
    completeness,
    provenance: value.provenance,
    formula: value.formula,
    explanation: value.explanation ?? explanation,
    reasonCodes: value.reasonCodes
  };
}

function primaryMetrics(analysis: RetentionAnalysisResult): DashboardMetric[] {
  return [
    metricFromWindow("primary-baseline", analysis.baseline.primary, "Mean daily listeners across the 28 days before release."),
    metricFromWindow("recent-baseline", analysis.baseline.recent, "Mean daily listeners across the final seven days before release."),
    metricFromWindow("campaign-average", analysis.campaign.daily, "Mean daily listeners on confirmed campaign-active dates only."),
    metricFromNumeric("campaign-peak", analysis.campaign.sevenDayPeak, {startDate: analysis.campaign.sevenDayPeakStartDate, endDate: analysis.campaign.sevenDayPeakEndDate}, analysis.campaign.daily.completeness, "INTEGER", "Highest complete seven-day listener average inside one confirmed interval."),
    metricFromNumeric("campaign-final", analysis.campaign.finalSevenDayAverage, {startDate: analysis.campaign.finalSevenActiveDates[0] ?? null, endDate: analysis.campaign.finalSevenActiveDates.at(-1) ?? null}, analysis.campaign.daily.completeness, "INTEGER", "Mean of the final seven confirmed active dates; paused dates are excluded."),
    metricFromWindow("post-floor", analysis.postCampaignFloor, "Daily listener values are summarized across campaign days 14 through 28; the Stage 7 window statistic is shown unchanged."),
    metricFromNumeric("baseline-growth", analysis.growth.baselineGrowth, analysis.windows.postCampaignFloor, analysis.postCampaignFloor.completeness, "PERCENTAGE", "Measured floor change relative to the pre-release baseline."),
    metricFromNumeric("incremental-lift", analysis.growth.incrementalLift, {startDate: analysis.campaign.sevenDayPeakStartDate, endDate: analysis.campaign.sevenDayPeakEndDate}, analysis.campaign.daily.completeness, "INTEGER", "Campaign seven-day peak minus pre-release baseline."),
    metricFromNumeric("lift-retained", analysis.growth.liftRetained, analysis.windows.postCampaignFloor, analysis.postCampaignFloor.completeness, "PERCENTAGE", "Share of measured campaign lift remaining in the post-campaign floor; not causal attribution.")
  ];
}

function trackMetrics(track: TrackPersistenceResult): DashboardMetric[] {
  return [
    metricFromWindow("track-launch", track.launchSevenDays, "Average daily track streams during release days 1 through 7."),
    metricFromWindow("track-days-14-28", track.days14To28, "Average daily track streams during release days 14 through 28."),
    metricFromWindow("track-latest", track.latestSevenDays, "Latest seven consecutive available track-stream days."),
    {
      id: "track-peak",
      label: "Peak daily track streams",
      value: track.peakDailyStreams,
      format: "INTEGER",
      status: track.status,
      confidence: track.confidence,
      window: {startDate: track.peakDate, endDate: track.peakDate},
      completeness: null,
      provenance: track.provenance,
      formula: "Maximum imported daily track streams.",
      explanation: "Peak stream activity for the resolved track timeline.",
      reasonCodes: track.reasonCodes
    },
    metricFromNumeric("track-persistence", track.persistenceRatio, {startDate: track.days14To28.completeness.startDate, endDate: track.days14To28.completeness.endDate}, track.days14To28.completeness, "PERCENTAGE", "Days 14–28 average divided by launch seven-day average."),
    metricFromNumeric("track-latest-launch", track.latestVersusLaunchRatio, {startDate: track.latestSevenDays.completeness.startDate, endDate: track.latestSevenDays.completeness.endDate}, track.latestSevenDays.completeness, "PERCENTAGE", "Latest seven-day average divided by launch seven-day average.")
  ];
}

export function shapeDashboardAnalysis(
  context: ReleaseRetentionAnalysisContext,
  options: {rangeDays?: 180 | 365 | 1000} = {}
): DashboardAnalysis {
  return {
    release: context.release,
    campaign: context.campaign,
    analysis: context.analysis,
    confidence: shapeDashboardConfidence(context.analysis),
    interpretation: buildDashboardInterpretation(context.analysis),
    primaryMetrics: primaryMetrics(context.analysis),
    trackMetrics: trackMetrics(context.analysis.trackPersistence),
    chart: buildRetentionChartPayload(context, options)
  };
}

function currentMetrics(
  latest: ReleaseRetentionAnalysisContext["audienceObservations"][number] | null,
  freshnessLabel: string
): DashboardCurrentMetric[] {
  const imported = (id: string, label: string, value: number | null): DashboardCurrentMetric => ({
    id,
    label,
    value,
    format: "INTEGER",
    sourceType: "IMPORTED",
    source: "Spotify Artist Audience Timeline",
    metricDate: latest?.date ?? null,
    freshnessLabel,
    availability: value === null ? "UNAVAILABLE" : "AVAILABLE"
  });
  const calculated = (id: string, label: string, value: number | null, format: DashboardCurrentMetric["format"]): DashboardCurrentMetric => ({
    id,
    label,
    value,
    format,
    sourceType: "CALCULATED",
    source: "Calculated from the same-date imported values",
    metricDate: latest?.date ?? null,
    freshnessLabel,
    availability: value === null ? "UNAVAILABLE" : "AVAILABLE"
  });
  return [
    imported("listeners", "Daily listeners", latest?.listeners ?? null),
    imported("monthly-listeners", "Monthly listeners", latest?.monthlyListeners ?? null),
    imported("monthly-active", "Monthly active listeners", latest?.monthlyActiveListeners ?? null),
    imported("streams", "Daily streams", latest?.streams ?? null),
    calculated("streams-per-listener", "Streams per listener", latest ? ratio(latest.streams, latest.listeners) : null, "DECIMAL"),
    imported("saves", "Save actions", latest?.saves ?? null),
    imported("playlist-adds", "Playlist-add actions", latest?.playlistAdds ?? null),
    imported("followers", "Followers", latest?.followers ?? null),
    calculated("active-ratio", "Rolling active-listener ratio", latest ? ratio(latest.monthlyActiveListeners, latest.monthlyListeners) : null, "PERCENTAGE")
  ];
}

function audienceTrend(
  rows: ReleaseRetentionAnalysisContext["audienceObservations"],
  cutoff: string | null
): RetentionDashboardData["audienceTrend"] {
  if (!cutoff) {
    return {current: null, previous: null, absoluteChange: null, percentageChange: null, streamsPerListener: null, activeListenerRatio: null};
  }
  const currentDates = datesInclusive(addDays(cutoff, -27), cutoff);
  const previousDates = datesInclusive(addDays(cutoff, -55), addDays(cutoff, -28));
  const current = summarizeWindow("Current comparable 28-day listener baseline", rows, currentDates, (row) => row.listeners, "MISSING_BASELINE_DAYS", [IMPORTED_AUDIENCE, CALCULATED]);
  const previous = summarizeWindow("Previous comparable 28-day listener baseline", rows, previousDates, (row) => row.listeners, "MISSING_BASELINE_DAYS", [IMPORTED_AUDIENCE, CALCULATED]);
  const absoluteChange = current.mean !== null && previous.mean !== null ? current.mean - previous.mean : null;
  const percentageChange = absoluteChange !== null && previous.mean && previous.mean > 0 ? (absoluteChange / previous.mean) * 100 : null;
  const latest = rows.at(-1) ?? null;
  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    streamsPerListener: latest ? ratio(latest.streams, latest.listeners) : null,
    activeListenerRatio: latest ? ratio(latest.monthlyActiveListeners, latest.monthlyListeners) : null
  };
}

function comparisonCompleteness(analysis: RetentionAnalysisResult) {
  const values = [
    analysis.baseline.primary.completeness.completenessPercentage,
    analysis.campaign.daily.completeness.completenessPercentage,
    analysis.postCampaignFloor.completeness.expectedDateCount
      ? analysis.postCampaignFloor.completeness.completenessPercentage
      : null
  ].filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : 0;
}

async function comparisonRows(
  releases: DashboardReleaseChoice[],
  query: DashboardQuery,
  now: Date,
  limit: number,
  currentDataset: Awaited<ReturnType<typeof readCurrentAnalyticsDataset>>,
  contextCache: Map<string, ReleaseRetentionAnalysisContext>
) {
  const pairs = releases
    .flatMap((release) =>
      release.campaigns
        .filter((campaign) => campaign.confirmedIntervalCount > 0)
        .map((campaign) => ({release, campaign}))
    )
    .slice(0, limit);
  let analysisFetchCount = 0;
  const settled = await Promise.allSettled(
    pairs.map(async ({release, campaign}) => {
      const key = `${release.id}:${campaign.id}`;
      const cached = contextCache.get(key);
      if (cached) return cached;
      analysisFetchCount += 1;
      const context = await readReleaseRetentionAnalysisContext(release.id, {
        campaignId: campaign.id,
        now,
        currentDataset
      });
      contextCache.set(key, context);
      return context;
    })
  );
  const rows = settled
    .flatMap<DashboardComparisonRow>((result) => {
      if (result.status !== "fulfilled") return [];
      const {analysis, release, campaign} = result.value;
      const confidence = shapeDashboardConfidence(analysis);
      return [{
        releaseId: release.id,
        releaseTitle: release.title,
        releaseDate: release.releaseDate,
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: analysis.status,
        confidence,
        preReleaseBaseline: analysis.baseline.primary.mean,
        campaignPeak: analysis.campaign.sevenDayPeak.value,
        postCampaignFloor: analysis.postCampaignFloor.mean,
        baselineGrowthPercentage: analysis.growth.baselineGrowth.percentage,
        incrementalLift: analysis.growth.incrementalLift.value,
        liftRetainedPercentage: analysis.growth.liftRetained.percentage,
        trackPersistencePercentage: analysis.trackPersistence.persistenceRatio.percentage,
        completenessPercentage: comparisonCompleteness(analysis),
        calculatedAt: analysis.calculatedAt
      }];
    })
    .filter((row) => !query.comparisonStatus || row.status === query.comparisonStatus)
    .filter((row) => !query.comparisonConfidence || row.confidence.dataConfidence === query.comparisonConfidence)
    .filter((row) => !query.comparisonRelease || row.releaseId === query.comparisonRelease)
    .filter((row) => !query.comparisonCampaign || row.campaignId === query.comparisonCampaign)
    .filter((row) => !query.comparisonDateFrom || row.releaseDate >= query.comparisonDateFrom)
    .filter((row) => !query.comparisonDateTo || row.releaseDate <= query.comparisonDateTo)
    .sort((left, right) => right.releaseDate.localeCompare(left.releaseDate));
  return {
    rows,
    analysisCount: pairs.length,
    analysisFetchCount
  };
}

function selectionError(error: unknown): {state: DashboardSelectionState; message: string} {
  if (error instanceof RetentionCampaignRequiredError) {
    return {
      state: error.campaigns.length ? "AMBIGUOUS_CAMPAIGN" : "NO_CAMPAIGN",
      message: error.message
    };
  }
  if (error instanceof AdminError) {
    if (error.code === "RETENTION_CAMPAIGN_RELEASE_MISMATCH" || error.code === "RETENTION_CAMPAIGN_NOT_FOUND") {
      return {state: "INVALID_SELECTION", message: error.message};
    }
    return {state: "DATA_UNAVAILABLE", message: error.message};
  }
  throw error;
}

export async function readRetentionDashboard(
  query: DashboardQuery = {},
  options: {
    now?: Date;
    includeComparison?: boolean;
    comparisonLimit?: number;
    onProfile?: (profile: RetentionDashboardProfile) => void;
  } = {}
): Promise<RetentionDashboardData> {
  const serverStartedAt = performance.now();
  const now = options.now ?? new Date();
  const today = dateOnly(now);
  const artistStartedAt = performance.now();
  const artist = await readCanonicalAnalyticsArtist();
  const datasetStartedAt = performance.now();
  let datasetDurationMs = 0;
  const datasetPromise = readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID).then((value) => {
    datasetDurationMs = performance.now() - datasetStartedAt;
    return value;
  });
  const releasesStartedAt = performance.now();
  let releaseCampaignChoicesMs = 0;
  const releaseRecordsPromise = prisma.release.findMany({
      where: {
        releaseDate: {not: null, lte: now},
        OR: [
          {primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID},
          {primaryArtistProfileId: null, catalogScope: "VVVIRUZ"}
        ]
      },
      orderBy: [{releaseDate: "desc"}, {title: "asc"}],
      select: {
        id: true,
        title: true,
        releaseDate: true,
        promotionCampaigns: {
          where: {status: {not: "ARCHIVED"}},
          orderBy: [{updatedAt: "desc"}, {id: "asc"}],
          select: {
            id: true,
            name: true,
            platform: true,
            status: true,
            activeIntervals: {
              where: {supersededBy: null},
              select: {confirmationStatus: true}
            }
          }
        }
      }
    }).then((value) => {
      releaseCampaignChoicesMs = performance.now() - releasesStartedAt;
      return value;
    });
  const [dataset, releaseRecords] = await Promise.all([datasetPromise, releaseRecordsPromise]);
  const currentAudienceLookupMs = datasetDurationMs + (datasetStartedAt - artistStartedAt);
  const releases: DashboardReleaseChoice[] = releaseRecords.map((release) => ({
    id: release.id,
    title: release.title,
    releaseDate: dateOnly(release.releaseDate!),
    campaigns: release.promotionCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      status: campaign.status,
      confirmedIntervalCount: campaign.activeIntervals.filter((item) => item.confirmationStatus === "CONFIRMED").length,
      suggestedIntervalCount: campaign.activeIntervals.filter((item) => item.confirmationStatus === "SUGGESTED").length
    }))
  }));
  const selectedRelease = query.releaseId
    ? releases.find((release) => release.id === query.releaseId) ?? null
    : releases.find((release) => release.campaigns.some((campaign) => campaign.confirmedIntervalCount > 0)) ??
      releases[0] ??
      null;
  const selectedCampaign = selectedRelease
    ? query.campaignId
      ? selectedRelease.campaigns.find((campaign) => campaign.id === query.campaignId) ?? null
      : selectedRelease.campaigns.length === 1
        ? selectedRelease.campaigns[0]
        : null
    : null;
  const audienceRows = dataset.artistMetricObservations
    .map((row) => ({
      date: dateOnly(row.metricDate),
      listeners: row.listeners,
      monthlyListeners: row.monthlyListeners,
      monthlyActiveListeners: row.monthlyActiveListeners,
      streams: row.streams,
      playlistAdds: row.playlistAdds,
      saves: row.saves,
      followers: row.followers,
      importId: row.importId
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = audienceRows.at(-1) ?? null;
  const freshness = freshnessFor(latest?.date ?? null, today);
  const audienceImports = dataset.imports.filter((item) => item.importType === "ARTIST_AUDIENCE_TIMELINE");
  const latestImport = audienceImports[0] ?? null;
  const rawFileStatus = !latestImport
    ? "UNAVAILABLE" as const
    : latestImport.rawFileDeletedAt || (latestImport.rawFileExpiresAt && latestImport.rawFileExpiresAt < now)
      ? "EXPIRED" as const
      : latestImport.rawFileStorageKey
        ? "AVAILABLE" as const
        : "NOT_RETAINED" as const;
  let selectionState: DashboardSelectionState = "READY";
  let selectionMessage = "Analysis is ready from current resolved observations.";
  let shapedAnalysis: DashboardAnalysis | null = null;
  const contextCache = new Map<string, ReleaseRetentionAnalysisContext>();
  let selectedAnalysisCalculationMs = 0;
  let chartContextAssemblyMs = 0;
  if (!audienceRows.length) {
    selectionState = "NO_AUDIENCE_IMPORT";
    selectionMessage = "Import a Spotify Artist Audience Timeline before calculating retention.";
  } else if (!selectedRelease) {
    selectionState = "NO_RELEASE";
    selectionMessage = "No eligible released catalog item is available for analysis.";
  } else if (!selectedRelease.campaigns.length) {
    selectionState = "NO_CAMPAIGN";
    selectionMessage = "This release has no campaign. Confirmed campaign dates are required.";
  } else if (!selectedCampaign) {
    selectionState = query.campaignId ? "INVALID_SELECTION" : "AMBIGUOUS_CAMPAIGN";
    selectionMessage = query.campaignId
      ? "The selected campaign does not belong to this release."
      : "This release has multiple campaigns. Select one explicitly.";
  } else if (!selectedCampaign.confirmedIntervalCount) {
    selectionState = selectedCampaign.suggestedIntervalCount ? "UNCONFIRMED_CAMPAIGN" : "NO_CAMPAIGN";
    selectionMessage = selectedCampaign.suggestedIntervalCount
      ? "Suggested intervals cannot feed calculations. Confirm an interval and timezone first."
      : "The selected campaign has no confirmed active interval.";
  } else {
    try {
      const analysisStartedAt = performance.now();
      const context = await readReleaseRetentionAnalysisContext(selectedRelease.id, {
        campaignId: selectedCampaign.id,
        now,
        currentDataset: dataset
      });
      contextCache.set(`${selectedRelease.id}:${selectedCampaign.id}`, context);
      selectedAnalysisCalculationMs = performance.now() - analysisStartedAt;
      const chartStartedAt = performance.now();
      shapedAnalysis = shapeDashboardAnalysis(context, {rangeDays: rangeDays(query.range)});
      chartContextAssemblyMs = performance.now() - chartStartedAt;
    } catch (error) {
      const resolved = selectionError(error);
      selectionState = resolved.state;
      selectionMessage = resolved.message;
    }
  }
  const comparisonLimit = Math.min(20, Math.max(0, options.comparisonLimit ?? 5));
  const comparisonStartedAt = performance.now();
  const comparisonResult = options.includeComparison === false
    ? {rows: [] as DashboardComparisonRow[], analysisCount: 0, analysisFetchCount: 0}
    : await comparisonRows(releases, query, now, comparisonLimit, dataset, contextCache);
  const comparisonCalculationsMs = performance.now() - comparisonStartedAt;
  const response: RetentionDashboardData = {
    generatedAt: now.toISOString(),
    canonicalArtist: {id: artist.id, displayName: artist.displayName, slug: artist.slug},
    lastAudienceDataDate: latest?.date ?? null,
    freshness,
    importStatus: {
      status: audienceRows.length ? "CURRENT" : "MISSING",
      currentAudienceImportCount: audienceImports.length,
      latestImportId: latestImport?.id ?? null,
      normalizedDataRetained: Boolean(latestImport),
      rawFileStatus
    },
    currentMetrics: currentMetrics(latest, freshness.label),
    audienceTrend: audienceTrend(audienceRows, latest?.date ?? null),
    releases,
    selectedReleaseId: selectedRelease?.id ?? null,
    selectedCampaignId: selectedCampaign?.id ?? null,
    rangeDays: rangeDays(query.range),
    selectionState,
    selectionMessage,
    analysis: shapedAnalysis,
    comparisonRows: comparisonResult.rows
  };
  const serializationStartedAt = performance.now();
  const payloadBytes = Buffer.byteLength(JSON.stringify(response), "utf8");
  const dtoSerializationMs = performance.now() - serializationStartedAt;
  const serverDurationMs = performance.now() - serverStartedAt;
  const estimatedQueryCount = 7 + (shapedAnalysis ? 7 : 0) + comparisonResult.analysisFetchCount * 7;
  const profile: RetentionDashboardProfile = {
    rangeDays: rangeDays(query.range),
    comparisonLimit,
    comparisonAnalysisCount: comparisonResult.analysisCount,
    estimatedQueryCount,
    currentAudienceLookupMs,
    releaseCampaignChoicesMs,
    selectedAnalysisCalculationMs,
    comparisonCalculationsMs,
    chartContextAssemblyMs,
    dtoSerializationMs,
    payloadBytes,
    chartRowCount: shapedAnalysis?.chart.series.length ?? 0,
    serverDurationMs
  };
  options.onProfile?.(profile);
  const slowMs = Number(process.env.ANALYTICS_DASHBOARD_SLOW_MS ?? 2000);
  writeOperationalLog(serverDurationMs >= slowMs ? "warn" : "info", "analytics.dashboard.read", {
    releaseId: selectedRelease?.id ?? null,
    campaignId: selectedCampaign?.id ?? null,
    rangeDays: profile.rangeDays,
    comparisonCount: profile.comparisonAnalysisCount,
    chartRowCount: profile.chartRowCount,
    payloadBytes,
    estimatedQueryCount,
    durationMs: Math.round(serverDurationMs),
    slow: serverDurationMs >= slowMs
  });
  return response;
}

export async function readReleaseRetentionDashboard(
  releaseId: string,
  query: {campaignId?: string | null; range?: string | null} = {},
  options: {now?: Date} = {}
) {
  return readRetentionDashboard(
    {releaseId, campaignId: query.campaignId, range: query.range},
    {...options, includeComparison: false}
  );
}
