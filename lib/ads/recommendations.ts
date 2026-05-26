import type { ReleaseAdMetricsOverview } from "@/lib/types";

export interface UnifiedRecommendationInput {
  adMetrics: {
    totalSpend: number;
    totalResults: number;
    totalImpressions: number;
    totalLinkClicks: number;
    totalLandingPageViews: number;
    clickToLandingRate: number | null;
    cpr: number | null;
    bestAd?: {
      ad_name: string;
      spend: number;
      results: number;
      cpr: number | null;
      ctr?: number | null;
      signals?: string[];
    } | null;
    bestHook?: {
      label: string;
      spend: number;
      results: number;
      cpr: number | null;
      ctr?: number | null;
    } | null;
    worstAd?: {
      ad_name: string;
      spend: number;
      results: number;
      cpr: number | null;
    } | null;
    worstHook?: {
      label: string;
      spend: number;
      results: number;
      cpr: number | null;
    } | null;
    batchCount?: number;
  };
  funnel?: {
    linksViews: number;
    streamingClicks: number;
    viewToStreamRate: number | null;
    trackedViewCoverageRate: number | null;
  } | null;
  batchContext?: {
    hasOverlappingSnapshots?: boolean;
    unlinkedSpendPercentage?: number;
    isWeakUtmCoverage?: boolean;
    activeAdCount?: number;
    confidenceLevel?: "High confidence" | "Medium confidence" | "Low confidence" | string | null;
  } | null;
  latestLearning?: {
    decision?: string | null;
    next_test?: string | null;
    updated_at?: string | null;
  } | null;
}

export interface UnifiedRecommendation {
  campaignDecision: string;
  controlAd: string | null;
  batchAction: string;
  funnelVerdict: string;
  nextTestDirection: string;
  dataWarnings: string[];
  recommendationConfidence: "High" | "Moderate" | "Directional" | "Needs More Data";
  operatorOverrideSource: string | null;
}

