import {addDays, CALCULATED_PROVENANCE, datesInclusive, summarizeWindow} from "./retention-calculations";
import {uniqueReasons, worstConfidence, worstStatus} from "./retention-confidence";
import type {
  NumericMetric,
  RetentionReasonCode,
  TrackObservationInput,
  TrackPersistenceResult
} from "./retention-types";

function ratioMetric(
  label: string,
  numerator: number | null,
  denominator: number | null,
  formula: string
): NumericMetric {
  const reasonCodes: RetentionReasonCode[] = ["TRACK_STREAMS_NOT_LISTENERS"];
  if (numerator === null || denominator === null || denominator === 0) {
    return {
      label,
      formula,
      value: null,
      percentage: null,
      absoluteDifference: numerator,
      status: "INSUFFICIENT",
      confidence: "INSUFFICIENT",
      reasonCodes: ["FORMULA_INPUT_UNAVAILABLE", ...reasonCodes],
      provenance: [CALCULATED_PROVENANCE]
    };
  }
  const value = numerator / denominator;
  return {
    label,
    formula,
    value,
    percentage: value * 100,
    absoluteDifference: numerator - denominator,
    status: "VALID",
    confidence: "HIGH",
    reasonCodes,
    provenance: [CALCULATED_PROVENANCE]
  };
}

function latestSevenDayWindow(rows: TrackObservationInput[]) {
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  let latest: string[] = [];
  for (let index = 0; index <= dates.length - 7; index += 1) {
    const candidate = dates.slice(index, index + 7);
    if (datesInclusive(candidate[0], candidate[6]).length === 7) latest = candidate;
  }
  const maximumDate = dates.at(-1);
  return latest.length || !maximumDate
    ? latest
    : datesInclusive(addDays(maximumDate, -6), maximumDate);
}

export function calculateTrackPersistence(
  rows: TrackObservationInput[],
  releaseDate: string,
  options: {conflictingTimelines?: boolean; incompleteIdentity?: boolean} = {}
): TrackPersistenceResult {
  const calculationRows = options.conflictingTimelines ? [] : rows;
  const launchDates = datesInclusive(releaseDate, addDays(releaseDate, 6));
  const laterDates = datesInclusive(addDays(releaseDate, 14), addDays(releaseDate, 28));
  const latestDates = latestSevenDayWindow(calculationRows);
  const provenance = [
    {kind: "IMPORTED" as const, label: "Spotify Track Stream Timeline"},
    CALCULATED_PROVENANCE
  ];
  const launch = summarizeWindow(
    "Launch seven-day track streams",
    calculationRows,
    launchDates,
    (row) => row.streams,
    "INCOMPLETE_SOURCE_DATA",
    provenance
  );
  const later = summarizeWindow(
    "Release days 14 through 28 track streams",
    calculationRows,
    laterDates,
    (row) => row.streams,
    "INCOMPLETE_SOURCE_DATA",
    provenance
  );
  const latest = summarizeWindow(
    "Latest seven consecutive track-stream days",
    calculationRows,
    latestDates,
    (row) => row.streams,
    "INCOMPLETE_SOURCE_DATA",
    provenance
  );
  const peak = calculationRows.reduce<TrackObservationInput | null>(
    (best, row) => (!best || row.streams > best.streams ? row : best),
    null
  );
  const persistence = ratioMetric(
    "Days 14-28 versus launch persistence",
    later.mean,
    launch.mean,
    "days14To28Average / launchSevenDayAverage"
  );
  const latestRatio = ratioMetric(
    "Latest seven days versus launch",
    latest.mean,
    launch.mean,
    "latestSevenDayAverage / launchSevenDayAverage"
  );
  const reasons: RetentionReasonCode[] = [
    "TRACK_STREAMS_NOT_LISTENERS",
    ...launch.reasonCodes,
    ...later.reasonCodes,
    ...latest.reasonCodes
  ];
  if (options.conflictingTimelines) reasons.push("CONFLICTING_TRACK_TIMELINES");
  if (options.incompleteIdentity) reasons.push("INCOMPLETE_SOURCE_DATA");
  const status = options.conflictingTimelines
    ? "INSUFFICIENT"
    : worstStatus(launch.status, later.status, latest.status, persistence.status, latestRatio.status);
  const confidence = options.conflictingTimelines
    ? "INSUFFICIENT"
    : worstConfidence(
        launch.confidence,
        later.confidence,
        latest.confidence,
        options.incompleteIdentity ? "LOW" : "HIGH"
      );
  return {
    label: "Track stream persistence",
    status,
    confidence,
    reasonCodes: uniqueReasons(reasons),
    launchSevenDays: launch,
    days14To28: later,
    latestSevenDays: latest,
    peakDailyStreams: peak?.streams ?? null,
    peakDate: peak?.date ?? null,
    persistenceRatio: persistence,
    latestVersusLaunchRatio: latestRatio,
    inputImportIds: [...new Set(rows.map((row) => row.importId))],
    trackIdentity:
      [...new Set(rows.map((row) => row.spotifyTrackId).filter(Boolean))].join(",") || null,
    provenance
  };
}
