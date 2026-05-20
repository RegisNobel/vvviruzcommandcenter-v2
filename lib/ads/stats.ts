export interface ConfidenceSignalResult {
  score: string;
  type: "conversion" | "ctr" | "none";
}

export function calculateConfidenceSignal({
  spend,
  impressions,
  results,
  linkClicks,
  batchTotalResults,
  batchTotalImpressions,
  batchTotalLinkClicks
}: {
  spend: number;
  impressions: number;
  results: number;
  linkClicks: number;
  batchTotalResults: number;
  batchTotalImpressions: number;
  batchTotalLinkClicks: number;
}): ConfidenceSignalResult {
  if (spend < 5.0 || impressions < 100) {
    return { score: "Insufficient Data", type: "none" };
  }

  let p1 = 0;
  let p0 = 0;
  let type: "conversion" | "ctr" = "conversion";

  if (batchTotalResults > 0) {
    p1 = results / impressions;
    p0 = batchTotalResults / batchTotalImpressions;
    type = "conversion";
  } else if (batchTotalLinkClicks > 0) {
    p1 = linkClicks / impressions;
    p0 = batchTotalLinkClicks / batchTotalImpressions;
    type = "ctr";
  } else {
    return { score: "Directional Only", type: "none" };
  }

  if (p0 <= 0 || p0 >= 1) {
    return { score: "Directional Only", type };
  }

  const se = Math.sqrt((p0 * (1.0 - p0)) / impressions);
  if (se === 0) {
    return { score: "Directional Only", type };
  }

  const z = (p1 - p0) / se;

  let score = "Directional Only";
  if (z >= 1.96) {
    score = "95% Confidence (High)";
  } else if (z >= 1.64) {
    score = "90% Confidence (Strong)";
  } else if (z >= 1.28) {
    score = "80% Confidence (Moderate)";
  } else if (z <= -1.96) {
    score = "95% Underperforming";
  } else if (z <= -1.64) {
    score = "90% Underperforming";
  } else if (z <= -1.28) {
    score = "80% Underperforming";
  }

  return { score, type };
}