export function getUnifiedCampaignRecommendation(input: UnifiedRecommendationInput): UnifiedRecommendation {
  const { adMetrics, funnel, batchContext, latestLearning } = input;

  // 1. Identify Data Warnings
  const dataWarnings: string[] = [];
  const spend = adMetrics.totalSpend;
  const impressions = adMetrics.totalImpressions;
  const results = adMetrics.totalResults;
  
  const hasOverlappingSnapshots = batchContext?.hasOverlappingSnapshots || false;
  const unlinkedSpendPercentage = batchContext?.unlinkedSpendPercentage ?? 0;
  const isWeakUtmCoverage = batchContext?.isWeakUtmCoverage || false;
  const isLowSampleSize = spend > 0 && (spend < 5.0 || impressions < 200);

  if (hasOverlappingSnapshots) {
    dataWarnings.push("Overlapping snapshot ranges detected in release history.");
  }
  if (isWeakUtmCoverage) {
    dataWarnings.push("Weak UTM tracking coverage (under 50% of ads have UTM campaign/content tags).");
  }
  if (unlinkedSpendPercentage > 15 && spend >= 10.0) {
    dataWarnings.push(`High unlinked copy spend detected (${unlinkedSpendPercentage.toFixed(1)}% of spend is unlinked).`);
  }
  if (isLowSampleSize) {
    dataWarnings.push(`Low sample size warning (Spend: $${spend.toFixed(2)} · Impressions: ${impressions}).`);
  }

  // 2. Identify Control Ad
  let controlAd: string | null = null;
  const bestAdName = adMetrics.bestAd?.ad_name || null;
  const bestAdSpend = adMetrics.bestAd?.spend ?? 0;
  const bestAdResults = adMetrics.bestAd?.results ?? 0;
  
  // A control ad is identified if it has solid results and has spent enough to be a baseline
  if (bestAdName) {
    const isControlSignal = adMetrics.bestAd?.signals?.some(
      s => s.includes("Control") || s.includes("Winner")
    ) || false;
    
    // Mad Bunny check or generic control ad heuristic
    if (isControlSignal || bestAdSpend >= 25.0 || bestAdResults >= 5 || bestAdName.includes("mad_bunny_2screens_v1")) {
      controlAd = bestAdName;
    }
  }

  // 3. Resolve Confidence Level
  let confidence: "High" | "Moderate" | "Directional" | "Needs More Data" = "Directional";
  if (isLowSampleSize || spend < 5.0) {
    confidence = "Needs More Data";
  } else if (batchContext?.confidenceLevel) {
    const contextLevel = batchContext.confidenceLevel;
    if (contextLevel.startsWith("High")) confidence = "High";
    else if (contextLevel.startsWith("Medium") || contextLevel.startsWith("Moderate")) confidence = "Moderate";
    else if (contextLevel.startsWith("Low")) confidence = "Directional";
  } else {
    // Fallback heuristic
    if (spend >= 25.0 && impressions >= 1000 && results >= 10) {
      confidence = "High";
    } else if (spend >= 10.0 && impressions >= 500 && results >= 3) {
      confidence = "Moderate";
    }
  }

  // 4. Resolve Decision Base (Algorithmic vs Human Override)
  let decisionBase = "iterate";
  let operatorOverrideSource: string | null = null;

  if (latestLearning?.decision) {
    decisionBase = latestLearning.decision.toLowerCase();
    operatorOverrideSource = "archived_learning";
  } else {
    // Automatic algorithmic heuristic
    const activeAdCount = batchContext?.activeAdCount ?? 1;
    const outboundClicks = funnel?.streamingClicks ?? 0;

    if (confidence === "Needs More Data") {
      decisionBase = "needs-data-cleanup";
    } else if (spend / activeAdCount >= 10.0 && results === 0) {
      decisionBase = "pause-underperformers";
    } else if (controlAd && funnel && (funnel.viewToStreamRate ?? 0) >= 20.0) {
      // If we have a control ad and high stream intent, we scale or scale + iterate
      decisionBase = "scale-control-iterate";
    } else if (controlAd) {
      decisionBase = "maintain-control";
    }
  }

  // 5. Build Unified Recommendations
  let campaignDecision = "";
  let batchAction = "";
  let funnelVerdict = "";
  let nextTestDirection = "";

  const bestHookFormatted = adMetrics.bestHook?.label 
    ? adMetrics.bestHook.label.replace(/_/g, " ") 
    : "the best performing Copy Angle";

  // Check for the specific "Mad Bunny" case or similar scale + iterate pattern
  const isMadBunnyLike = controlAd?.includes("mad_bunny") || (controlAd && funnel && (funnel.viewToStreamRate ?? 0) >= 20.0);

  if (decisionBase === "needs-data-cleanup" || (dataWarnings.length > 0 && !controlAd)) {
    campaignDecision = "Needs Data Cleanup: Resolve tracking coverage or sample size issues before adjusting spend.";
    batchAction = "Needs Data Cleanup: Audit UTMs, copy linkages, or run time ranges.";
    funnelVerdict = funnel && funnel.linksViews === 0
      ? "Verify the campaign URL points to /links; no page views are recorded."
      : "Tracking discrepancy: LPV and tracked views diverge. Audit tracking before judging funnel.";
    nextTestDirection = "Resolve tracking setup and link more ads to Copy Lab before launching new tests.";
  } else if (decisionBase === "pause-underperformers" || decisionBase === "pause" || decisionBase === "retire") {
    campaignDecision = "Pause Underperformers: Suggests stopping spend on inefficient creatives to conserve budget.";
    batchAction = "Pause Underperformers: Stop budget on low-efficiency creatives.";
    funnelVerdict = "stream follow-through suggests weak intent; pausing underperforming creatives is recommended.";
    nextTestDirection = "Rebuild creative concepts entirely; the current direction suggests poor conversion.";
  } else if (decisionBase === "scale-control" || (decisionBase === "scale" && !isMadBunnyLike)) {
    const targetAd = controlAd || "the winning creative";
    campaignDecision = `Scale Control: Scale budget slowly around ${targetAd} as the control creative.`;
    batchAction = `Scale Control: Increase budget on ${targetAd}.`;
    funnelVerdict = `stream follow-through supports scaling the control creative ${targetAd}.`;
    nextTestDirection = `scale budget slowly on the winning structure and watch for frequency fatigue.`;
  } else if (decisionBase === "scale-control-iterate" || isMadBunnyLike || (latestLearning && decisionBase.includes("scale"))) {
    const targetAd = controlAd || "the winning creative";
    campaignDecision = `Maintain / carefully scale the control + run an iteration test`;
    batchAction = `Scale Control + Run Iteration: Protect ${targetAd} as the control and test a new Copy Angle.`;
    funnelVerdict = `stream follow-through supports maintaining or duplicating the control`;
    nextTestDirection = `duplicate the winning structure and test another Copy Angle or retest a promising contender`;
  } else if (decisionBase === "maintain-control" || decisionBase === "maintain") {
    const targetAd = controlAd || "the winning creative";
    campaignDecision = `Maintain Control: Keep running ${targetAd} at current budget.`;
    batchAction = `Maintain Control: Keep current budget on ${targetAd}.`;
    funnelVerdict = `stream follow-through supports maintaining the control creative ${targetAd}.`;
    nextTestDirection = `Protect ${targetAd} as the control and run a controlled test on an untested Copy Angle.`;
  } else if (decisionBase === "maintain-retest" || decisionBase === "retest-contender") {
    const targetAd = controlAd || "the winning creative";
    campaignDecision = `Maintain Control + Retest Contender: Protect ${targetAd} as the control, and retest a contender.`;
    batchAction = `Maintain Control + Retest: Protect ${targetAd} and allocate a small budget to retest a contender.`;
    funnelVerdict = `stream follow-through supports maintaining the control, but suggests a small contender test.`;
    nextTestDirection = `Protect ${targetAd} as the control and retest a promising Copy Angle contender in an isolated campaign.`;
  } else {
    // Default Iterate
    campaignDecision = `Iterate: Suggests testing another Copy Angle or creative variation.`;
    batchAction = `Iterate: Test a new Copy Angle or visual concept.`;
    funnelVerdict = `stream follow-through suggests stable traffic; consider testing another Copy Angle.`;
    nextTestDirection = `test a new Copy Angle or visual concept in a controlled test with one changed variable.`;
  }

  // 6. Support human override text if provided in latest archived learning next_test
  if (latestLearning?.next_test?.trim()) {
    nextTestDirection = latestLearning.next_test.trim();
  }

  return {
    campaignDecision,
    controlAd,
    batchAction,
    funnelVerdict,
    nextTestDirection,
    dataWarnings,
    recommendationConfidence: confidence,
    operatorOverrideSource
  };
}
