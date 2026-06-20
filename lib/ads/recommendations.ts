import type { ReleaseAdMetricsOverview } from "@/lib/types";
import { parseAdName } from "@/lib/ads/naming-parser";

export interface IterationCandidate {
  suggestedPattern: string;
  whatChanges: string;
  whatStaysSame: string;
  whyMatters: string;
  confidence: "High" | "Moderate" | "Directional";
}

export interface ComponentDiagnosis {
  controlAd: string | null;
  controlVisual: string | null;
  controlSongSection: string | null;
  controlCopyAngle: string | null;
  controlCopyPair: string | null;
  visualStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" | "Below Average" | "Needs Challenger" | "Narrow Coverage";
  songSectionStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" | "Below Average" | "Needs Challenger" | "Narrow Coverage";
  copyAngleStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" | "Below Average" | "Needs Challenger" | "Narrow Coverage";
  copyPairStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" | "Below Average" | "Needs Challenger" | "Narrow Coverage";
  visualReason: string;
  songSectionReason: string;
  copyAngleReason: string;
  copyPairReason: string;
  strongestComponent: string | null;
  weakestComponent: string | null;
  preserveComponents: string[];
  testComponent: string | null;
  coverageWarnings: string[];
  iterationCandidates: IterationCandidate[];
  diagnosisRead: string;
  diagnosisComment: string | null;
}

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
  reports?: any[] | null;
  targetCpr?: number | null;
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
  componentDiagnosis: ComponentDiagnosis | null;
}

