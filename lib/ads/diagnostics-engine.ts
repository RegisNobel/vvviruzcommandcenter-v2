import fs from "node:fs";
import path from "node:path";
import { parseAdName } from "@/lib/ads/naming-parser";
import { calculateConfidenceSignal } from "@/lib/ads/stats";
import { formatHookType, formatSongSection } from "@/lib/copy";
import { normalizeMetaAdName } from "@/lib/ads/meta-csv";
import type {
  AdCreativeReportRecord,
  AdLinkFollowThroughRecord,
  AdImportBatchDetail,
  CreativePerformanceMemory,
  CopyPerformanceMemory,
  CreativeDiagnostic,
  NextTestSuggestion,
  DiagnosticType
} from "@/lib/types";

const DIAGNOSTIC_PRIORITIES: Record<DiagnosticType, number> = {
  "data-quality-warning": 1,
  "landing-follow-through-issue": 2,
  "strong-control": 3,
  "maintain-consider-scale": 4,
  "pause-retire": 5,
  "retest-contender": 6,
  "weak-visual-scroll-stop": 7,
  "weak-copy-click-intent": 8,
  "weak-song-section-retention": 9,
  "combo-test": 10
};

export function calculateBatchDiagnostics(
  detail: AdImportBatchDetail,
  options?: {
    batchCountMap?: Record<string, number>;
    hasOverlappingSnapshots?: boolean;
  }
): CreativeDiagnostic[] {
  const diagnostics: CreativeDiagnostic[] = [];
  const batchCountMap = options?.batchCountMap;
  const hasOverlappingSnapshots = options?.hasOverlappingSnapshots;

  const batchTotalResults = detail.results ?? 0;
  const batchTotalImpressions = detail.impressions ?? 0;
  const batchTotalLinkClicks = detail.link_clicks ?? 0;
  const batchTotalSpend = detail.spend ?? 0;
  const batchAverageCpr = batchTotalResults > 0 ? batchTotalSpend / batchTotalResults : null;

  // Track if there's any batch-level data quality issue we should flag
  const totalReportsCount = detail.reports.length;
  const reportsWithUtmsCount = detail.reports.filter(
    (r) => r.utm_campaign && r.utm_content
  ).length;
  const utmCoveragePercentage = totalReportsCount > 0 ? (reportsWithUtmsCount / totalReportsCount) * 100 : 0;
  const isWeakUtmCoverage = utmCoveragePercentage < 50;

  // Batch-level unlinked copy spend warning
  const unlinkedSpend = detail.reports
    .filter((r) => !r.linked_copy)
    .reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const unlinkedSpendPercentage = batchTotalSpend > 0 ? (unlinkedSpend / batchTotalSpend) * 100 : 0;

  if (unlinkedSpendPercentage > 15 && batchTotalSpend >= 10.0) {
    diagnostics.push({
      adName: "Campaign Overview",
      type: "data-quality-warning",
      action: "High unlinked copy spend detected.",
      severity: "warning",
      reason: `Suggests that a large portion of campaign spend (${unlinkedSpendPercentage.toFixed(1)}%) is on ads not linked to Copy Lab entries. Link copy entries to improve strategy breakdowns.`,
      confidence: "Moderate",
      evidence: `Unlinked Spend: ${unlinkedSpendPercentage.toFixed(1)}%`
    });
  }

  // Batch-level UTM tracking coverage warning
  if (isWeakUtmCoverage && totalReportsCount >= 3) {
    diagnostics.push({
      adName: "Campaign Overview",
      type: "data-quality-warning",
      action: "Weak UTM tracking coverage.",
      severity: "warning",
      reason: `Suggests incomplete click tracking. Less than 50% of ads have UTM campaign/content tags. First-party attribution matches will be partial or missing.`,
      confidence: "Moderate",
      evidence: `UTM Coverage: ${utmCoveragePercentage.toFixed(1)}%`
    });
  }

  // Batch-level overlapping snapshots warning
  if (hasOverlappingSnapshots) {
    diagnostics.push({
      adName: "Campaign Overview",
      type: "data-quality-warning",
      action: "Overlapping snapshot ranges detected.",
      severity: "warning",
      reason: "Suggests potential double-counting or data skew. This batch's reporting window overlaps with another imported batch for this release.",
      confidence: "Moderate",
      evidence: "Overlapping date ranges in release history"
    });
  }

  for (const report of detail.reports) {
    const adName = report.ad_name;
    const spend = report.spend ?? 0;
    const impressions = report.impressions ?? 0;
    const results = report.results ?? 0;
    const linkClicks = report.link_clicks ?? 0;
    const landingPageViews = report.landing_page_views ?? 0;
    const cpr = report.cost_per_result ?? (results > 0 ? spend / results : null);
    const ctr = report.ctr ?? (impressions > 0 ? (linkClicks / impressions) * 100 : 0);
    const thruPlays = report.thru_plays ?? 0;
    const threeSecondPlays = report.three_second_plays ?? 0;
    const video100 = report.video_100 ?? 0;
    const video50 = report.video_50 ?? 0;
    const postReactions = report.post_reactions ?? 0;
    const postComments = report.post_comments ?? 0;
    const postShares = report.post_shares ?? 0;
    const postSaves = report.post_saves ?? 0;
    const instagramFollows = report.instagram_follows ?? 0;

    const followThrough = detail.link_follow_through.find((ft) => ft.ad_report_id === report.id);
    const linksPageViews = followThrough?.links_page_views ?? 0;
    const outboundStreamingClicks = followThrough?.outbound_streaming_clicks ?? 0;

    // Derived metrics
    const ssr = impressions > 0 ? (threeSecondPlays / impressions) * 100 : 0;
    const vhr = (thruPlays > 0 && threeSecondPlays > 0)
      ? (thruPlays / threeSecondPlays) * 100 
      : (threeSecondPlays > 0 ? (video50 / threeSecondPlays) * 100 : 0);
    const clr = linkClicks > 0 ? (landingPageViews / linkClicks) * 100 : 0;
    const sir = linksPageViews > 0 ? (outboundStreamingClicks / linksPageViews) * 100 : 0;
    const er = impressions > 0 
      ? ((postReactions + postComments + postShares + postSaves + instagramFollows) / impressions) * 100 
      : 0;

    const confidenceSignal = calculateConfidenceSignal({
      spend,
      impressions,
      results,
      linkClicks,
      batchTotalResults,
      batchTotalImpressions,
      batchTotalLinkClicks
    });

    const isWinnerSignal = confidenceSignal.score.includes("Confidence");
    const isUnderperformingSignal = confidenceSignal.score.includes("Underperforming");

    // Determine confidence label
    let confidence: "High" | "Moderate" | "Directional" | "Needs More Data" = "Directional";
    if (spend < 5.0 || impressions < 200) {
      confidence = "Needs More Data";
    } else if (spend >= 25.0 && impressions >= 1000 && (results >= 10 || isWinnerSignal)) {
      confidence = "High";
    } else if (spend >= 10.0 && impressions >= 500 && (results >= 3 || linkClicks >= 15)) {
      confidence = "Moderate";
    }

    const adDiagnostics: CreativeDiagnostic[] = [];

    // Rule 0: Data Quality Warning
    if (spend > 0 && (spend < 5.0 || impressions < 200)) {
      adDiagnostics.push({
        adName,
        type: "data-quality-warning",
        action: "Low sample size warning.",
        severity: "warning",
        reason: "Suggests early metrics may be dominated by statistical noise due to low spend or impressions.",
        confidence: "Needs More Data",
        evidence: `Spend: $${spend.toFixed(2)} · Impressions: ${impressions}`
      });
    }

    const hasVideoData = threeSecondPlays > 0 || thruPlays > 0 || video100 > 0 || video50 > 0;
    const isParsedAsVideo = parseAdName(adName).visual.toLowerCase().startsWith("amv") || 
                            parseAdName(adName).visual.toLowerCase().includes("screens") ||
                            parseAdName(adName).visual.toLowerCase().includes("perf");
                            
    if (isParsedAsVideo && !hasVideoData && spend >= 5.0) {
      adDiagnostics.push({
        adName,
        type: "data-quality-warning",
        action: "Missing video retention data.",
        severity: "warning",
        reason: "Suggests the Meta CSV upload does not contain video views or ThruPlays. Verify you imported the 'Video' performance view.",
        confidence: "Needs More Data",
        evidence: `No 3s plays or ThruPlays recorded.`
      });
    }

    // Rule 1: Landing / Follow-Through Issue
    if (linkClicks >= 10) {
      if (clr > 0 && clr < 50.0) {
        if (isWeakUtmCoverage || (!report.utm_campaign && !report.utm_content)) {
          adDiagnostics.push({
            adName,
            type: "landing-follow-through-issue",
            action: "Review tracking setup and verify link click handoff.",
            severity: "warning",
            reason: "Suggests a potential landing page view conversion issue. However, due to weak or missing UTM campaign/content tags on this ad, there is tracking uncertainty in matching clicks to first-party page views.",
            confidence: "Directional",
            evidence: `Meta Clicks: ${linkClicks} · Landed Views: ${landingPageViews} · Match Rate: ${clr.toFixed(1)}%`
          });
        } else {
          adDiagnostics.push({
            adName,
            type: "landing-follow-through-issue",
            action: "Check landing page, tracking, or stream-link follow-through.",
            severity: "danger",
            reason: "Suggests significant drop-off between Meta link clicks and landed page views. Check your landing page load latency or redirection script.",
            confidence: confidence === "Needs More Data" ? "Directional" : confidence,
            evidence: `Meta Clicks: ${linkClicks} · Landed Views: ${landingPageViews} · Handoff Rate: ${clr.toFixed(1)}%`
          });
        }
      } else if (linksPageViews >= 10 && sir > 0 && sir < 30.0) {
        if (isWeakUtmCoverage || (!report.utm_campaign && !report.utm_content)) {
          adDiagnostics.push({
            adName,
            type: "landing-follow-through-issue",
            action: "Review tracking setup and verify stream-link clicks.",
            severity: "warning",
            reason: "Suggests a potential streaming conversion issue on the landing page. However, due to weak or missing UTM campaign/content tags on this ad, there is tracking uncertainty in matching views to outbound clicks.",
            confidence: "Directional",
            evidence: `Landed Views: ${linksPageViews} · Outbound Clicks: ${outboundStreamingClicks} · Stream Intent: ${sir.toFixed(1)}%`
          });
        } else {
          adDiagnostics.push({
            adName,
            type: "landing-follow-through-issue",
            action: "Check landing page, tracking, or stream-link follow-through.",
            severity: "danger",
            reason: "Suggests visitors land on the link page but fail to click through to any music service. Check the clarity and ordering of the music links.",
            confidence: confidence === "Needs More Data" ? "Directional" : confidence,
            evidence: `Landed Views: ${linksPageViews} · Outbound Clicks: ${outboundStreamingClicks} · Stream Intent: ${sir.toFixed(1)}%`
          });
        }
      }
    }

    // Rule 2: Strong Control & Maintain / Consider Scale
    if (spend >= 50.0 && results >= 10 && cpr !== null && batchAverageCpr !== null && cpr <= batchAverageCpr && isWinnerSignal) {
      const norm = normalizeMetaAdName(adName);
      const isMultiBatch = batchCountMap && batchCountMap[norm] && batchCountMap[norm] > 1;
      if (isMultiBatch) {
        adDiagnostics.push({
          adName,
          type: "strong-control",
          action: "Strong Control ad.",
          severity: "success",
          reason: "Suggests strong, repeatable performance across multiple batch cycles. Protect this ad as the baseline control.",
          confidence: "High",
          evidence: `Spend: $${spend.toFixed(2)} · Results: ${results} · CPR: $${cpr.toFixed(2)} (vs Avg $${batchAverageCpr.toFixed(2)}) · Batches: ${batchCountMap[norm]}`
        });
      } else {
        adDiagnostics.push({
          adName,
          type: "maintain-consider-scale",
          action: "Maintain / Consider Control.",
          severity: "success",
          reason: "Suggests strong performance in this batch. Protect this ad as a candidate control and monitor its efficiency in future snapshot imports.",
          confidence: "High",
          evidence: `Spend: $${spend.toFixed(2)} · Results: ${results} · CPR: $${cpr.toFixed(2)} (vs Avg $${batchAverageCpr.toFixed(2)})`
        });
      }
    }
    // Rule 3: Maintain / Consider Scale (standard)
    else if (spend >= 20.0 && results >= 5 && cpr !== null && batchAverageCpr !== null && cpr <= batchAverageCpr && (isWinnerSignal || confidence === "High" || confidence === "Moderate")) {
      adDiagnostics.push({
        adName,
        type: "maintain-consider-scale",
        action: "Maintain / Consider Scaling this ad.",
        severity: "success",
        reason: "Suggests high conversion efficiency and solid confidence. Consider scaling budget slowly.",
        confidence: confidence === "Needs More Data" ? "Directional" : confidence,
        evidence: `Spend: $${spend.toFixed(2)} · Results: ${results} · CPR: $${cpr.toFixed(2)} (vs Avg $${batchAverageCpr.toFixed(2)}) · Conf: ${confidenceSignal.score}`
      });
    }

    // Rule 4: Pause / Retire
    if (spend >= 10.0 && (results === 0 || (cpr !== null && batchAverageCpr !== null && cpr >= 1.5 * batchAverageCpr))) {
      adDiagnostics.push({
        adName,
        type: "pause-retire",
        action: "Pause or retire this ad.",
        severity: "danger",
        reason: results === 0 
          ? "Suggests zero conversions. The creative has spent budget without delivering any results."
          : `Suggests inefficient delivery. Cost per result ($${cpr?.toFixed(2)}) is significantly worse than batch average ($${batchAverageCpr?.toFixed(2)}).`,
        confidence: isUnderperformingSignal ? "High" : (confidence === "Needs More Data" ? "Directional" : confidence),
        evidence: `Spend: $${spend.toFixed(2)} · Results: ${results} · CPR: ${cpr ? `$${cpr.toFixed(2)}` : "N/A"} · Conf: ${confidenceSignal.score}`
      });
    }

    // Rule 5: Retest Contender
    if (spend > 0 && spend < 10.0 && results < 3 && (ctr >= 1.5 || results >= 1 || er >= 3.0)) {
      adDiagnostics.push({
        adName,
        type: "retest-contender",
        action: "Suggests retesting this ad due to promising but low-data signals.",
        severity: "warning",
        reason: "Suggests early conversion interest or high engagement rate. Meta starved this ad of budget, so consider a retest in a clean campaign.",
        confidence: "Directional",
        evidence: `Spend: $${spend.toFixed(2)} · CTR: ${ctr.toFixed(2)}% · Results: ${results} · Engagement: ${er.toFixed(2)}%`
      });
    }

    // Video Diagnostics (require meaningful impressions and video data)
    if (impressions >= 500 && threeSecondPlays > 0) {
      // Rule 6: Weak Visual / Scroll-Stop
      if (ssr < 20.0) {
        adDiagnostics.push({
          adName,
          type: "weak-visual-scroll-stop",
          action: "Likely weak visual / scroll-stop issue. Test a new visual or opening edit.",
          severity: "warning",
          reason: "Suggests the first 3 seconds of the visual fail to grab attention. Scroll-stop rate is below standard benchmarks.",
          confidence: confidence === "Needs More Data" ? "Directional" : confidence,
          evidence: `Impressions: ${impressions} · 3s Plays: ${threeSecondPlays} · Scroll-Stop Rate: ${ssr.toFixed(1)}%`
        });
      }

      // Rule 7: Weak Copy / Click Intent
      if (ssr >= 22.0 && ctr < 0.8) {
        adDiagnostics.push({
          adName,
          type: "weak-copy-click-intent",
          action: "Likely weak copy / CTA / click-intent issue. Test a new Copy Pair or Copy Angle.",
          severity: "warning",
          reason: "Suggests the visual hook successfully stops scrolls, but the text overlay, caption copy, or call-to-action is failing to drive clicks.",
          confidence: confidence === "Needs More Data" ? "Directional" : confidence,
          evidence: `Scroll-Stop: ${ssr.toFixed(1)}% · Clicks: ${linkClicks} · CTR: ${ctr.toFixed(2)}%`
        });
      }

      // Rule 8: Weak Song Section / Retention
      if (ssr >= 22.0 && vhr < 15.0) {
        adDiagnostics.push({
          adName,
          type: "weak-song-section-retention",
          action: "Likely weak song-section / retention issue. Test a different song section.",
          reason: "Suggests that viewers stop scrolling to look at the visual, but drop off rapidly. This indicates the initial audio or song snippet failed to keep them.",
          severity: "warning",
          confidence: confidence === "Needs More Data" ? "Directional" : confidence,
          evidence: `Scroll-Stop: ${ssr.toFixed(1)}% · Video Hold: ${vhr.toFixed(1)}%`
        });
      }
    }

    // Sort by priority and limit to top 1-2
    adDiagnostics.sort((a, b) => DIAGNOSTIC_PRIORITIES[a.type] - DIAGNOSTIC_PRIORITIES[b.type]);
    diagnostics.push(...adDiagnostics.slice(0, 2));
  }

  return diagnostics;
}

