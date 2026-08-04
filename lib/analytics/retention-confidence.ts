import type {DataCompleteness, RetentionConfidence, RetentionReasonCode, RetentionStatus} from "./retention-types";

const statusRank: Record<RetentionStatus, number> = {VALID: 0, WARNING: 1, EXCLUDED: 2, INSUFFICIENT: 3};
const confidenceRank: Record<RetentionConfidence, number> = {HIGH: 0, MODERATE: 1, LOW: 2, INSUFFICIENT: 3};

export function uniqueReasons(values: RetentionReasonCode[]) {
  return [...new Set(values)];
}

export function completenessAssessment(completeness: DataCompleteness, missingCode: RetentionReasonCode) {
  if (completeness.expectedDateCount === 0 || completeness.presentDateCount === 0) return {status: "INSUFFICIENT" as const, confidence: "INSUFFICIENT" as const, reasonCodes: [missingCode, "FORMULA_INPUT_UNAVAILABLE"] as RetentionReasonCode[]};
  const missingRate = completeness.missingDateCount / completeness.expectedDateCount;
  if (missingRate > 0.1) return {status: "INSUFFICIENT" as const, confidence: "INSUFFICIENT" as const, reasonCodes: [missingCode, "EXCESSIVE_MISSING_DAYS"] as RetentionReasonCode[]};
  if (missingRate > 0.05) return {status: "WARNING" as const, confidence: "LOW" as const, reasonCodes: [missingCode] as RetentionReasonCode[]};
  if (missingRate > 0) return {status: "WARNING" as const, confidence: "MODERATE" as const, reasonCodes: [missingCode] as RetentionReasonCode[]};
  return {status: "VALID" as const, confidence: "HIGH" as const, reasonCodes: [] as RetentionReasonCode[]};
}

export function worstStatus(...values: RetentionStatus[]) {
  return values.reduce((worst, value) => statusRank[value] > statusRank[worst] ? value : worst, "VALID");
}

export function worstConfidence(...values: RetentionConfidence[]) {
  return values.reduce((worst, value) => confidenceRank[value] > confidenceRank[worst] ? value : worst, "HIGH");
}

export function lowerConfidence(current: RetentionConfidence, floor: RetentionConfidence) {
  return confidenceRank[floor] > confidenceRank[current] ? floor : current;
}
