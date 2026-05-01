import type {AdBatchComparisonMode, AdBatchType} from "@/lib/types";

export const defaultAdAttributionSetting = "7-day click, 1-day view, 1-day engagement";

export const adBatchTypeOptions: AdBatchType[] = [
  "Rolling Snapshot",
  "Fixed Period",
  "Full Campaign"
];

export function normalizeAdBatchType(value: string | null | undefined): AdBatchType {
  return adBatchTypeOptions.includes(value as AdBatchType)
    ? (value as AdBatchType)
    : "Rolling Snapshot";
}

export function adDateRangesOverlap(
  left: {reporting_end: string | null; reporting_start: string | null},
  right: {reporting_end: string | null; reporting_start: string | null}
) {
  if (!left.reporting_start || !left.reporting_end || !right.reporting_start || !right.reporting_end) {
    return false;
  }

  const leftStart = new Date(left.reporting_start).getTime();
  const leftEnd = new Date(left.reporting_end).getTime();
  const rightStart = new Date(right.reporting_start).getTime();
  const rightEnd = new Date(right.reporting_end).getTime();

  if ([leftStart, leftEnd, rightStart, rightEnd].some((value) => Number.isNaN(value))) {
    return false;
  }

  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function getAdBatchComparisonMode(
  batches: Array<{
    batch_type: AdBatchType;
    reporting_end: string | null;
    reporting_start: string | null;
  }>
): AdBatchComparisonMode {
  const hasOverlap = batches.some((batch, index) =>
    batches.slice(index + 1).some((otherBatch) => adDateRangesOverlap(batch, otherBatch))
  );
  const allFixedPeriod = batches.every((batch) => batch.batch_type === "Fixed Period");

  if (hasOverlap) {
    return "Snapshot Comparison";
  }

  if (allFixedPeriod) {
    return "Combined Fixed Period";
  }

  return "Snapshot Comparison";
}

export function canCombineAdBatchTotals(
  batches: Array<{
    batch_type: AdBatchType;
    reporting_end: string | null;
    reporting_start: string | null;
  }>
) {
  return getAdBatchComparisonMode(batches) === "Combined Fixed Period";
}