export function calculateReleaseComboSuggestions(
  creativeMemory: CreativePerformanceMemory,
  copyMemory: CopyPerformanceMemory,
  reports: AdCreativeReportRecord[]
): NextTestSuggestion[] {
  const suggestions: NextTestSuggestion[] = [];

  const copyCoverage = copyMemory.coverage.linkedSpendPercentage;
  
  // Rule 5: Copy Linkage Guard
  if (copyCoverage < 70) {
    suggestions.push({
      type: "data-quality-warning",
      action: "Increase Copy Lab linkages to unlock next test suggestions.",
      reason: `Suggests that current copy coverage (${copyCoverage.toFixed(1)}%) is too low to extract reliable copy-based suggestions. Link more imported ad rows to Copy Lab entries (target: >= 70% of spend) to generate creative synergy suggestions.`,
      confidence: "Needs More Data",
      evidence: `Linked Spend: ${copyCoverage.toFixed(1)}% (Threshold: 70%)`
    });
    return suggestions;
  }

  // Map tested combinations
  const testedCombos = new Set<string>();
  const testedSongSectionCombos = new Set<string>(); // copyPairId|songSection
  for (const r of reports) {
    if (r.linked_copy?.id) {
      const parsed = parseAdName(r.ad_name);
      if (parsed.visual && parsed.visual !== "Unparsed") {
        testedCombos.add(`${r.linked_copy.id}|${parsed.visual}`);
      }
      if (parsed.songSection && parsed.songSection !== "Unparsed") {
        testedSongSectionCombos.add(`${r.linked_copy.id}|${formatSongSection(parsed.songSection)}`);
      }
    }
  }

  // Find overall best components
  // Visual
  const topVisualRow = [...creativeMemory.visuals]
    .filter((v) => v.totalSpend >= 10 && v.averageCpr !== null)
    .sort((a, b) => (a.averageCpr ?? Infinity) - (b.averageCpr ?? Infinity))[0];
  const bestVisual = topVisualRow?.value;

  // Copy Pair
  const topCopyRow = [...copyMemory.copyPairs]
    .filter((c) => c.spend >= 10 && c.cpr !== null)
    .sort((a, b) => (a.cpr ?? Infinity) - (b.cpr ?? Infinity))[0];
  const bestCopyPairId = topCopyRow?.copyEntryId;
  const bestCopyPairHook = topCopyRow?.hook;

  if (bestVisual && bestCopyPairId && bestCopyPairHook) {
    const comboKey = `${bestCopyPairId}|${bestVisual}`;
    if (!testedCombos.has(comboKey)) {
      suggestions.push({
        type: "combo-test",
        action: `Test winning visual format (${bestVisual}) with best Copy Pair.`,
        reason: `Suggests a high-probability test synergy. Testing your top-performing visual format "${bestVisual}" (CPR: $${topVisualRow.averageCpr?.toFixed(2)}) with your best Copy Pair "${bestCopyPairHook.slice(0, 30)}..." (CPR: $${topCopyRow.cpr?.toFixed(2)}). This combination is currently untested.`,
        confidence: "Moderate",
        evidence: `Untested Synergy Combination: ${bestCopyPairHook.slice(0, 20)}... + ${bestVisual}`
      });
    }
  }

  // Find best song section by efficiency (averageCpr)
  const topSongSection = [...creativeMemory.songSections]
    .filter((s) => s.totalSpend >= 10 && s.averageCpr !== null)
    .sort((a, b) => (a.averageCpr ?? Infinity) - (b.averageCpr ?? Infinity))[0];

  if (bestCopyPairId && bestCopyPairHook && topSongSection) {
    const formattedSectionName = formatSongSection(topSongSection.value);
    const songComboKey = `${bestCopyPairId}|${formattedSectionName}`;
    if (!testedSongSectionCombos.has(songComboKey)) {
      suggestions.push({
        type: "combo-test",
        action: `Test winning Copy Pair with the strongest song section (${formattedSectionName}).`,
        reason: `Suggests optimizing audio alignment. Pair your top-performing copy hook "${bestCopyPairHook.slice(0, 30)}..." with the "${formattedSectionName}" section, which has demonstrated strong engagement in other visual edits. This audio-copy combination is untested.`,
        confidence: "Moderate",
        evidence: `Untested Combo: ${bestCopyPairHook.slice(0, 20)}... + ${formattedSectionName}`
      });
    }
  }

  // Add contender retest recommendations
  const lowDataContenders = [...copyMemory.copyPairs]
    .filter((c) => c.spend > 0 && c.spend < 10.0 && c.linkClicks >= 5 && (c.cpr !== null && c.cpr < (topCopyRow?.cpr ?? 5.0)))
    .slice(0, 1);

  for (const c of lowDataContenders) {
    suggestions.push({
      type: "combo-test",
      action: `Retest promising Copy Pair contender: "${c.hook?.slice(0, 40)}..."`,
      reason: "Suggests early efficiency that has been starved of delivery. CTR and click parameters are strong, but spend is too low. Retest in a new isolated test batch.",
      confidence: "Directional",
      evidence: `Spend: $${c.spend.toFixed(2)} · Clicks: ${c.linkClicks} · Early CPR: ${c.cpr ? `$${c.cpr.toFixed(2)}` : "N/A"}`
    });
  }

  return suggestions.slice(0, 2); // Show top 1-2 suggestions
}