export function getUnifiedCampaignRecommendation(input: UnifiedRecommendationInput): UnifiedRecommendation {
  const { adMetrics, funnel, batchContext, latestLearning, reports, targetCpr } = input;

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

  // Compute component-level diagnosis if reports are available
  let componentDiagnosis: ComponentDiagnosis | null = null;

  if (reports && reports.length > 0) {
    interface NormalizedReport {
      adName: string;
      spend: number;
      impressions: number;
      results: number;
      linkClicks: number;
      threeSecondPlays: number;
      thruPlays: number;
      video50: number;
      copyAngle: string | null;
      copyPairHook: string | null;
    }

    const formatSongSection = (songSection: string): string => {
      if (!songSection) return "";
      if (songSection.toLowerCase() === "verse1") return "Verse 1";
      if (songSection.toLowerCase() === "verse2") return "Verse 2";
      if (songSection.toLowerCase() === "verse3") return "Verse 3";
      return songSection.charAt(0).toUpperCase() + songSection.slice(1).toLowerCase();
    };

    const formatHookType = (hookType: string): string => {
      if (!hookType) return "";
      return hookType
        .replace(/[-_]+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };

    const normalizeReport = (r: any): NormalizedReport => {
      const adName = r.adName || r.ad_name || "";
      const spend = r.spend ?? 0;
      const impressions = r.impressions ?? 0;
      const results = r.results ?? 0;
      const linkClicks = r.linkClicks ?? r.link_clicks ?? 0;
      const threeSecondPlays = r.threeSecondPlays ?? r.three_second_plays ?? 0;
      const thruPlays = r.thruPlays ?? r.thru_plays ?? 0;
      const video50 = r.video50 ?? r.video_50 ?? 0;

      let copyAngle: string | null = null;
      let copyPairHook: string | null = null;

      if (r.linked_copy) {
        copyAngle = r.linked_copy.hook_type || r.linked_copy.hookType || null;
        copyPairHook = r.linked_copy.hook || null;
      } else if (r.copyLinks && r.copyLinks[0]?.copyEntry) {
        copyAngle = r.copyLinks[0].copyEntry.hookType || null;
        copyPairHook = r.copyLinks[0].copyEntry.hook || null;
      } else if (r.copyEntry) {
        copyAngle = r.copyEntry.hookType || null;
        copyPairHook = r.copyEntry.hook || null;
      }

      if (copyAngle) {
        copyAngle = formatHookType(copyAngle);
      }

      return {
        adName,
        spend,
        impressions,
        results,
        linkClicks,
        threeSecondPlays,
        thruPlays,
        video50,
        copyAngle,
        copyPairHook
      };
    };

    const normalizedReports = reports.map(normalizeReport);
    const totalSpend = normalizedReports.reduce((sum, r) => sum + r.spend, 0);
    const totalResults = normalizedReports.reduce((sum, r) => sum + r.results, 0);
    const totalImpressions = normalizedReports.reduce((sum, r) => sum + r.impressions, 0);
    const averageCpr = totalResults > 0 ? totalSpend / totalResults : null;
    const linkedSpend = normalizedReports.filter(r => r.copyPairHook !== null).reduce((sum, r) => sum + r.spend, 0);
    const copyLinkagePercentage = totalSpend > 0 ? (linkedSpend / totalSpend) * 100 : 0;
    const isCopyLinkageWeak = copyLinkagePercentage < 70;

    interface ComponentAggregate {
      value: string;
      spend: number;
      results: number;
      impressions: number;
      linkClicks: number;
      threeSecondPlays: number;
      thruPlays: number;
      video50: number;
    }

    const visualAggs = new Map<string, ComponentAggregate>();
    const songSectionAggs = new Map<string, ComponentAggregate>();
    const copyAngleAggs = new Map<string, ComponentAggregate>();
    const copyPairAggs = new Map<string, ComponentAggregate>();

    const addToMap = (map: Map<string, ComponentAggregate>, key: string, rep: NormalizedReport) => {
      if (key === "unparsed" || key === "unlinked") return;
      const current = map.get(key) || {
        value: key,
        spend: 0,
        results: 0,
        impressions: 0,
        linkClicks: 0,
        threeSecondPlays: 0,
        thruPlays: 0,
        video50: 0
      };
      current.spend += rep.spend;
      current.results += rep.results;
      current.impressions += rep.impressions;
      current.linkClicks += rep.linkClicks;
      current.threeSecondPlays += rep.threeSecondPlays;
      current.thruPlays += rep.thruPlays;
      current.video50 += rep.video50;
      map.set(key, current);
    };

    for (const r of normalizedReports) {
      const parsed = parseAdName(r.adName);
      const visualVal = parsed.visual && parsed.visual !== "Unparsed" ? parsed.visual.toLowerCase() : "unparsed";
      const songSectionVal = parsed.songSection && parsed.songSection !== "Unparsed" ? formatSongSection(parsed.songSection) : "unparsed";
      const copyAngleVal = r.copyAngle ? r.copyAngle : "unlinked";
      const copyPairVal = r.copyPairHook ? r.copyPairHook : "unlinked";

      addToMap(visualAggs, visualVal, r);
      addToMap(songSectionAggs, songSectionVal, r);
      addToMap(copyAngleAggs, copyAngleVal, r);
      addToMap(copyPairAggs, copyPairVal, r);
    }
    interface ComponentAggregate {
      value: string;
      spend: number;
      results: number;
      impressions: number;
      linkClicks: number;
      threeSecondPlays: number;
      thruPlays: number;
      video50: number;
    }

    const evaluateComponentStatus = (
      agg: ComponentAggregate | undefined,
      alternatives: ComponentAggregate[]
    ): { status: "Strong" | "Weak" | "Below Average" | "Needs Challenger" | "Narrow Coverage" | "Low Data" | "Untested" | "Neutral"; reason: string } => {
      if (!agg || agg.spend === 0) {
        return { status: "Untested", reason: "No tested alternative yet" };
      }

      if (agg.spend < 10 || agg.results < 5) {
        return { status: "Low Data", reason: "Low spend/results, not enough data" };
      }

      const cpr = agg.results > 0 ? agg.spend / agg.results : null;
      const ssr = agg.impressions > 0 ? (agg.threeSecondPlays / agg.impressions) * 100 : 0;
      const ctr = agg.impressions > 0 ? (agg.linkClicks / agg.impressions) * 100 : 0;
      const vhr = agg.threeSecondPlays > 0 ? (agg.thruPlays / agg.threeSecondPlays) * 100 : 0;

      const isWeakSSR = agg.impressions >= 100 && ssr < 20.0;
      const isWeakCTR = agg.impressions >= 100 && ssr >= 22.0 && ctr < 0.8;
      const isWeakVHR = agg.impressions >= 100 && ssr >= 22.0 && vhr < 15.0;

      let isWorseThanBenchmark = false;
      let isClearlyWorse = false;
      let benchmarkLabel = "release average";

      if (targetCpr !== null && targetCpr !== undefined && targetCpr > 0) {
        benchmarkLabel = "target CPR";
        isWorseThanBenchmark = cpr === null || cpr > targetCpr;
        isClearlyWorse = cpr === null || cpr >= 1.5 * targetCpr;
      } else if (averageCpr !== null && averageCpr > 0) {
        isWorseThanBenchmark = cpr === null || cpr > averageCpr;
        isClearlyWorse = cpr === null || cpr >= 1.25 * averageCpr;
      } else {
        isWorseThanBenchmark = cpr === null;
        isClearlyWorse = cpr === null;
      }

      // Strong check
      let isStrongCpr = false;
      if (targetCpr !== null && targetCpr !== undefined && targetCpr > 0) {
        isStrongCpr = cpr !== null && cpr <= targetCpr;
      } else if (averageCpr !== null && averageCpr > 0) {
        isStrongCpr = cpr !== null && cpr <= averageCpr;
      }

      let isConfidenceNotLow = true;
      if (totalResults > 0 && totalImpressions > 0 && agg.impressions > 0) {
        const p1 = agg.results / agg.impressions;
        const p0 = totalResults / totalImpressions;
        if (p0 > 0 && p0 < 1) {
          const se = Math.sqrt((p0 * (1 - p0)) / agg.impressions);
          if (se > 0) {
            const z = (p1 - p0) / se;
            if (z <= -1.28) {
              isConfidenceNotLow = false;
            }
          }
        }
      }

      const isStrong = isStrongCpr && agg.results >= 5 && isConfidenceNotLow && !isWeakSSR && !isWeakCTR && !isWeakVHR;
      if (isStrong) {
        return { status: "Strong", reason: `Strong CPR vs ${benchmarkLabel}` };
      }

      const hasUnderperformed = isClearlyWorse || isWorseThanBenchmark || isWeakSSR || isWeakCTR || isWeakVHR;
      if (hasUnderperformed) {
        const alternativesWithSpend = alternatives.filter(alt => alt.spend >= 10);
        const hasAlternativeWithSpend = alternativesWithSpend.length > 0;

        if (!hasAlternativeWithSpend) {
          return { status: "Narrow Coverage", reason: "Only one option tested with meaningful spend" };
        }

        if (isClearlyWorse) {
          return { status: "Weak", reason: `Clearly worse than ${benchmarkLabel} alternatives` };
        }

        if (isWorseThanBenchmark) {
          return { status: "Below Average", reason: `Below average CPR vs ${benchmarkLabel}` };
        }

        return { status: "Needs Challenger", reason: "Retaining audience or click rates are underperforming" };
      }

      return { status: "Neutral", reason: "Performance is average or mixed" };
    };

    let controlVisual: string | null = null;
    let controlSongSection: string | null = null;
    let controlCopyAngle: string | null = null;
    let controlCopyPair: string | null = null;

    if (controlAd) {
      const parsedControl = parseAdName(controlAd);
      controlVisual = parsedControl.visual && parsedControl.visual !== "Unparsed" ? parsedControl.visual.toLowerCase() : null;
      controlSongSection = parsedControl.songSection && parsedControl.songSection !== "Unparsed" ? formatSongSection(parsedControl.songSection) : null;

      const controlReport = normalizedReports.find(r => r.adName.toLowerCase() === controlAd.toLowerCase());
      if (controlReport) {
        controlCopyAngle = controlReport.copyAngle;
        controlCopyPair = controlReport.copyPairHook;
      }
    }

    const getAlternatives = (map: Map<string, ComponentAggregate>, controlVal: string | null): ComponentAggregate[] => {
      if (!controlVal) return [];
      return Array.from(map.values()).filter(v => v.value !== controlVal);
    };

    const visEval = evaluateComponentStatus(controlVisual ? visualAggs.get(controlVisual) : undefined, getAlternatives(visualAggs, controlVisual));
    const songEval = evaluateComponentStatus(controlSongSection ? songSectionAggs.get(controlSongSection) : undefined, getAlternatives(songSectionAggs, controlSongSection));
    const angleEval = evaluateComponentStatus(controlCopyAngle ? copyAngleAggs.get(controlCopyAngle) : undefined, getAlternatives(copyAngleAggs, controlCopyAngle));
    const pairEval = evaluateComponentStatus(controlCopyPair ? copyPairAggs.get(controlCopyPair) : undefined, getAlternatives(copyPairAggs, controlCopyPair));
    let visualStatus = visEval.status;
    let visualReason = visEval.reason;

    let songSectionStatus = songEval.status;
    let songSectionReason = songEval.reason;

    let copyAngleStatus = isCopyLinkageWeak ? "Low Data" : angleEval.status;
    let copyAngleReason = isCopyLinkageWeak ? "Copy angle diagnosis unavailable: copy linkage coverage is weak." : angleEval.reason;

    let copyPairStatus = isCopyLinkageWeak ? "Low Data" : pairEval.status;
    let copyPairReason = isCopyLinkageWeak ? "Copy pair diagnosis unavailable: copy linkage coverage is weak." : pairEval.reason;

    let diagnosisComment: string | null = null;
    const activeStatuses = [visualStatus, songSectionStatus, copyAngleStatus, copyPairStatus].filter(s => s !== "Untested" && s !== "Low Data");
    const allBad = activeStatuses.length > 0 && activeStatuses.every(s => ["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(s));

    if (controlAd && allBad) {
      diagnosisComment = "Control is current best, but no component has enough comparative proof yet.";
      if (["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(visualStatus)) {
        visualStatus = "Neutral";
        visualReason = "Control is current best, but no component has enough comparative proof yet.";
      }
      if (["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(songSectionStatus)) {
        songSectionStatus = "Neutral";
        songSectionReason = "Control is current best, but no component has enough comparative proof yet.";
      }
      if (!isCopyLinkageWeak && ["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(copyAngleStatus)) {
        copyAngleStatus = "Neutral";
        copyAngleReason = "Control is current best, but no component has enough comparative proof yet.";
      }
      if (!isCopyLinkageWeak && ["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(copyPairStatus)) {
        copyPairStatus = "Neutral";
        copyPairReason = "Control is current best, but no component has enough comparative proof yet.";
      }
    }

    const componentsList = [
      { name: "Visual Format", value: controlVisual, status: visualStatus, agg: controlVisual ? visualAggs.get(controlVisual) : undefined },
      { name: "Song Section", value: controlSongSection, status: songSectionStatus, agg: controlSongSection ? songSectionAggs.get(controlSongSection) : undefined },
      { name: "Copy Angle", value: controlCopyAngle, status: copyAngleStatus, agg: controlCopyAngle ? copyAngleAggs.get(controlCopyAngle) : undefined },
      { name: "Copy Pair", value: controlCopyPair, status: copyPairStatus, agg: controlCopyPair ? copyPairAggs.get(controlCopyPair) : undefined }
    ].filter(c => c.value !== null && (!isCopyLinkageWeak || (c.name !== "Copy Angle" && c.name !== "Copy Pair")));

    const strongComponents = componentsList.filter(c => c.status === "Strong");
    let strongestComponent: string | null = null;
    if (strongComponents.length > 0) {
      strongComponents.sort((a, b) => {
        const resA = a.agg?.results ?? 0;
        const resB = b.agg?.results ?? 0;
        if (resB !== resA) return resB - resA;
        const cprA = a.agg ? (a.agg.results > 0 ? a.agg.spend / a.agg.results : Infinity) : Infinity;
        const cprB = b.agg ? (b.agg.results > 0 ? b.agg.spend / b.agg.results : Infinity) : Infinity;
        return cprA - cprB;
      });
      strongestComponent = strongComponents[0].name;
    }

    const weakComponents = componentsList.filter(c => ["Weak", "Below Average", "Needs Challenger", "Narrow Coverage"].includes(c.status));
    let weakestComponent: string | null = null;
    if (weakComponents.length > 0) {
      weakComponents.sort((a, b) => {
        const cprA = a.agg ? (a.agg.results > 0 ? a.agg.spend / a.agg.results : Infinity) : Infinity;
        const cprB = b.agg ? (b.agg.results > 0 ? b.agg.spend / b.agg.results : Infinity) : Infinity;
        return cprB - cprA;
      });
      weakestComponent = weakComponents[0].name;
    }

    const preserveComponents = componentsList.filter(c => c.status === "Strong").map(c => c.name);

    let testComponent: string | null = null;
    if (weakestComponent) {
      testComponent = weakestComponent;
    } else {
      const lowDataComp = componentsList.find(c => c.status === "Low Data");
      if (lowDataComp) {
        testComponent = lowDataComp.name;
      } else {
        const untestedComp = componentsList.find(c => c.status === "Untested");
        if (untestedComp) {
          testComponent = untestedComp.name;
        }
      }
    }

    const mapTestComponent = (name: string | null): string | null => {
      if (!name) return null;
      if (name === "Visual Format") return "Test Visual Format";
      if (name === "Song Section") return "Test Song Section";
      if (name === "Copy Angle") return "Test Copy Angle";
      if (name === "Copy Pair") return "Test Copy Angle";
      return `Test ${name}`;
    };

    const specificTestComponent = mapTestComponent(testComponent);

    const coverageWarnings: string[] = [];
    const meaningfulVisuals = Array.from(visualAggs.values()).filter(v => v.spend >= 10);
    const meaningfulSections = Array.from(songSectionAggs.values()).filter(s => s.spend >= 10);
    const meaningfulAngles = Array.from(copyAngleAggs.values()).filter(a => a.spend >= 10);

    if (meaningfulVisuals.length < 2) {
      if (meaningfulVisuals[0]?.value) {
        coverageWarnings.push(`Visual coverage is narrow: only ${meaningfulVisuals[0].value} has meaningful spend.`);
      } else {
        coverageWarnings.push("Visual coverage is narrow: no visual format has meaningful spend.");
      }
    }
    if (meaningfulSections.length < 2) {
      if (meaningfulSections[0]?.value) {
        coverageWarnings.push(`Song section coverage is narrow: only ${meaningfulSections[0].value} has meaningful spend.`);
      } else {
        coverageWarnings.push("Song section coverage is narrow: no song section has meaningful spend.");
      }
    }

    if (isCopyLinkageWeak) {
      coverageWarnings.push("Copy angle diagnosis unavailable: copy linkage coverage is weak.");
      coverageWarnings.push("Copy pair diagnosis unavailable: copy linkage coverage is weak.");
    } else {
      if (meaningfulAngles.length < 2) {
        if (meaningfulAngles[0]?.value) {
          coverageWarnings.push(`Copy angle coverage is narrow: only ${meaningfulAngles[0].value} has meaningful spend.`);
        } else {
          coverageWarnings.push("Copy angle coverage is narrow: no copy angle has meaningful spend.");
        }
      }
    }

    let diagnosisRead = "System has isolated a control and calculated component proof. Proceed with controlled tests.";
    if (coverageWarnings.length > 0) {
      diagnosisRead = "Coverage is narrow, so this is a testing direction, not a final verdict.";
    } else if (totalSpend > 0 && totalSpend < 25) {
      diagnosisRead = "Low sample size or results, treat recommendations as directional.";
    }

    const iterationCandidates: IterationCandidate[] = [];

    const normalizeSongSectionToken = (section: string | null): string => {
      if (!section) return "chorus";
      const clean = section.trim().toLowerCase();
      if (clean === "verse 1" || clean === "verse1") return "verse1";
      if (clean === "verse 2" || clean === "verse2") return "verse2";
      if (clean === "verse 3" || clean === "verse3") return "verse3";
      if (clean === "hook") return "hook";
      if (clean === "chorus") return "chorus";
      return clean.replace(/\s+/g, "");
    };

    const isCopyAngleStaysSameAllowed = !isCopyLinkageWeak && !!controlCopyAngle && controlCopyAngle !== "Unavailable";
    const isCopyPairStaysSameAllowed = !isCopyLinkageWeak && !!controlCopyPair && controlCopyPair !== "Unavailable";

    const buildStaysSame = (components: string[]): string => {
      let list = [...components];
      if (!isCopyAngleStaysSameAllowed) {
        list = list.filter(c => c !== "Copy Angle");
      }
      if (!isCopyPairStaysSameAllowed) {
        list = list.filter(c => c !== "Copy Pair");
      }
      return list.join(", ");
    };

    // Calculate if an alternate copy pair exists inside the same copy angle
    const sameAngleCopyPairs = Array.from(new Set(
      normalizedReports
        .filter(r => r.copyAngle === controlCopyAngle && r.copyPairHook !== null)
        .map(r => r.copyPairHook)
    ));
    const alternateSameAngleCopyPairExists = controlCopyPair
      ? sameAngleCopyPairs.filter(cp => cp !== controlCopyPair).length > 0
      : false;

    const getSuggestedPattern = (
      releaseSlug: string,
      visual: string | null,
      section: string | null,
      rev: string = "revX"
    ): string => {
      const normVis = visual ? visual.toLowerCase().replace(/\s+/g, "") : "[new_visual]";
      const normSec = section ? normalizeSongSectionToken(section) : "[current_songsection]";
      return `${releaseSlug}_${normVis}_${normSec}_${rev}`;
    };

    const formatSuggestedPattern = (pattern: string): string => {
      if (pattern.includes("[") || pattern.includes("]")) {
        let clean = pattern
          .replace(/\[visual\]/g, "[new_visual]")
          .replace(/\[songsection\]/g, "[current_songsection]");
        if (!clean.startsWith("Suggested Template:")) {
          clean = `Suggested Template: ${clean}`;
        }
        return clean;
      }
      return pattern;
    };

    const addCandidate = (
      suggestedPattern: string,
      whatChanges: string,
      whatStaysSame: string,
      whyMatters: string,
      confidence: "High" | "Moderate" | "Directional"
    ) => {
      if (iterationCandidates.length >= 2) return;
      iterationCandidates.push({
        suggestedPattern: formatSuggestedPattern(suggestedPattern),
        whatChanges,
        whatStaysSame,
        whyMatters,
        confidence
      });
    };

    let releaseSlug = "release";
    if (controlAd) {
      const parsed = parseAdName(controlAd);
      if (parsed.release && parsed.release !== "Unparsed") releaseSlug = parsed.release;
    } else if (normalizedReports.length > 0) {
      const parsed = parseAdName(normalizedReports[0].adName);
      if (parsed.release && parsed.release !== "Unparsed") releaseSlug = parsed.release;
    }

    const currentVis = controlVisual || (meaningfulVisuals[0]?.value) || null;
    const currentSec = controlSongSection || (meaningfulSections[0]?.value) || null;
    const currentAngle = controlCopyAngle || (meaningfulAngles[0]?.value) || null;

    const alternateVisual = currentVis?.startsWith("amv") ? "2screens" : "amv916";
    const alternateSection = currentSec?.toLowerCase() === "chorus" ? "verse1" : "chorus";

    if (meaningfulVisuals.length < 2) {
      const pattern = getSuggestedPattern(releaseSlug, currentVis ? alternateVisual : null, currentSec);
      addCandidate(
        pattern,
        `Visual Format: Test format ${currentVis ? alternateVisual : "[new_visual]"}`,
        buildStaysSame(["Song Section", "Copy Angle", "Copy Pair"]),
        currentVis
          ? `Only one visual format (${currentVis}) has meaningful spend. Test a new visual format while keeping other components the same to check scroll-stop engagement.`
          : `No visual format has meaningful spend. Test a new visual format while keeping other components the same to check scroll-stop engagement.`,
        "Moderate"
      );
    }

    if (meaningfulSections.length < 2) {
      const pattern = getSuggestedPattern(releaseSlug, currentVis, currentSec ? alternateSection : null);
      addCandidate(
        pattern,
        `Song Section: Test section ${currentSec ? alternateSection : "[new_songsection]"}`,
        buildStaysSame(["Visual Format", "Copy Angle", "Copy Pair"]),
        currentSec
          ? `Only one song section (${currentSec}) has meaningful spend. Test a new song section while keeping other components the same to optimize retention.`
          : `No song section has meaningful spend. Test a new song section while keeping other components the same to optimize retention.`,
        "Moderate"
      );
    }

    if (!isCopyLinkageWeak && meaningfulAngles.length < 2) {
      const pattern = getSuggestedPattern(releaseSlug, currentVis, currentSec);
      addCandidate(
        pattern,
        "Copy Angle + Copy Pair. Test a new challenger message.",
        buildStaysSame(["Visual Format", "Song Section"]),
        currentAngle
          ? `Only one copy angle (${currentAngle}) has meaningful spend. Test a new copy angle while keeping other components the same to drive higher click intent.`
          : `No copy angle has meaningful spend. Test a new copy angle while keeping other components the same to drive higher click intent.`,
        "Moderate"
      );
    }

    if (controlAd && iterationCandidates.length === 0) {
      if (visualStatus === "Strong" && ["Weak", "Below Average", "Needs Challenger"].includes(songSectionStatus) && controlVisual && controlSongSection) {
        const pattern = getSuggestedPattern(releaseSlug, controlVisual, alternateSection);
        addCandidate(
          pattern,
          `Song Section: Test alternate section ${alternateSection} instead of ${controlSongSection}`,
          buildStaysSame(["Visual Format", "Copy Angle", "Copy Pair"]),
          `The visual format is strong but the song section shows weak retention. Test ${alternateSection} to improve hold times.`,
          "High"
        );
      }
      if (songSectionStatus === "Strong" && (!isCopyLinkageWeak && copyAngleStatus === "Strong") && ["Weak", "Below Average", "Needs Challenger"].includes(visualStatus) && controlVisual && controlSongSection) {
        const pattern = getSuggestedPattern(releaseSlug, alternateVisual, controlSongSection);
        addCandidate(
          pattern,
          `Visual Format: Test alternate format ${alternateVisual} instead of ${controlVisual}`,
          buildStaysSame(["Song Section", "Copy Angle", "Copy Pair"]),
          `Visual format underperformed but song section and copy are strong. Iterate with ${alternateVisual}.`,
          "High"
        );
      }
      if (!isCopyLinkageWeak && visualStatus === "Strong" && songSectionStatus === "Strong" && ["Weak", "Below Average", "Needs Challenger"].includes(copyAngleStatus) && controlVisual && controlSongSection) {
        const pattern = getSuggestedPattern(releaseSlug, controlVisual, controlSongSection);
        addCandidate(
          pattern,
          "Copy Angle + Copy Pair. Test a new challenger message.",
          buildStaysSame(["Visual Format", "Song Section"]),
          `The creative structure is converting well but copy engagement is weak. Test a new Copy Angle to drive clicks.`,
          "High"
        );
      }
    }

    if (controlAd && iterationCandidates.length === 0 && (visualStatus === "Strong" || visualStatus === "Neutral")) {
      let whatChanges = "";
      let staysSameComponents: string[] = [];
      let pattern = "";
      let confidence: "High" | "Moderate" | "Directional" = "High";
      let whyMatters = "";

      if (testComponent === "Visual Format") {
        whatChanges = `Visual Format: Test alternate format ${alternateVisual} instead of ${controlVisual || "2screens"}`;
        staysSameComponents = ["Song Section", "Copy Angle", "Copy Pair"];
        pattern = getSuggestedPattern(releaseSlug, alternateVisual, controlSongSection);
        whyMatters = `The current control is working. Duplicate it and test a new Visual Format challenger.`;
      } else if (testComponent === "Song Section") {
        whatChanges = `Song Section: Test alternate section ${alternateSection} instead of ${controlSongSection || "chorus"}`;
        staysSameComponents = ["Visual Format", "Copy Angle", "Copy Pair"];
        pattern = getSuggestedPattern(releaseSlug, controlVisual, alternateSection);
        whyMatters = `The current control is working. Duplicate it and test a new Song Section challenger.`;
      } else if (testComponent === "Copy Angle" && !isCopyLinkageWeak) {
        whatChanges = "Copy Angle + Copy Pair. Test a new challenger message.";
        staysSameComponents = ["Visual Format", "Song Section"];
        pattern = getSuggestedPattern(releaseSlug, controlVisual, controlSongSection);
        whyMatters = `The current control is working. Duplicate it and test a new Copy Angle challenger.`;
      } else if (testComponent === "Copy Pair" && !isCopyLinkageWeak) {
        if (alternateSameAngleCopyPairExists) {
          whatChanges = "Copy Pair: Test alternate copy pair/hook.";
          staysSameComponents = ["Visual Format", "Song Section", "Copy Angle"];
          pattern = getSuggestedPattern(releaseSlug, controlVisual, controlSongSection);
          whyMatters = `The current control is working. Duplicate it and test a new Copy Pair challenger within the same Copy Angle.`;
        } else {
          whatChanges = "Copy Angle + Copy Pair. Test a new challenger message.";
          staysSameComponents = ["Visual Format", "Song Section"];
          pattern = getSuggestedPattern(releaseSlug, controlVisual, controlSongSection);
          whyMatters = `The current control is working. Duplicate it and test a new Copy Angle challenger.`;
        }
      } else {
        if (isCopyLinkageWeak) {
          if (visualStatus !== "Strong") {
            whatChanges = `Visual Format: Test alternate format ${alternateVisual} instead of ${controlVisual || "2screens"}`;
            staysSameComponents = ["Song Section"];
            pattern = getSuggestedPattern(releaseSlug, alternateVisual, controlSongSection);
            whyMatters = `Copy diagnosis is unavailable due to weak copy linkage. Test a new Visual Format challenger.`;
          } else {
            whatChanges = `Song Section: Test alternate section ${alternateSection} instead of ${controlSongSection || "chorus"}`;
            staysSameComponents = ["Visual Format"];
            pattern = getSuggestedPattern(releaseSlug, controlVisual, alternateSection);
            whyMatters = `Copy diagnosis is unavailable due to weak copy linkage. Test a new Song Section challenger.`;
          }
        } else {
          whatChanges = "Copy Angle + Copy Pair. Test a new challenger message.";
          staysSameComponents = ["Visual Format", "Song Section"];
          pattern = getSuggestedPattern(releaseSlug, controlVisual, controlSongSection);
          whyMatters = `The current control is working. Duplicate it and test a new Copy Angle challenger.`;
        }
      }

      addCandidate(
        pattern,
        whatChanges,
        buildStaysSame(staysSameComponents),
        whyMatters,
        confidence
      );
    }

    if (iterationCandidates.length === 0) {
      addCandidate(
        getSuggestedPattern(releaseSlug, null, currentSec),
        "Visual Format: Test alternate format",
        buildStaysSame(["Song Section", "Copy Angle", "Copy Pair"]),
        "No strong control exists and visual coverage is narrow. Run a controlled test with an alternate visual format to establish a baseline.",
        "Directional"
      );

      addCandidate(
        getSuggestedPattern(releaseSlug, currentVis, null),
        "Song Section: Test alternate section",
        buildStaysSame(["Visual Format", "Copy Angle", "Copy Pair"]),
        "No strong control exists and song section coverage is narrow. Run a controlled test with an alternate song section to establish a baseline.",
        "Directional"
      );
    }

    componentDiagnosis = {
      controlAd,
      controlVisual,
      controlSongSection,
      controlCopyAngle: isCopyLinkageWeak ? "Unavailable" : (controlCopyAngle || "Unavailable"),
      controlCopyPair: isCopyLinkageWeak ? "Unavailable" : (controlCopyPair || "Unavailable"),
      visualStatus,
      songSectionStatus,
      copyAngleStatus,
      copyPairStatus,
      visualReason,
      songSectionReason,
      copyAngleReason,
      copyPairReason,
      strongestComponent,
      weakestComponent,
      preserveComponents,
      testComponent: specificTestComponent,
      coverageWarnings,
      iterationCandidates,
      diagnosisRead,
      diagnosisComment
    };

    if (!latestLearning?.next_test?.trim()) {
      if (isCopyLinkageWeak) {
        const isVisualNarrowOrChallenger = visualStatus === "Narrow Coverage" ||
                                           visualStatus === "Needs Challenger" ||
                                           visualStatus === "Untested" ||
                                           meaningfulVisuals.length < 2;
        const isSectionNarrowOrChallenger = songSectionStatus === "Narrow Coverage" ||
                                            songSectionStatus === "Needs Challenger" ||
                                            songSectionStatus === "Untested" ||
                                            meaningfulSections.length < 2;

        const target = controlAd || "the winning creative";

        if (isVisualNarrowOrChallenger) {
          if (controlAd) {
            nextTestDirection = `Protect ${target} as the control and test a new visual format.`;
          } else {
            nextTestDirection = "Test a new visual format to establish a baseline.";
          }
        } else if (isSectionNarrowOrChallenger) {
          if (controlAd) {
            nextTestDirection = `Protect ${target} as the control and test a new song section.`;
          } else {
            nextTestDirection = "Test a new song section to establish a baseline.";
          }
        } else {
          nextTestDirection = "Gather more data or link Copy Lab entries before diagnosing copy.";
        }
      } else {
        const isStrongDiagnosis = preserveComponents.length > 0 || weakestComponent !== null;
        if (isStrongDiagnosis && iterationCandidates.length > 0) {
          const primary = iterationCandidates[0];
          nextTestDirection = `Component Iteration recommendation (System Diagnosis): Duplicate control ${controlAd || ""}, preserve ${preserveComponents.join(" and ") || "creative structure"}, and test ${primary.whatChanges.toLowerCase()}. Reason: ${primary.whyMatters}`;
        }
      }
    }
  }

  return {
    campaignDecision,
    controlAd,
    batchAction,
    funnelVerdict,
    nextTestDirection,
    dataWarnings,
    recommendationConfidence: confidence,
    operatorOverrideSource,
    componentDiagnosis
  };
}
