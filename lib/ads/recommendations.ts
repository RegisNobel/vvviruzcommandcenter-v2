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
  visualStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested";
  songSectionStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested";
  copyAngleStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested";
  copyPairStatus: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested";
  strongestComponent: string | null;
  weakestComponent: string | null;
  preserveComponents: string[];
  testComponent: string | null;
  coverageWarnings: string[];
  iterationCandidates: IterationCandidate[];
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

    const getStatus = (agg: ComponentAggregate | undefined): "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" => {
      if (!agg || agg.spend === 0) return "Untested";
      if (agg.spend < 10 && agg.results < 5) return "Low Data";

      const cpr = agg.results > 0 ? agg.spend / agg.results : null;
      const ssr = agg.impressions > 0 ? (agg.threeSecondPlays / agg.impressions) * 100 : 0;
      const ctr = agg.impressions > 0 ? (agg.linkClicks / agg.impressions) * 100 : 0;
      const vhr = agg.threeSecondPlays > 0 ? (agg.thruPlays / agg.threeSecondPlays) * 100 : 0;

      const isWeakSSR = agg.impressions >= 100 && ssr < 20.0;
      const isWeakCTR = agg.impressions >= 100 && ssr >= 22.0 && ctr < 0.8;
      const isWeakVHR = agg.impressions >= 100 && ssr >= 22.0 && vhr < 15.0;

      let isWeakCpr = false;
      if (targetCpr !== null && targetCpr !== undefined && targetCpr > 0) {
        isWeakCpr = cpr === null || cpr >= 1.5 * targetCpr;
      } else if (averageCpr !== null && averageCpr > 0) {
        isWeakCpr = cpr === null || cpr >= 1.25 * averageCpr;
      } else {
        isWeakCpr = cpr === null;
      }

      if (isWeakCpr || isWeakSSR || isWeakCTR || isWeakVHR) return "Weak";

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

      if (isStrongCpr && agg.results >= 5 && isConfidenceNotLow) return "Strong";

      return "Neutral";
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

    const visualStatus = controlVisual ? getStatus(visualAggs.get(controlVisual)) : "Untested";
    const songSectionStatus = controlSongSection ? getStatus(songSectionAggs.get(controlSongSection)) : "Untested";
    const copyAngleStatus = controlCopyAngle ? getStatus(copyAngleAggs.get(controlCopyAngle)) : "Untested";
    const copyPairStatus = controlCopyPair ? getStatus(copyPairAggs.get(controlCopyPair)) : "Untested";

    const componentsList = [
      { name: "Visual Format", value: controlVisual, status: visualStatus, agg: controlVisual ? visualAggs.get(controlVisual) : undefined },
      { name: "Song Section", value: controlSongSection, status: songSectionStatus, agg: controlSongSection ? songSectionAggs.get(controlSongSection) : undefined },
      { name: "Copy Angle", value: controlCopyAngle, status: copyAngleStatus, agg: controlCopyAngle ? copyAngleAggs.get(controlCopyAngle) : undefined },
      { name: "Copy Pair", value: controlCopyPair, status: copyPairStatus, agg: controlCopyPair ? copyPairAggs.get(controlCopyPair) : undefined }
    ].filter(c => c.value !== null);

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

    const weakComponents = componentsList.filter(c => c.status === "Weak");
    let weakestComponent: string | null = null;
    if (weakComponents.length > 0) {
      weakComponents.sort((a, b) => {
        const cprA = a.agg ? (a.agg.results > 0 ? a.agg.spend / a.agg.results : Infinity) : Infinity;
        const cprB = b.agg ? (b.agg.results > 0 ? b.agg.spend / b.agg.results : Infinity) : Infinity;
        if (cprB !== cprA) return cprB - cprA;
        const resA = a.agg?.results ?? 0;
        const resB = b.agg?.results ?? 0;
        return resA - resB;
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

    const coverageWarnings: string[] = [];
    const meaningfulVisuals = Array.from(visualAggs.values()).filter(v => v.spend >= 10);
    const meaningfulSections = Array.from(songSectionAggs.values()).filter(s => s.spend >= 10);
    const meaningfulAngles = Array.from(copyAngleAggs.values()).filter(a => a.spend >= 10);

    if (meaningfulVisuals.length < 2) {
      const existing = meaningfulVisuals[0]?.value || "none";
      coverageWarnings.push(`Coverage is narrow: only ${existing} has meaningful spend.`);
    }
    if (meaningfulSections.length < 2) {
      const existing = meaningfulSections[0]?.value || "none";
      coverageWarnings.push(`Coverage is narrow: only ${existing} has meaningful spend.`);
    }
    if (meaningfulAngles.length < 2) {
      const existing = meaningfulAngles[0]?.value || "none";
      coverageWarnings.push(`Coverage is narrow: only ${existing} has meaningful spend.`);
    }

    const linkedSpend = normalizedReports.filter(r => r.copyPairHook !== null).reduce((sum, r) => sum + r.spend, 0);
    const copyLinkagePercentage = totalSpend > 0 ? (linkedSpend / totalSpend) * 100 : 0;
    if (copyLinkagePercentage < 70 && totalSpend >= 10) {
      coverageWarnings.push("Copy pair diagnosis is unavailable because copy linkage coverage is weak (under 70% of spend is linked).");
    }

    const iterationCandidates: IterationCandidate[] = [];

    const addCandidate = (
      suggestedPattern: string,
      whatChanges: string,
      whatStaysSame: string,
      whyMatters: string,
      confidence: "High" | "Moderate" | "Directional"
    ) => {
      if (iterationCandidates.length >= 2) return;
      iterationCandidates.push({
        suggestedPattern,
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

    const alternateVisual = controlVisual?.startsWith("amv") ? "2screens" : "amv916";
    const alternateSection = controlSongSection?.toLowerCase() === "chorus" ? "verse1" : "chorus";

    if (meaningfulVisuals.length === 1 && getStatus(meaningfulVisuals[0]) === "Weak") {
      const currentVis = meaningfulVisuals[0].value;
      const altVis = currentVis.startsWith("amv") ? "2screens" : "amv916";
      addCandidate(
        `${releaseSlug}_${altVis}_[songsection]_rev1`,
        `Visual Format: Test ${altVis} instead of ${currentVis}`,
        `Song Section & Copy Angle: Keep existing hooks/sections`,
        `Only one visual format (${currentVis}) has spend and it underperformed. Test ${altVis} before judging the release.`,
        "Moderate"
      );
    }

    if (meaningfulSections.length === 1 && getStatus(meaningfulSections[0]) === "Weak") {
      const currentSec = meaningfulSections[0].value;
      const altSec = currentSec.toLowerCase() === "chorus" ? "verse1" : "chorus";
      addCandidate(
        `${releaseSlug}_[visual]_${altSec.toLowerCase()}_rev1`,
        `Song Section: Test ${altSec} instead of ${currentSec}`,
        `Visual Format & Copy: Keep existing visuals/copy`,
        `Only one song section (${currentSec}) has spend and it underperformed. Test ${altSec} before judging the release.`,
        "Moderate"
      );
    }

    if (meaningfulAngles.length === 1 && getStatus(meaningfulAngles[0]) === "Weak") {
      const currentAngle = meaningfulAngles[0].value;
      addCandidate(
        `${releaseSlug}_[visual]_[songsection]_rev1`,
        `Copy Angle: Test a different Copy Angle instead of ${currentAngle}`,
        `Visual & Song Section: Keep creative structure`,
        `Only one copy angle (${currentAngle}) has spend and it underperformed. Test another angle to check click intent.`,
        "Moderate"
      );
    }

    if (controlAd) {
      if (visualStatus === "Strong" && songSectionStatus === "Weak" && controlVisual && controlSongSection) {
        addCandidate(
          `${releaseSlug}_${controlVisual}_${alternateSection.toLowerCase()}_rev1`,
          `Song Section: Test ${alternateSection} instead of ${controlSongSection}`,
          `Visual & Copy: Keep ${controlVisual} and current Copy Angle`,
          `The visual format is strong but the song section shows weak retention. Test ${alternateSection} to improve hold times.`,
          "High"
        );
      }
      if (songSectionStatus === "Strong" && copyAngleStatus === "Strong" && visualStatus === "Weak" && controlVisual && controlSongSection) {
        addCandidate(
          `${releaseSlug}_${alternateVisual}_${controlSongSection.toLowerCase()}_rev1`,
          `Visual Format: Test ${alternateVisual} instead of ${controlVisual}`,
          `Song & Copy: Keep ${controlSongSection} and current Copy Angle`,
          `Visual format underperformed but song section and copy are strong. Iterate with ${alternateVisual}.`,
          "High"
        );
      }
      if (visualStatus === "Strong" && songSectionStatus === "Strong" && copyAngleStatus === "Weak" && controlVisual && controlSongSection) {
        addCandidate(
          `${releaseSlug}_${controlVisual}_${controlSongSection.toLowerCase()}_rev1`,
          `Copy Angle: Test a new Copy Angle challengers`,
          `Creative Structure: Keep winning ${controlVisual} + ${controlSongSection}`,
          `The creative is converting well but copy engagement is weak. Test a new Copy Angle to drive clicks.`,
          "High"
        );
      }
    }

    if (controlAd && iterationCandidates.length === 0 && (visualStatus === "Strong" || visualStatus === "Neutral")) {
      let targetComp = "Copy Angle";
      let whatChanges = "Copy Angle: Test a new challenger angle";
      let pattern = `${releaseSlug}_${controlVisual || "[visual]"}_${(controlSongSection || "[songsection]").toLowerCase()}_rev1`;

      if (testComponent === "Visual Format") {
        targetComp = "Visual Format";
        whatChanges = `Visual Format: Test ${alternateVisual} instead of ${controlVisual}`;
        pattern = `${releaseSlug}_${alternateVisual}_${(controlSongSection || "[songsection]").toLowerCase()}_rev1`;
      } else if (testComponent === "Song Section") {
        targetComp = "Song Section";
        whatChanges = `Song Section: Test ${alternateSection} instead of ${controlSongSection}`;
        pattern = `${releaseSlug}_${controlVisual || "[visual]"}_${alternateSection.toLowerCase()}_rev1`;
      }

      const visStr = controlVisual || "[visual]";
      const secStr = controlSongSection || "[songsection]";

      addCandidate(
        pattern,
        whatChanges,
        `Other Components: Preserve winning structure (${visStr} + ${secStr})`,
        `The current control is working. Duplicate it and test a new ${targetComp} challenger.`,
        "High"
      );
    }

    if (iterationCandidates.length === 0) {
      addCandidate(
        `${releaseSlug}_[visual]_[songsection]_rev1`,
        `Controlled Coverage Test: Test new visuals/sections`,
        `Structure: Keep variables aligned`,
        `No strong control exists and test coverage is narrow. Run a controlled test across untested dimensions to establish a baseline.`,
        "Directional"
      );
    }

    componentDiagnosis = {
      controlAd,
      controlVisual,
      controlSongSection,
      controlCopyAngle,
      controlCopyPair,
      visualStatus,
      songSectionStatus,
      copyAngleStatus,
      copyPairStatus,
      strongestComponent,
      weakestComponent,
      preserveComponents,
      testComponent,
      coverageWarnings,
      iterationCandidates
    };

    if (!latestLearning?.next_test?.trim()) {
      const isStrongDiagnosis = preserveComponents.length > 0 || weakestComponent !== null;
      if (isStrongDiagnosis && iterationCandidates.length > 0) {
        const primary = iterationCandidates[0];
        nextTestDirection = `Component Iteration recommendation (System Diagnosis): Duplicate control ${controlAd || ""}, preserve ${preserveComponents.join(" and ") || "creative structure"}, and test ${primary.whatChanges.toLowerCase()}. Reason: ${primary.whyMatters}`;
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
