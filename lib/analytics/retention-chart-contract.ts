import type {
  RetentionConfidence,
  RetentionProvenance,
  RetentionReasonCode,
  RetentionStatus
} from "./retention-types";

export const RETENTION_CHART_CONTRACT_VERSION = 1 as const;

export type RetentionChartWindowKind = "BASELINE" | "CAMPAIGN" | "POST_CAMPAIGN";
export type RetentionChartMarkerKind =
  | "RELEASE"
  | "OVERLAPPING_RELEASE"
  | "CAMPAIGN_STARTED"
  | "CAMPAIGN_PAUSED"
  | "CAMPAIGN_RESUMED"
  | "CAMPAIGN_ENDED"
  | "BUDGET_CHANGED"
  | "CREATIVE_CHANGED"
  | "AUDIENCE_CHANGED"
  | "ORGANIC_CONTENT_POSTED"
  | "ONE_DAY_PEAK"
  | "SEVEN_DAY_PEAK";

export type RetentionChartPoint = {
  date: string;
  artistListeners: number | null;
  listenerMovingAverage7: number | null;
  monthlyListeners: number | null;
  monthlyActiveListeners: number | null;
  artistStreams: number | null;
  trackStreams: number | null;
  streamsPerListener: number | null;
  monthlyActiveListenerRatio: number | null;
  saveActionsPerListener: number | null;
  playlistAddActionsPerListener: number | null;
  missing: {
    artistAudience: boolean;
    trackStreams: boolean;
  };
  windowTags: RetentionChartWindowKind[];
};

export type RetentionChartWindow = {
  id: string;
  kind: RetentionChartWindowKind;
  label: string;
  startDate: string;
  endDate: string;
  status: RetentionStatus;
  confidence: RetentionConfidence;
  reasonCodes: RetentionReasonCode[];
  provenance: RetentionProvenance[];
};

export type RetentionChartInterval = {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  timezone: string;
  confirmationStatus: "CONFIRMED";
  provenance: RetentionProvenance[];
};

export type RetentionChartMarker = {
  id: string;
  kind: RetentionChartMarkerKind;
  date: string;
  label: string;
  status: RetentionStatus;
  provenance: RetentionProvenance[];
};

export type RetentionChartPayload = {
  contractVersion: typeof RETENTION_CHART_CONTRACT_VERSION;
  series: RetentionChartPoint[];
  windows: RetentionChartWindow[];
  campaignIntervals: RetentionChartInterval[];
  markers: RetentionChartMarker[];
  analysis: {
    formulaVersion: number;
    currentObservationResolutionVersion: number;
    calculatedAt: string;
    dataCutoffDate: string;
    status: RetentionStatus;
    confidence: RetentionConfidence;
    reasonCodes: RetentionReasonCode[];
    interpretation: string;
    provenance: RetentionProvenance[];
  };
  seriesDefinitions: Array<{
    key: keyof Omit<RetentionChartPoint, "date" | "missing" | "windowTags">;
    label: string;
    formula: string;
    provenance: RetentionProvenance[];
  }>;
  accessibilitySummary: {
    title: string;
    description: string;
    gapDates: string[];
    gapCount: number;
    completenessPercentage: number;
    gapsAffectConfidence: boolean;
    excludedWindowLabels: string[];
  };
};
