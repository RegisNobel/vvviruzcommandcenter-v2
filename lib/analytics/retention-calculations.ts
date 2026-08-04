import {completenessAssessment, uniqueReasons} from "./retention-confidence";
import type {AudienceObservationInput, CampaignIntervalInput, CampaignMetrics, DailyRatioValue, NumericMetric, RetentionProvenance, RetentionReasonCode, WindowStatistics} from "./retention-types";

const DAY_MS = 86_400_000;
export const CALCULATED_PROVENANCE: RetentionProvenance = {kind: "CALCULATED", label: "Deterministic formula from measured inputs"};

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid UTC calendar date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid UTC calendar date: ${value}`);
  return date;
}
export function dateOnly(value: Date | string) { return value instanceof Date ? value.toISOString().slice(0, 10) : parseDateOnly(value).toISOString().slice(0, 10); }
export function addDays(value: string, days: number) { return new Date(parseDateOnly(value).getTime() + days * DAY_MS).toISOString().slice(0, 10); }
export function datesInclusive(start: string, end: string) { const first = parseDateOnly(start).getTime(); const last = parseDateOnly(end).getTime(); if (last < first) return []; const result: string[] = []; for (let time = first; time <= last; time += DAY_MS) result.push(new Date(time).toISOString().slice(0, 10)); return result; }
export function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
export function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
export function standardDeviation(values: number[]) { const average = mean(values); if (average === null) return null; return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length); }

export function completeness(expectedDates: string[], presentDates: string[]) {
  const present = new Set(presentDates);
  const missingDates = expectedDates.filter((date) => !present.has(date));
  return {startDate: expectedDates[0] ?? null, endDate: expectedDates.at(-1) ?? null, expectedDateCount: expectedDates.length, presentDateCount: expectedDates.length - missingDates.length, missingDateCount: missingDates.length, missingDates, completenessPercentage: expectedDates.length ? ((expectedDates.length - missingDates.length) / expectedDates.length) * 100 : 0};
}

export function summarizeWindow<T extends {date: string}>(label: string, rows: T[], expectedDates: string[], selector: (row: T) => number | null | undefined, missingCode: RetentionReasonCode, provenance: RetentionProvenance[] = [CALCULATED_PROVENANCE]): WindowStatistics {
  const byDate = new Map(rows.map((row) => [row.date, row])); const presentRows = expectedDates.flatMap((date) => { const row = byDate.get(date); const value = row ? selector(row) : null; return typeof value === "number" && Number.isFinite(value) ? [{date, value}] : []; });
  const coverage = completeness(expectedDates, presentRows.map(({date}) => date)); const assessment = completenessAssessment(coverage, missingCode); const values = presentRows.map(({value}) => value);
  return {label, status: assessment.status, confidence: assessment.confidence, reasonCodes: assessment.reasonCodes, formula: "Arithmetic statistics across present raw daily values; missing dates are not imputed.", mean: mean(values), median: median(values), minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, standardDeviation: standardDeviation(values), sum: values.length ? values.reduce((sum, value) => sum + value, 0) : null, completeness: coverage, provenance};
}

export function campaignActiveDateSegments(intervals: CampaignIntervalInput[], dataCutoffDate?: string | null) {
  return intervals.flatMap((item) => {
    const endDate = item.endDate ?? (dataCutoffDate && dataCutoffDate >= item.startDate ? dataCutoffDate : null);
    return endDate ? [datesInclusive(item.startDate, endDate)] : [];
  });
}
export function campaignActiveDates(intervals: CampaignIntervalInput[], dataCutoffDate?: string | null) {
  const dates = intervals.flatMap((item) => item.endDate ? datesInclusive(item.startDate, item.endDate) : dataCutoffDate && dataCutoffDate >= item.startDate ? datesInclusive(item.startDate, dataCutoffDate) : []); return [...new Set(dates)].sort();
}

export function calculateCampaignMetrics(rows: AudienceObservationInput[], intervals: CampaignIntervalInput[], dataCutoffDate: string | null): CampaignMetrics {
  const activeDates = campaignActiveDates(intervals, dataCutoffDate); const daily = summarizeWindow("Campaign raw daily listeners", rows, activeDates, (row) => row.listeners, "MISSING_CAMPAIGN_DAYS"); const byDate = new Map(rows.map((row) => [row.date, row.listeners])); const present = activeDates.flatMap((date) => byDate.has(date) ? [{date, value: byDate.get(date)!}] : []); const oneDay = present.reduce<{date: string; value: number} | null>((best, item) => !best || item.value > best.value ? item : best, null);
  let peak: {value: number; start: string; end: string} | null = null;
  for (const segment of campaignActiveDateSegments(intervals, dataCutoffDate)) for (let index = 0; index <= segment.length - 7; index += 1) { const dates = segment.slice(index, index + 7); const values = dates.map((date) => byDate.get(date)); if (values.some((value) => value === undefined)) continue; const value = mean(values as number[])!; if (!peak || value > peak.value) peak = {value, start: dates[0], end: dates[6]}; }
  const finalDates = activeDates.slice(-7); const finalValues = finalDates.map((date) => byDate.get(date)); const finalComplete = finalDates.length === 7 && finalValues.every((value) => value !== undefined);
  return {
    activeDates,
    activeDayCount: activeDates.length,
    daily,
    oneDayMaximum: metric("Campaign one-day maximum", "max(raw daily listeners across confirmed active dates)", oneDay?.value ?? null, null, null, oneDay ? "VALID" : "INSUFFICIENT", oneDay ? "HIGH" : "INSUFFICIENT", oneDay ? [] : ["MISSING_CAMPAIGN_DAYS", "FORMULA_INPUT_UNAVAILABLE"]),
    oneDayMaximumDate: oneDay?.date ?? null,
    sevenDayPeak: metric("Campaign seven-day peak", "maximum mean of seven consecutive raw listener days contained within one confirmed active interval", peak?.value ?? null, null, null, peak ? "VALID" : "INSUFFICIENT", peak ? "HIGH" : "INSUFFICIENT", peak ? [] : ["MISSING_CAMPAIGN_DAYS", "FORMULA_INPUT_UNAVAILABLE"]),
    sevenDayPeakStartDate: peak?.start ?? null,
    sevenDayPeakEndDate: peak?.end ?? null,
    finalSevenDayAverage: metric("Campaign final seven active-day average", "mean(raw listeners on the final seven confirmed active dates; paused dates excluded)", finalComplete ? mean(finalValues as number[]) : null, null, null, finalComplete ? "VALID" : "INSUFFICIENT", finalComplete ? "HIGH" : "INSUFFICIENT", finalComplete ? [] : ["MISSING_CAMPAIGN_DAYS", "FORMULA_INPUT_UNAVAILABLE"]),
    finalSevenActiveDates: finalDates
  };
}

function metric(label: string, formula: string, value: number | null, percentage: number | null, absoluteDifference: number | null, status: NumericMetric["status"], confidence: NumericMetric["confidence"], reasonCodes: RetentionReasonCode[], explanation?: string): NumericMetric { return {label, formula, value, percentage, absoluteDifference, status, confidence, reasonCodes: uniqueReasons(reasonCodes), explanation, provenance: [CALCULATED_PROVENANCE]}; }
export function calculateBaselineGrowth(baseline: number | null, floor: number | null) { if (baseline === null || floor === null) return metric("Baseline growth", "(postCampaignFloor - preReleaseBaseline) / preReleaseBaseline", null, null, null, "INSUFFICIENT", "INSUFFICIENT", ["FORMULA_INPUT_UNAVAILABLE"]); if (baseline === 0) return metric("Baseline growth", "(postCampaignFloor - preReleaseBaseline) / preReleaseBaseline", null, null, floor, "INSUFFICIENT", "INSUFFICIENT", ["ZERO_BASELINE"]); const difference = floor - baseline; const belowBaseline = floor < baseline; return metric("Baseline growth", "(postCampaignFloor - preReleaseBaseline) / preReleaseBaseline", difference / baseline, (difference / baseline) * 100, difference, belowBaseline ? "WARNING" : "VALID", belowBaseline ? "MODERATE" : "HIGH", belowBaseline ? ["FLOOR_BELOW_BASELINE"] : [], belowBaseline ? "The post-campaign floor is below the pre-release baseline." : undefined); }
export function calculateIncrementalLift(baseline: number | null, peak: number | null) { if (baseline === null || peak === null) return metric("Incremental lift", "campaignPeak - preReleaseBaseline", null, null, null, "INSUFFICIENT", "INSUFFICIENT", ["FORMULA_INPUT_UNAVAILABLE"]); const difference = peak - baseline; const zero = baseline === 0; const nonPositive = difference <= 0; return metric("Incremental lift", "campaignPeak - preReleaseBaseline", difference, zero ? null : (difference / baseline) * 100, difference, zero || nonPositive ? "WARNING" : "VALID", zero || nonPositive ? "LOW" : "HIGH", zero ? ["ZERO_BASELINE"] : nonPositive ? ["NON_POSITIVE_INCREMENTAL_LIFT"] : []); }
export function calculateLiftRetained(baseline: number | null, peak: number | null, floor: number | null) { if (baseline === null || peak === null || floor === null) return metric("Lift retained", "(postCampaignFloor - preReleaseBaseline) / (campaignPeak - preReleaseBaseline)", null, null, null, "INSUFFICIENT", "INSUFFICIENT", ["FORMULA_INPUT_UNAVAILABLE"]); const lift = peak - baseline; if (lift <= 0) return metric("Lift retained", "(postCampaignFloor - preReleaseBaseline) / (campaignPeak - preReleaseBaseline)", null, null, floor - baseline, "INSUFFICIENT", "INSUFFICIENT", ["NON_POSITIVE_INCREMENTAL_LIFT"]); const retained = (floor - baseline) / lift; const reasons: RetentionReasonCode[] = []; let explanation: string | undefined; if (retained < 0) { reasons.push("FLOOR_BELOW_BASELINE"); explanation = "Below 0% means the post-campaign floor fell below baseline."; } if (retained > 1) { reasons.push("LIFT_RETAINED_ABOVE_100"); explanation = "Above 100% means the post-campaign floor exceeded the measured campaign lift reference."; } return metric("Lift retained", "(postCampaignFloor - preReleaseBaseline) / (campaignPeak - preReleaseBaseline)", retained, retained * 100, floor - baseline, reasons.length ? "WARNING" : "VALID", reasons.length ? "MODERATE" : "HIGH", reasons, explanation); }

export function dailyRatios(rows: AudienceObservationInput[], numerator: (row: AudienceObservationInput) => number, denominator: (row: AudienceObservationInput) => number): DailyRatioValue[] { return rows.flatMap((row) => { const divisor = denominator(row); return divisor > 0 ? [{date: row.date, numerator: numerator(row), denominator: divisor, value: numerator(row) / divisor}] : []; }).sort((left, right) => left.date.localeCompare(right.date)); }
export function snapshotChange(label: string, rows: AudienceObservationInput[], dates: string[]): NumericMetric { const allowed = new Set(dates); const values = rows.filter((row) => allowed.has(row.date)).sort((a, b) => a.date.localeCompare(b.date)); if (values.length < 2) return metric(label, "latest follower snapshot - earliest follower snapshot", null, null, null, "INSUFFICIENT", "INSUFFICIENT", ["FORMULA_INPUT_UNAVAILABLE"]); const difference = values.at(-1)!.followers - values[0].followers; return metric(label, "latest follower snapshot - earliest follower snapshot", difference, null, difference, "VALID", "MODERATE", [], "Follower values are snapshot totals; this is not follower conversion."); }
