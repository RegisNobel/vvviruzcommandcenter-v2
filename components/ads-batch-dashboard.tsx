"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, Edit, ExternalLink, Lock, Save, X} from "lucide-react";

import {AdsDeleteBatchButton} from "@/components/ads-delete-batch-button";
import {defaultAdAttributionSetting} from "@/lib/ads/batch-metadata";
import {parseAdName} from "@/lib/ads/naming-parser";
import {calculateConfidenceSignal} from "@/lib/ads/stats";
import {
  formatContentType,
  formatHookType,
  formatSongSection,
  hookTypeOptions,
  contentTypeOptions,
  songSectionOptions
} from "@/lib/copy";
import type {
  AdCampaignDecision,
  AdCreativeReportRecord,
  AdImportBatchDetail,
  AdStrategyBreakdownRow,
  CopyContentType,
  CopySongSection,
  HookType,
  CreativeDiagnostic
} from "@/lib/types";

type SortKey =
  | "spend"
  | "results"
  | "cost_per_result"
  | "link_clicks"
  | "landing_page_views"
  | "cost_per_landing_page_view"
  | "cpc"
  | "ctr"
  | "frequency"
  | "cpm"
  | "thru_plays"
  | "video_100"
  | "post_saves"
  | "post_shares"
  | "instagram_follows";

type FilterValue = "all" | "linked" | "unlinked" | string;

const sortOptions: Array<{value: SortKey; label: string}> = [
  {value: "spend", label: "Spend"},
  {value: "results", label: "Results"},
  {value: "cost_per_result", label: "Cost / Result"},
  {value: "link_clicks", label: "Link Clicks"},
  {value: "landing_page_views", label: "Landing Views"},
  {value: "cost_per_landing_page_view", label: "Cost / LPV"},
  {value: "cpc", label: "CPC"},
  {value: "ctr", label: "CTR"},
  {value: "frequency", label: "Frequency"},
  {value: "cpm", label: "CPM"},
  {value: "thru_plays", label: "ThruPlays"},
  {value: "video_100", label: "100% Plays"},
  {value: "post_saves", label: "Saves"},
  {value: "post_shares", label: "Shares"},
  {value: "instagram_follows", label: "IG Follows"}
];

const decisionOptions: Array<{value: AdCampaignDecision; label: string}> = [
  {value: "scale", label: "Scale"},
  {value: "iterate", label: "Iterate"},
  {value: "pause", label: "Pause"},
  {value: "retire", label: "Retire"},
  {value: "retest-hook", label: "Retest Hook"},
  {value: "retest-visual", label: "Retest Visual"},
  {value: "retest-audience", label: "Retest Audience"},
  {value: "needs-more-data", label: "Needs More Data"}
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${Math.round(value * 100) / 100}%`;
}

function calculateRatio(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!denominator || denominator <= 0) {
    return null;
  }

  return Math.round(((numerator ?? 0) / denominator) * 10000) / 100;
}

function calculateCost(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!denominator || denominator <= 0) {
    return null;
  }

  return Math.round(((numerator ?? 0) / denominator) * 100) / 100;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatStrategyValue(value: string, kind: "hook" | "content" | "section") {
  if (value === "Unlinked") {
    return value;
  }

  if (kind === "hook") {
    return formatHookType(value as HookType);
  }

  if (kind === "content") {
    return `${formatContentType(value as CopyContentType)} (Legacy)`;
  }

  return `${formatSongSection(value as CopySongSection)} (Legacy)`;
}

function getResultTypeSummary(value: string) {
  const rawValue = value.trim();

  if (!rawValue) {
    return {
      code: "N/A",
      detail: "Meta did not report a result type for this row.",
      label: "Not reported"
    };
  }

  const normalizedValue = rawValue.toLowerCase();

  if (
    normalizedValue.includes("streamingoutboundclick") ||
    normalizedValue.includes("streaming_outbound_click")
  ) {
    return {
      code: "SOC",
      detail: rawValue,
      label: "Streaming click"
    };
  }

  if (
    normalizedValue.includes("landing_page_view") ||
    normalizedValue.includes("landing page view")
  ) {
    return {
      code: "LPV",
      detail: rawValue,
      label: "Landing view"
    };
  }

  if (normalizedValue.includes("link_click") || normalizedValue.includes("link click")) {
    return {
      code: "LINK",
      detail: rawValue,
      label: "Link click"
    };
  }

  if (normalizedValue.includes("lead")) {
    return {
      code: "LEAD",
      detail: rawValue,
      label: "Lead"
    };
  }

  if (normalizedValue.includes("viewcontent") || normalizedValue.includes("view_content")) {
    return {
      code: "VIEW",
      detail: rawValue,
      label: "View content"
    };
  }

  if (normalizedValue.includes("conversion")) {
    return {
      code: "CONV",
      detail: rawValue,
      label: "Conversion"
    };
  }

  return {
    code: "RESULT",
    detail: rawValue,
    label: rawValue.length > 26 ? `${rawValue.slice(0, 23)}...` : rawValue
  };
}

function getSortValue(report: AdCreativeReportRecord, sortKey: SortKey) {
  if (sortKey === "cost_per_landing_page_view") {
    return report.cost_per_landing_page_view ?? calculateCost(report.spend, report.landing_page_views) ?? -1;
  }

  if (sortKey === "frequency") {
    return report.frequency ?? (report.reach ? (report.impressions ?? 0) / report.reach : -1);
  }

  if (sortKey === "cpm") {
    return report.cpm ?? (report.impressions ? ((report.spend ?? 0) / report.impressions) * 1000 : -1);
  }

  return report[sortKey] ?? -1;
}

function MetricCard({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#30343b] bg-[#121418] px-4 py-4">
      <p className="field-label">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function StrategyTable({
  rows,
  title
}: {
  rows: AdStrategyBreakdownRow[];
  title: string;
}) {
  return (
    <section className="rounded-[26px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#171a1f] text-[#b8bec6]">
            <tr>
              <th className="px-3 py-3 font-semibold">Segment</th>
              <th className="px-3 py-3 font-semibold">Spend</th>
              <th className="px-3 py-3 font-semibold">Results</th>
              <th className="px-3 py-3 font-semibold">Clicks</th>
              <th className="px-3 py-3 font-semibold">Landing Views</th>
              <th className="px-3 py-3 font-semibold">Click to LPV</th>
              <th className="px-3 py-3 font-semibold">Cost / LPV</th>
              <th className="px-3 py-3 font-semibold">CTR</th>
              <th className="px-3 py-3 font-semibold">Rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#252a31]">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr className="text-[#d9dee5]" key={row.label}>
                  <td className="px-3 py-3 font-semibold">{row.label}</td>
                  <td className="px-3 py-3">{formatMoney(row.spend)}</td>
                  <td className="px-3 py-3">{formatNumber(row.results)}</td>
                  <td className="px-3 py-3">{formatNumber(row.link_clicks)}</td>
                  <td className="px-3 py-3">{formatNumber(row.landing_page_views)}</td>
                  <td className="px-3 py-3">{formatPercent(row.click_to_landing_rate)}</td>
                  <td className="px-3 py-3">{formatMoney(row.cost_per_landing_page_view)}</td>
                  <td className="px-3 py-3">{formatPercent(row.ctr)}</td>
                  <td className="px-3 py-3">{formatNumber(row.report_count)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-5 text-center text-muted" colSpan={9}>
                  No strategy data yet. Link ad rows to Copy Lab entries to populate this.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ReadoutQuality = {
  detail: string;
  label: string;
  tone: "good" | "ok" | "bad" | "neutral";
};

type ConfidenceReadout = {
  detail: string;
  level: "High confidence" | "Medium confidence" | "Low confidence";
  reasons: string[];
  warnings: string[];
};

type CampaignReadout = {
  attributionConfidence: ConfidenceReadout;
  bestContentType: string;
  bestHook: string;
  campaign: string;
  dateRange: string;
  decision: string;
  landingPageViewQuality: ReadoutQuality;
  mainLesson: string;
  nextTest: string;
  release: string;
  spend: string;
  streamingOutboundClickQuality: ReadoutQuality;
  topCreative: string;
  worstCreative: string;
  worstHook: string;
};

function getMostCommonValue(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      continue;
    }

    counts.set(normalizedValue, (counts.get(normalizedValue) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function getFollowThroughMap(detail: AdImportBatchDetail) {
  return new Map(detail.link_follow_through.map((row) => [row.ad_report_id, row]));
}

function getOutboundClickTotal(detail: AdImportBatchDetail) {
  return detail.link_follow_through.reduce(
    (total, row) => total + row.outbound_streaming_clicks,
    0
  );
}

function getCreativeScore(
  report: AdCreativeReportRecord,
  followThroughByReportId: Map<string, AdImportBatchDetail["link_follow_through"][number]>
) {
  const followThrough = followThroughByReportId.get(report.id);

  return (
    (report.results ?? 0) * 20 +
    (followThrough?.outbound_streaming_clicks ?? 0) * 14 +
    (report.landing_page_views ?? 0) * 5 +
    (report.link_clicks ?? 0) * 2 +
    (report.post_saves ?? 0) * 3 +
    (report.post_shares ?? 0) * 2 +
    (report.instagram_follows ?? 0) * 3 +
    (report.video_100 ?? 0) * 0.1 -
    (report.spend ?? 0) * 0.25
  );
}

function getTopCreative(
  reports: AdCreativeReportRecord[],
  followThroughByReportId: Map<string, AdImportBatchDetail["link_follow_through"][number]>
) {
  return [...reports].sort(
    (left, right) =>
      getCreativeScore(right, followThroughByReportId) -
      getCreativeScore(left, followThroughByReportId)
  )[0] ?? null;
}

function getWorstCreative(
  detail: AdImportBatchDetail,
  followThroughByReportId: Map<string, AdImportBatchDetail["link_follow_through"][number]>
) {
  const averageSpend = detail.report_count > 0 ? detail.spend / detail.report_count : 0;
  const minimumSpend = Math.max(1, averageSpend * 0.4);
  const eligibleReports = detail.reports.filter((report) => (report.spend ?? 0) >= minimumSpend);
  const reports = eligibleReports.length > 0 ? eligibleReports : detail.reports;

  return [...reports].sort(
    (left, right) =>
      getCreativeScore(left, followThroughByReportId) -
      getCreativeScore(right, followThroughByReportId)
  )[0] ?? null;
}

function getStrategyScore(row: AdStrategyBreakdownRow) {
  return (
    row.results * 20 +
    row.landing_page_views * 5 +
    row.link_clicks * 2 +
    row.thru_plays * 0.5 +
    row.video_100 * 0.25 -
    (row.cost_per_landing_page_view ?? 0)
  );
}

function getBestStrategy(rows: AdStrategyBreakdownRow[]) {
  return rows
    .filter((row) => row.label !== "Unlinked")
    .sort((left, right) => getStrategyScore(right) - getStrategyScore(left))[0] ?? null;
}

function getWorstStrategy(rows: AdStrategyBreakdownRow[]) {
  return rows
    .filter((row) => row.label !== "Unlinked" && row.spend >= 1)
    .sort((left, right) => getStrategyScore(left) - getStrategyScore(right))[0] ?? null;
}

function getLandingPageViewQuality(detail: AdImportBatchDetail): ReadoutQuality {
  if (detail.link_clicks <= 0) {
    return {
      detail: "No Meta link clicks are present, so landing-page handoff cannot be judged yet.",
      label: "No signal",
      tone: "neutral"
    };
  }

  if (detail.landing_page_views <= 0) {
    return {
      detail: "Link clicks are present, but landing-page views are missing. Import the Performance and Clicks export or audit landing-page load quality.",
      label: "Weak",
      tone: "bad"
    };
  }

  const rate = detail.click_to_landing_rate ?? calculateRatio(detail.landing_page_views, detail.link_clicks);

  if ((rate ?? 0) >= 60) {
    return {
      detail: `${formatPercent(rate)} of link clicks became landing-page views. The click-to-page handoff looks strong.`,
      label: "Strong",
      tone: "good"
    };
  }

  if ((rate ?? 0) >= 35) {
    return {
      detail: `${formatPercent(rate)} of link clicks became landing-page views. The handoff is usable, but worth watching.`,
      label: "Usable",
      tone: "ok"
    };
  }

  return {
    detail: `${formatPercent(rate)} of link clicks became landing-page views. This points to traffic quality, page-load, or message-match friction.`,
    label: "Weak",
    tone: "bad"
  };
}

function getStreamingOutboundClickQuality(detail: AdImportBatchDetail): ReadoutQuality {
  const outboundClicks = getOutboundClickTotal(detail);
  const activeAdCount = detail.reports.filter(r => (r.spend ?? 0) >= 1.0).length || 1;
  const firstPartyViews = detail.link_follow_through.reduce((total, row) => total + row.links_page_views, 0);

  if (firstPartyViews <= 0) {
    return {
      detail: "No matching first-party /links views are available for this batch yet.",
      label: "No signal",
      tone: "neutral"
    };
  }

  const rate = calculateRatio(outboundClicks, firstPartyViews);

  if (outboundClicks <= 0) {
    return {
      detail: "Matched /links views exist, but no streaming outbound clicks are tied to those UTMs yet.",
      label: "Weak",
      tone: "bad"
    };
  }

  if ((rate ?? 0) >= 30) {
    return {
      detail: `${formatPercent(rate)} of matched /links views clicked out to a streaming platform. Intent quality is strong.`,
      label: "Strong",
      tone: "good"
    };
  }

  if ((rate ?? 0) >= 12) {
    return {
      detail: `${formatPercent(rate)} of matched /links views clicked out to streaming. Intent quality is usable.`,
      label: "Usable",
      tone: "ok"
    };
  }

  return {
    detail: `${formatPercent(rate)} of matched /links views clicked out to streaming. The page or offer may need a stronger push.`,
    label: "Weak",
    tone: "bad"
  };
}

function getAttributionConfidence(detail: AdImportBatchDetail): ConfidenceReadout {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const outboundClicks = getOutboundClickTotal(detail);
  const activeAdCount = detail.reports.filter(r => (r.spend ?? 0) >= 1.0).length || 1;
  const reportsWithFirstPartyMatches = new Set(
    detail.link_follow_through
      .filter((row) => row.links_page_views > 0 || row.outbound_streaming_clicks > 0)
      .map((row) => row.ad_report_id)
  );
  const reportsWithAttributionSignal = detail.reports.filter(
    (report) =>
      (report.utm_campaign && report.utm_content) || reportsWithFirstPartyMatches.has(report.id)
  ).length;
  const attributionCoverage = calculateRatio(reportsWithAttributionSignal, detail.reports.length);
  let score = 0;

  // V1.2 confidence thresholds — tuned conservatively to prevent overreaction.
  // Spend threshold raised to $50 for High confidence. Meta will happily
  // let you make a life decision off 3 clicks and a dream. This should not.
  if (detail.spend / activeAdCount >= 5) {
    score += 1;
    reasons.push("Average spend per ad is high enough ($5+) to see early Pull.");
  } else if (detail.spend / activeAdCount >= 2) {
    warnings.push("Spend per ad is thin; directional signal only.");
  } else {
    warnings.push("Micro-spend per ad; signal is likely noise.");
  }

  if (detail.link_clicks / activeAdCount >= 15) {
    score += 1;
    reasons.push("Link-click volume per ad is meaningful (15+ avg).");
  } else {
    warnings.push("Link-click volume per ad is low.");
  }

  if (detail.landing_page_views >= 50) {
    score += 1;
    reasons.push("Landing-page view volume is usable.");
  } else {
    warnings.push("Landing-page view volume is low.");
  }

  if (outboundClicks / activeAdCount >= 3) {
    score += 1;
    reasons.push("Outbound intent per ad is usable (3+ avg).");
  } else {
    warnings.push("Streaming outbound intent is low per ad.");
  }

  if ((attributionCoverage ?? 0) >= 85) {
    score += 1;
    reasons.push("Most imported ads have explicit UTMs or matched first-party content values.");
  } else if ((attributionCoverage ?? 0) >= 50) {
    warnings.push(
      "Some Meta rows lack exported URL parameters. Ad-level attribution is partial."
    );
  } else {
    warnings.push(
      "Most Meta rows lack UTMs and do not match first-party data. Ad-level attribution is unreliable."
    );
  }

  if (detail.batch_type === "Release-to-Date" || detail.batch_type === "Full Campaign" || detail.batch_type === "Fixed Period") {
    score += 1;
    reasons.push(`${detail.batch_type} exports are cleaner for campaign decisions than overlapping snapshots.`);
  } else {
    warnings.push("Rolling snapshots can overlap; treat comparisons as directional, not final.");
  }

  if (score >= 5) {
    return {
      detail: "Meaningful spend for a 3-day optimization window. Reliable for directional budget moves.",
      level: "High confidence",
      reasons,
      warnings
    };
  }

  if (score >= 3) {
    return {
      detail: "Useful directional signal, but keep the next test conservative. Do not scale from Medium confidence alone.",
      level: "Medium confidence",
      reasons,
      warnings
    };
  }

  return {
    detail: "Weak signal. Use this readout to choose what to test next, not to declare a winner or make a budget decision.",
    level: "Low confidence",
    reasons,
    warnings
  };
}

/**
 * V1.2 computed decision.
 * Returns exactly one label from the controlled decision set.
 * Low confidence always returns "Needs More Data" to prevent premature budget moves.
 */
function getComputedDecision({
  confidence,
  detail,
  landingQuality,
  streamingQuality,
  topCreative
}: {
  confidence: ConfidenceReadout;
  detail: AdImportBatchDetail;
  landingQuality: ReadoutQuality;
  streamingQuality: ReadoutQuality;
  topCreative: AdCreativeReportRecord | null;
}) {
  const outboundClicks = getOutboundClickTotal(detail);

  const activeAdCount = detail.reports.filter(r => (r.spend ?? 0) >= 1.0).length || 1;

  // V1.2: Low confidence must force "Needs More Data" — never let the user
  // act on data the system itself does not trust.
  if (confidence.level === "Low confidence") {
    return "Needs More Data";
  }

  // High spend with near-zero engagement = dead creative
  if (detail.spend / activeAdCount >= 5 && detail.link_clicks / activeAdCount <= 1 && outboundClicks / activeAdCount < 0.5) {
    return "Retire";
  }

  // Clicks exist but drop off at the landing page = hook/message mismatch
  if (landingQuality.tone === "bad" && detail.link_clicks >= 50) {
    return "Retest Hook";
  }

  // Landing works but streaming intent is missing = visual/CTA problem
  if (streamingQuality.tone === "bad" && detail.landing_page_views >= 25) {
    return "Retest Visual";
  }

  // Strong top creative with good funnel = scale candidate
  if (
    topCreative &&
    (topCreative.results ?? 0) > 0 &&
    landingQuality.tone === "good" &&
    streamingQuality.tone !== "bad"
  ) {
    return "Scale";
  }

  // Meaningful spend but no outbound intent = stop bleeding
  if (detail.spend / activeAdCount >= 6 && outboundClicks / activeAdCount < 0.5) {
    return "Pause";
  }

  return "Iterate";
}

/**
 * V1.2 next-test recommendation generator.
 * Each decision label produces a specific, actionable recommendation.
 * The recommendation should tell the user exactly what to change and what to keep.
 */
function getNextTestRecommendation(decision: string, topCreativeName: string, bestHookLabel: string) {
  switch (decision) {
    case "Scale":
      return `Increase budget carefully around ${topCreativeName}. Keep the same UTM discipline and monitor frequency.`;
    case "Iterate":
      return "Run the next test with one controlled change (hook, visual, or audience) and wait for stronger confidence before scaling.";
    case "Pause":
      return "Stop spending on this batch. Review whether the audience, offer, or creative concept needs to change before restarting.";
    case "Retire":
      return "Stop spending on this direction entirely. Rebuild the creative from a different angle, hook, or content type.";
    case "Retest Hook":
      return `Keep the strongest visual direction, but test a sharper hook and clearer promise. ${bestHookLabel !== "No linked hook signal yet" ? `Current best hook angle: ${bestHookLabel}.` : ""}`;
    case "Retest Visual":
      return "Keep the strongest hook, but test a new visual direction or stronger first-frame pattern to improve streaming intent.";
    case "Retest Audience":
      return "Keep the current creative and hook, but test a different audience segment or interest targeting.";
    case "Needs More Data":
      return "The current data is too thin for a reliable recommendation. Keep running and wait for more spend, clicks, and outbound signal before deciding.";
    default:
      return "Run the next test with one controlled change and wait for stronger confidence before scaling.";
  }
}

function createCampaignReadout(detail: AdImportBatchDetail): CampaignReadout {
  const followThroughByReportId = getFollowThroughMap(detail);
  const topCreative = getTopCreative(detail.reports, followThroughByReportId);
  const worstCreative = getWorstCreative(detail, followThroughByReportId);
  const bestHook = getBestStrategy(detail.strategy_breakdowns.hook_type);
  const worstHook = getWorstStrategy(detail.strategy_breakdowns.hook_type);
  const bestContentType = getBestStrategy(detail.strategy_breakdowns.content_type);
  const landingPageViewQuality = getLandingPageViewQuality(detail);
  const streamingOutboundClickQuality = getStreamingOutboundClickQuality(detail);
  const attributionConfidence = getAttributionConfidence(detail);
  const campaign =
    detail.name ||
    getMostCommonValue(detail.reports.map((report) => report.campaign_name)) ||
    "Imported Meta campaign";
  const decision = getComputedDecision({
    confidence: attributionConfidence,
    detail,
    landingQuality: landingPageViewQuality,
    streamingQuality: streamingOutboundClickQuality,
    topCreative
  });
  const topCreativeName = topCreative?.ad_name || "No creative signal yet";
  const bestHookLabel = bestHook ? formatStrategyValue(bestHook.label, "hook") : "No linked hook signal yet";

  return {
    attributionConfidence,
    bestContentType: bestContentType
      ? formatStrategyValue(bestContentType.label, "content")
      : "No linked content signal yet",
    bestHook: bestHookLabel,
    campaign,
    dateRange: `${formatDate(detail.reporting_start)} to ${formatDate(detail.reporting_end)}`,
    decision,
    landingPageViewQuality,
    mainLesson:
      topCreative && bestHook
        ? `${topCreativeName} is leading the current read. ${bestHookLabel} is the strongest linked hook angle so far.`
        : "The campaign needs more linked Copy Lab and/or Meta signal before a durable lesson is available.",
    nextTest: getNextTestRecommendation(decision, topCreativeName, bestHookLabel),
    release: detail.release_title || "Standalone / no release linked",
    spend: formatMoney(detail.spend),
    streamingOutboundClickQuality,
    topCreative: topCreativeName,
    worstCreative: worstCreative?.ad_name || "No weak creative isolated yet",
    worstHook: worstHook ? formatStrategyValue(worstHook.label, "hook") : "No weak hook isolated yet"
  };
}

function getQualityClass(tone: ReadoutQuality["tone"]) {
  if (tone === "good") {
    return "border-emerald-800/50 bg-emerald-950/30 text-emerald-200";
  }

  if (tone === "ok") {
    return "border-amber-800/50 bg-amber-950/30 text-amber-200";
  }

  if (tone === "bad") {
    return "border-red-800/50 bg-red-950/30 text-red-200";
  }

  return "border-[#30343b] bg-[#121418] text-muted";
}

function getConfidenceClass(level: ConfidenceReadout["level"]) {
  if (level === "High confidence") {
    return "border-emerald-800/50 bg-emerald-950/30 text-emerald-200";
  }

  if (level === "Medium confidence") {
    return "border-amber-800/50 bg-amber-950/30 text-amber-200";
  }

  return "border-red-800/50 bg-red-950/30 text-red-200";
}

function ReadoutItem({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-[18px] border border-[#252a31] bg-[#171a1f] px-4 py-3">
      <p className="field-label">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

export function AdsBatchDashboard({detail}: {detail: AdImportBatchDetail}) {
  const router = useRouter();
  const [hookFilter, setHookFilter] = useState<FilterValue>("all");
  const [contentFilter, setContentFilter] = useState<FilterValue>("all");
  const [sectionFilter, setSectionFilter] = useState<FilterValue>("all");
  const [linkFilter, setLinkFilter] = useState<FilterValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [learning, setLearning] = useState({
    summary: detail.learning?.summary ?? "",
    what_worked: detail.learning?.what_worked ?? "",
    what_failed: detail.learning?.what_failed ?? "",
    next_test: detail.learning?.next_test ?? "",
    decision: detail.learning?.decision ?? "iterate"
  });
  const [isSavingLearning, setIsSavingLearning] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveForm, setArchiveForm] = useState({
    final_decision: "",
    human_override_notes: ""
  });
  const [isArchiving, setIsArchiving] = useState(false);
  const isArchived = Boolean(detail.learning?.reviewed_at);

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(detail.name || "");
  const [isRenaming, setIsRenaming] = useState(false);

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRenaming(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({name: newName})
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Batch renaming failed.");
      }

      setMessage(payload?.message ?? "Batch renamed successfully.");
      setShowRenameDialog(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch renaming failed.");
    } finally {
      setIsRenaming(false);
    }
  }

  const filteredReports = useMemo(() => {
    return detail.reports
      .filter((report) => {
        if (linkFilter === "linked" && !report.linked_copy) {
          return false;
        }

        if (linkFilter === "unlinked" && report.linked_copy) {
          return false;
        }

        if (hookFilter !== "all" && report.linked_copy?.hook_type !== hookFilter) {
          return false;
        }

        if (contentFilter !== "all" && report.linked_copy?.content_type !== contentFilter) {
          return false;
        }

        if (sectionFilter !== "all" && report.linked_copy?.song_section !== sectionFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => getSortValue(right, sortKey) - getSortValue(left, sortKey));
  }, [contentFilter, detail.reports, hookFilter, linkFilter, sectionFilter, sortKey]);
  const totalThreeSecondPlays = detail.reports.reduce(
    (total, report) => total + (report.three_second_plays ?? 0),
    0
  );
  const totalThruPlays = detail.reports.reduce(
    (total, report) => total + (report.thru_plays ?? 0),
    0
  );
  const totalVideo100 = detail.reports.reduce(
    (total, report) => total + (report.video_100 ?? 0),
    0
  );
  const effectiveFrequency = detail.reach > 0
    ? Math.round((detail.impressions / detail.reach) * 100) / 100
    : null;
  const effectiveCpm = calculateCost(detail.spend * 1000, detail.impressions);
  const videoHoldRate = calculateRatio(totalVideo100, totalThreeSecondPlays);
  const campaignReadout = useMemo(() => createCampaignReadout(detail), [detail]);

  // Batch-level totals used by the confidence signal calculator.
  const batchTotalResults = detail.results;
  const batchTotalImpressions = detail.impressions;
  const batchTotalLinkClicks = detail.link_clicks;

  async function handleCopyLink(reportId: string, copyEntryId: string | null) {
    setPendingReportId(reportId);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/reports/${reportId}/copy-link`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({copy_entry_id: copyEntryId})
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Copy link update failed.");
      }

      setMessage("Copy link updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy link update failed.");
    } finally {
      setPendingReportId(null);
    }
  }

  async function handleLearningSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingLearning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${detail.id}/learnings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...learning,
          release_id: detail.release_id
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Learning save failed.");
      }

      setMessage("Campaign learning saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning save failed.");
    } finally {
      setIsSavingLearning(false);
    }
  }

  async function handleArchive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsArchiving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${detail.id}/learnings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          archive: true,
          final_decision: archiveForm.final_decision,
          human_override_notes: archiveForm.human_override_notes
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Archive failed.");
      }

      setMessage("Test cycle archived.");
      setShowArchiveDialog(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archive failed.");
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Ad Lab</div>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  {detail.name || "Imported Meta Report"}
                </h1>
                <button
                  className="rounded-lg p-1.5 text-muted hover:bg-[#1a1d24] hover:text-ink transition-colors"
                  onClick={() => {
                    setNewName(detail.name || "");
                    setShowRenameDialog(true);
                  }}
                  title="Rename Batch"
                  type="button"
                >
                  <Edit size={18} />
                </button>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                {detail.release_title ? `${detail.release_title} / ` : ""}
                {formatDate(detail.reporting_start)} to {formatDate(detail.reporting_end)}
              </p>
              <p className="mt-2 max-w-3xl text-xs uppercase tracking-[0.14em] text-muted">
                Files: {detail.file_names.length > 0 ? detail.file_names.join(", ") : "No file names recorded"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="action-button-secondary" href="/admin/ad-lab">
                <ArrowLeft size={16} />
                Ad Lab Home
              </Link>
              <button
                className="action-button-secondary"
                onClick={() => {
                  setNewName(detail.name || "");
                  setShowRenameDialog(true);
                }}
                type="button"
              >
                Rename Batch
              </button>
              <Link className="action-button-primary" href="/admin/ad-lab/import">
                Import CSV
              </Link>
              <AdsDeleteBatchButton
                batchId={detail.id}
                batchName={detail.name || "Imported Meta Report"}
              />
            </div>
          </div>
        </section>

        {/* V1.2 Locked Archive Banner */}
        {isArchived && detail.learning ? (
          <div className="rounded-[22px] border border-emerald-800/50 bg-emerald-950/20 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Lock className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Archived Test Cycle</p>
                  <p className="mt-0.5 text-xs text-emerald-500">
                    Locked {formatDateTime(detail.learning.reviewed_at)} by {detail.learning.reviewed_by || "admin"}
                  </p>
                </div>
              </div>
              {detail.learning.final_decision ? (
                <span className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  Final: {detail.learning.final_decision}
                </span>
              ) : null}
            </div>
            {detail.learning.human_override_notes ? (
              <p className="mt-3 text-sm leading-6 text-emerald-200/80">
                {detail.learning.human_override_notes}
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="panel px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="field-label">Reporting Start</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDate(detail.reporting_start)}
              </p>
            </div>
            <div>
              <p className="field-label">Reporting End</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDate(detail.reporting_end)}
              </p>
            </div>
            <div>
              <p className="field-label">Exported At</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDateTime(detail.exported_at)}
              </p>
            </div>
            <div>
              <p className="field-label">Attribution Setting</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {detail.attribution_setting || defaultAdAttributionSetting}
              </p>
            </div>
            <div>
              <p className="field-label">Batch Type</p>
              <p className="mt-2 text-sm font-semibold text-ink">{detail.batch_type}</p>
            </div>
          </div>

          {detail.batch_type === "Rolling Snapshot" ? (
            <div className="mt-5 rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm leading-6 text-[#d7b45e]">
              This is an overlapping Meta snapshot. Do not sum it with other overlapping batches.
            </div>
          ) : null}
        </section>

        {detail.linked_copy_count > 0 ? (
          <div className="rounded-[22px] border border-[#30343b] bg-[#121418] px-4 py-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">{formatNumber(detail.linked_copy_count)}</span>{" "}
            Copy Lab link{detail.linked_copy_count === 1 ? "" : "s"} are active in this batch.
            New imports for the same release auto-carry links forward when normalized ad names match.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[30px] border border-[#5b4920] bg-[linear-gradient(135deg,rgba(215,180,94,0.16),rgba(18,20,24,0.96)_38%,rgba(12,14,18,0.98))] px-4 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label text-[#d7b45e]">Decision Summary</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
                {campaignReadout.decision}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7c0ae]">
                This is the operator readout before the raw table: what looks strongest,
                how much to trust it, and what the next creative test should be.
              </p>
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${getConfidenceClass(
                campaignReadout.attributionConfidence.level
              )}`}
            >
              {campaignReadout.attributionConfidence.level}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadoutItem label="Top Creative" value={campaignReadout.topCreative} />
            <ReadoutItem label="Best Copy Angle" value={campaignReadout.bestHook} />
            <ReadoutItem label="Best Content Type" value={campaignReadout.bestContentType} />
            <ReadoutItem label="Spend" value={campaignReadout.spend} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-[#5b4920]/60 bg-[#12100a]/70 px-4 py-4">
              <p className="field-label text-[#d7b45e]">Main Lesson</p>
              <p className="mt-2 text-sm leading-6 text-[#f1eadc]">{campaignReadout.mainLesson}</p>
            </div>
            <div className="rounded-[22px] border border-[#5b4920]/60 bg-[#12100a]/70 px-4 py-4">
              <p className="field-label text-[#d7b45e]">Next Test</p>
              <p className="mt-2 text-sm leading-6 text-[#f1eadc]">{campaignReadout.nextTest}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Spend" note="Total imported Meta spend." value={formatMoney(detail.spend)} />
          <MetricCard label="Impressions" note="Imported ad impressions." value={formatNumber(detail.impressions)} />
          <MetricCard label="Reach" note="Imported Meta reach." value={formatNumber(detail.reach)} />
          <MetricCard label="Frequency" note="Impressions divided by reach." value={formatNumber(effectiveFrequency)} />
          <MetricCard label="CPM" note="Spend per 1,000 impressions." value={formatMoney(effectiveCpm)} />
          <MetricCard label="Results" note="Meta results from CSV." value={formatNumber(detail.results)} />
          <MetricCard label="Cost / Result" note="Spend divided by results." value={formatMoney(detail.results > 0 ? detail.spend / detail.results : null)} />
          <MetricCard label="Link Clicks" note="Meta link click count." value={formatNumber(detail.link_clicks)} />
          <MetricCard label="Landing Views" note="Landing page views from Meta." value={formatNumber(detail.landing_page_views)} />
          <MetricCard label="Click to LPV" note="Landing views divided by link clicks." value={formatPercent(detail.click_to_landing_rate)} />
          <MetricCard label="Cost / LPV" note="Spend divided by landing views." value={formatMoney(detail.cost_per_landing_page_view)} />
          <MetricCard label="CPC" note="Spend divided by link clicks." value={formatMoney(detail.link_clicks > 0 ? detail.spend / detail.link_clicks : null)} />
          <MetricCard label="CTR" note="Clicks divided by impressions." value={formatPercent(detail.ctr)} />
          <MetricCard label="ThruPlays" note="Completed video attention signal." value={formatNumber(totalThruPlays)} />
          <MetricCard label="100% Plays" note="Full video play count." value={formatNumber(totalVideo100)} />
          <MetricCard label="100% Hold" note="100% plays divided by 3-second plays." value={formatPercent(videoHoldRate)} />
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Detailed Campaign Readout</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Decision: {campaignReadout.decision}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Auto-generated from Meta CSV metrics, Copy Lab links, and first-party
                `/links` follow-through. Manual notes are optional context only.
              </p>
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${getConfidenceClass(
                campaignReadout.attributionConfidence.level
              )}`}
            >
              {campaignReadout.attributionConfidence.level}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadoutItem label="Release" value={campaignReadout.release} />
            <ReadoutItem label="Campaign" value={campaignReadout.campaign} />
            <ReadoutItem label="Date Range" value={campaignReadout.dateRange} />
            <ReadoutItem label="Spend" value={campaignReadout.spend} />
            <ReadoutItem label="Top Creative" value={campaignReadout.topCreative} />
            <ReadoutItem label="Worst Creative" value={campaignReadout.worstCreative} />
            <ReadoutItem label="Best Copy Angle" value={campaignReadout.bestHook} />
            <ReadoutItem label="Worst Copy Angle" value={campaignReadout.worstHook} />
            <ReadoutItem label="Best Content Type" value={campaignReadout.bestContentType} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div
              className={`rounded-[22px] border px-4 py-4 ${getQualityClass(
                campaignReadout.landingPageViewQuality.tone
              )}`}
            >
              <p className="field-label">Landing Page View Quality</p>
              <p className="mt-2 text-xl font-semibold">{campaignReadout.landingPageViewQuality.label}</p>
              <p className="mt-2 text-sm leading-6">{campaignReadout.landingPageViewQuality.detail}</p>
            </div>

            <div
              className={`rounded-[22px] border px-4 py-4 ${getQualityClass(
                campaignReadout.streamingOutboundClickQuality.tone
              )}`}
            >
              <p className="field-label">Streaming Outbound Click Quality</p>
              <p className="mt-2 text-xl font-semibold">
                {campaignReadout.streamingOutboundClickQuality.label}
              </p>
              <p className="mt-2 text-sm leading-6">
                {campaignReadout.streamingOutboundClickQuality.detail}
              </p>
            </div>

            <div
              className={`rounded-[22px] border px-4 py-4 ${getConfidenceClass(
                campaignReadout.attributionConfidence.level
              )}`}
            >
              <p className="field-label">Attribution Confidence</p>
              <p className="mt-2 text-xl font-semibold">
                {campaignReadout.attributionConfidence.level}
              </p>
              <p className="mt-2 text-sm leading-6">
                {campaignReadout.attributionConfidence.detail}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-[#252a31] bg-[#171a1f] px-4 py-4">
              <p className="field-label">Main Lesson</p>
              <p className="mt-2 text-sm leading-6 text-ink">{campaignReadout.mainLesson}</p>
            </div>
            <div className="rounded-[22px] border border-[#252a31] bg-[#171a1f] px-4 py-4">
              <p className="field-label">Next Test</p>
              <p className="mt-2 text-sm leading-6 text-ink">{campaignReadout.nextTest}</p>
            </div>
          </div>

          {campaignReadout.attributionConfidence.warnings.length > 0 ? (
            <div className="rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-4">
              <p className="field-label text-[#d7b45e]">Read Before Trusting This</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#d7b45e]">
                {campaignReadout.attributionConfidence.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {detail.creative_diagnostics && detail.creative_diagnostics.length > 0 ? (
          <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="field-label">Campaign Ad Insights</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Creative Diagnostics</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Deterministic, rule-based recommendations for immediate per-ad actions. Wording is correlation-based and suggests potential improvements.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {detail.creative_diagnostics.map((diag, index) => (
                <div
                  key={`${diag.adName}-${diag.type}-${index}`}
                  className={`rounded-[22px] border p-4 flex flex-col justify-between ${
                    diag.severity === "success"
                      ? "border-emerald-800/40 bg-emerald-950/10 text-[#d1f2e5]"
                      : diag.severity === "danger"
                      ? "border-red-800/40 bg-red-950/10 text-[#f2d1d1]"
                      : diag.severity === "warning"
                      ? "border-amber-800/40 bg-amber-950/10 text-[#f2e5d1]"
                      : "border-blue-800/40 bg-blue-950/10 text-[#d1e5f2]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 truncate max-w-[200px]" title={diag.adName}>
                        {diag.adName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          diag.confidence === "High"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : diag.confidence === "Moderate"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : diag.confidence === "Directional"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-[#252a31] text-muted border border-muted/20"
                        }`}
                      >
                        {diag.confidence}
                      </span>
                    </div>

                    <h4 className="mt-3 text-base font-semibold leading-5 text-ink">
                      {diag.action}
                    </h4>
                    <p className="mt-2 text-xs leading-5 text-muted opacity-85">
                      {diag.reason}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-muted/10 flex justify-between items-center text-[10px] opacity-75">
                    <span className="font-mono truncate max-w-[170px]" title={diag.evidence}>{diag.evidence}</span>
                    <span className="italic">Type: {diag.type.replace(/-/g, " ")}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[18px] border border-[#3a3324] bg-[#191713] p-4 text-xs text-[#d7b45e] leading-5">
              <strong>Causal Caveat:</strong> These recommendations are correlation-based. If multiple variables (visual, copy, song section, or budget) were changed at once, run the suggestion as a controlled test before making a final call.
            </div>
          </section>
        ) : null}

        {message ? (
          <div className="rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
            {message}
          </div>
        ) : null}

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="field-label">Creative Leaderboard</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Ad performance by creative</h2>
            </div>

            <div className="grid w-full gap-3 md:w-auto md:grid-cols-5">
              <select className="field-input" onChange={(event) => setHookFilter(event.target.value)} value={hookFilter}>
                <option value="all">All Copy Angles</option>
                {hookTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatHookType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setContentFilter(event.target.value)} value={contentFilter}>
                <option value="all">All Content Types (Legacy)</option>
                {contentTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatContentType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
                <option value="all">All Song Sections (Legacy)</option>
                {songSectionOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatSongSection(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setLinkFilter(event.target.value)} value={linkFilter}>
                <option value="all">Linked + Unlinked</option>
                <option value="linked">Linked Copy</option>
                <option value="unlinked">Unlinked Copy</option>
              </select>
              <select className="field-input" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    Sort: {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Ad Name</th>
                  <th className="px-3 py-3 font-semibold">Visual</th>
                  <th className="px-3 py-3 font-semibold">Song Section</th>
                  <th className="px-3 py-3 font-semibold">Revision</th>
                  <th className="px-3 py-3 font-semibold">Confidence Signal</th>
                  <th className="px-3 py-3 font-semibold">Linked Copy</th>
                  <th className="px-3 py-3 font-semibold">Delivery</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Results</th>
                  <th className="px-3 py-3 font-semibold">Cost / Result</th>
                  <th className="w-[120px] px-3 py-3 font-semibold">Result Type</th>
                  <th className="px-3 py-3 font-semibold">Link Clicks</th>
                  <th className="px-3 py-3 font-semibold">Landing Views</th>
                  <th className="px-3 py-3 font-semibold">Click to LPV</th>
                  <th className="px-3 py-3 font-semibold">Cost / LPV</th>
                  <th className="px-3 py-3 font-semibold">CPC</th>
                  <th className="px-3 py-3 font-semibold">CTR</th>
                  <th className="px-3 py-3 font-semibold">Freq</th>
                  <th className="px-3 py-3 font-semibold">CPM</th>
                  <th className="px-3 py-3 font-semibold">3s Plays</th>
                  <th className="px-3 py-3 font-semibold">ThruPlays</th>
                  <th className="px-3 py-3 font-semibold">100% Plays</th>
                  <th className="px-3 py-3 font-semibold">Hold</th>
                  <th className="px-3 py-3 font-semibold">Saves</th>
                  <th className="px-3 py-3 font-semibold">Shares</th>
                  <th className="px-3 py-3 font-semibold">IG Follows</th>
                  <th className="px-3 py-3 font-semibold">Performance Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {filteredReports.map((report) => {
                  const resultType = getResultTypeSummary(report.result_indicator);
                  const parsed = parseAdName(report.ad_name);
                  const confidence = calculateConfidenceSignal({
                    spend: report.spend ?? 0,
                    impressions: report.impressions ?? 0,
                    results: report.results ?? 0,
                    linkClicks: report.link_clicks ?? 0,
                    batchTotalResults,
                    batchTotalImpressions,
                    batchTotalLinkClicks
                  });

                  return (
                  <tr className="align-top text-[#d9dee5]" key={report.id}>
                    <td className="max-w-[260px] px-3 py-4">
                      <p className="font-semibold text-ink">{report.ad_name}</p>
                      <p className="mt-1 text-xs text-muted">{report.ad_set_name || "No ad set"}</p>
                      {report.utm_campaign || report.utm_content ? (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted">
                          {report.utm_campaign || "No campaign"} / {report.utm_content || "No content"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-xs">
                      <span className={parsed.visual === "Unparsed" ? "text-muted" : "font-semibold text-ink"}>
                        {parsed.visual}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-xs">
                      <span className={parsed.songSection === "Unparsed" ? "text-muted" : "font-semibold text-ink"}>
                        {parsed.songSection}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-xs">
                      <span className={parsed.revision === "Unparsed" ? "text-muted" : "font-semibold text-ink"}>
                        {parsed.revision}
                      </span>
                    </td>
                    <td className="min-w-[180px] px-3 py-4">
                      {confidence.type === "none" ? (
                        <span className="text-xs text-muted">{confidence.score}</span>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-ink">{confidence.score}</p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                            {confidence.type === "conversion" ? "Conversion-based" : "CTR-based"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="min-w-[250px] px-3 py-4">
                      <select
                        className="field-input"
                        disabled={pendingReportId === report.id}
                        onChange={(event) =>
                          void handleCopyLink(report.id, event.target.value || null)
                        }
                        value={report.linked_copy?.id ?? ""}
                      >
                        <option value="">No linked copy</option>
                        {detail.available_copies.map((copy) => (
                          <option key={copy.id} value={copy.id}>
                            {copy.hook.trim() || `Copy ${copy.id.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                      {report.linked_copy ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="pill">
                            {formatHookType(report.linked_copy.hook_type)}
                          </span>
                          <span className="pill">
                            {formatContentType(report.linked_copy.content_type)}
                          </span>
                          <span className="pill">
                            {formatSongSection(report.linked_copy.song_section)}
                          </span>
                          {report.linked_copy.creative_notes ? (
                            <p className="mt-2 text-xs leading-5 text-muted">
                              {report.linked_copy.creative_notes}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted">Unlinked copy row.</p>
                      )}
                    </td>
                    <td className="px-3 py-4">{report.ad_delivery || "N/A"}</td>
                    <td className="px-3 py-4">{formatMoney(report.spend)}</td>
                    <td className="px-3 py-4">{formatNumber(report.results)}</td>
                    <td className="px-3 py-4">{formatMoney(report.cost_per_result)}</td>
                    <td className="w-[120px] max-w-[120px] px-3 py-4 text-xs leading-5 text-muted">
                      <span
                        aria-label={resultType.detail}
                        className="inline-flex min-w-[54px] justify-center rounded-full border border-[#3b4350] bg-[#101216] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#f1dfad]"
                        title={resultType.detail}
                      >
                        {resultType.code}
                      </span>
                      <span className="mt-1 block max-w-[100px] text-[11px] leading-4 text-muted">
                        {resultType.label}
                      </span>
                    </td>
                    <td className="px-3 py-4">{formatNumber(report.link_clicks)}</td>
                    <td className="px-3 py-4">{formatNumber(report.landing_page_views)}</td>
                    <td className="px-3 py-4">
                      {formatPercent(calculateRatio(report.landing_page_views, report.link_clicks))}
                    </td>
                    <td className="px-3 py-4">
                      {formatMoney(report.cost_per_landing_page_view ?? calculateCost(report.spend, report.landing_page_views))}
                    </td>
                    <td className="px-3 py-4">{formatMoney(report.cpc)}</td>
                    <td className="px-3 py-4">{formatPercent(report.ctr)}</td>
                    <td className="px-3 py-4">
                      {formatNumber(report.frequency ?? (report.reach ? Math.round(((report.impressions ?? 0) / report.reach) * 100) / 100 : null))}
                    </td>
                    <td className="px-3 py-4">
                      {formatMoney(report.cpm ?? calculateCost((report.spend ?? 0) * 1000, report.impressions))}
                    </td>
                    <td className="px-3 py-4">{formatNumber(report.three_second_plays)}</td>
                    <td className="px-3 py-4">{formatNumber(report.thru_plays)}</td>
                    <td className="px-3 py-4">{formatNumber(report.video_100)}</td>
                    <td className="px-3 py-4">
                      {formatPercent(calculateRatio(report.video_100, report.three_second_plays))}
                    </td>
                    <td className="px-3 py-4">{formatNumber(report.post_saves)}</td>
                    <td className="px-3 py-4">{formatNumber(report.post_shares)}</td>
                    <td className="px-3 py-4">{formatNumber(report.instagram_follows)}</td>
                    <td className="min-w-[220px] px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        {report.performance_signals.length > 0 ? (
                          report.performance_signals.map((signal) => (
                            <span className="pill" key={signal}>
                              {signal}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No signal yet</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-center text-sm text-muted">
              No ad rows match the current filters.
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <StrategyTable
            rows={detail.strategy_breakdowns.hook_type.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "hook")
            }))}
            title="Performance by Copy Angle"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.content_type.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "content")
            }))}
            title="Performance by Content Type (Legacy)"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.song_section.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "section")
            }))}
            title="Performance by Song Section (Legacy)"
          />
          <StrategyTable rows={detail.strategy_breakdowns.combo} title="Performance by Combo" />
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <p className="field-label">/links Follow-Through</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Meta clicks to streaming intent</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Matches existing link-page analytics when UTM source is `meta` and both
              `utm_campaign` and `utm_content` line up with the imported ad row.
            </p>
          </div>

          {detail.link_follow_through.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#171a1f] text-[#b8bec6]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Ad</th>
                    <th className="px-3 py-3 font-semibold">Meta Clicks</th>
                    <th className="px-3 py-3 font-semibold">Page Views</th>
                    <th className="px-3 py-3 font-semibold">Streaming Clicks</th>
                    <th className="px-3 py-3 font-semibold">Spotify</th>
                    <th className="px-3 py-3 font-semibold">Apple</th>
                    <th className="px-3 py-3 font-semibold">YouTube</th>
                    <th className="px-3 py-3 font-semibold">Click to View</th>
                    <th className="px-3 py-3 font-semibold">View to Stream</th>
                    <th className="px-3 py-3 font-semibold">Meta to Stream</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252a31]">
                  {detail.link_follow_through.map((row) => {
                    const report = detail.reports.find((item) => item.id === row.ad_report_id);

                    return (
                      <tr className="text-[#d9dee5]" key={row.ad_report_id}>
                        <td className="px-3 py-4 font-semibold">{report?.ad_name ?? "Ad row"}</td>
                        <td className="px-3 py-4">{formatNumber(row.meta_link_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.links_page_views)}</td>
                        <td className="px-3 py-4">{formatNumber(row.outbound_streaming_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.spotify_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.apple_music_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.youtube_music_clicks)}</td>
                        <td className="px-3 py-4">{formatPercent(row.click_to_view_match_percentage)}</td>
                        <td className="px-3 py-4">{formatPercent(row.view_to_stream_intent_percentage)}</td>
                        <td className="px-3 py-4">{formatPercent(row.meta_click_to_stream_intent_percentage)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-sm text-muted">
              No matching /links data yet. Use UTM source `meta` plus matching
              `utm_campaign` and `utm_content` values to connect Meta clicks to
              link-page follow-through.
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="field-label">Human Context</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Notes and overrides</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isArchived
                    ? "This test cycle is archived. Notes are read-only."
                    : "The campaign decision above is computed. Use this only for context the data cannot know."}
                </p>
              </div>

              {!isArchived ? (
                <button
                  className="action-button-secondary"
                  onClick={() => setShowArchiveDialog(true)}
                  type="button"
                >
                  <Lock size={16} />
                  Lock &amp; Archive Test Cycle
                </button>
              ) : null}
            </div>

            {showArchiveDialog ? (
              <form
                className="space-y-4 rounded-[20px] border border-[#5b4920] bg-[#1a1710] px-4 py-4"
                onSubmit={handleArchive}
              >
                <p className="text-sm font-semibold text-[#d7b45e]">
                  Lock &amp; Archive — this action cannot be undone.
                </p>
                <label className="block space-y-2">
                  <span className="field-label">Final Decision</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setArchiveForm((current) => ({...current, final_decision: event.target.value}))
                    }
                    value={archiveForm.final_decision}
                  >
                    <option value="">Select final decision...</option>
                    {decisionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="field-label">Override Notes (optional)</span>
                  <textarea
                    className="field-input min-h-[80px]"
                    onChange={(event) =>
                      setArchiveForm((current) => ({...current, human_override_notes: event.target.value}))
                    }
                    placeholder="Context the data cannot know..."
                    value={archiveForm.human_override_notes}
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    className="action-button-primary"
                    disabled={isArchiving || !archiveForm.final_decision}
                    type="submit"
                  >
                    <Lock size={16} />
                    {isArchiving ? "Archiving..." : "Confirm Archive"}
                  </button>
                  <button
                    className="action-button-secondary"
                    onClick={() => setShowArchiveDialog(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            <form
              className="space-y-5"
              onSubmit={isArchived ? (event) => event.preventDefault() : handleLearningSave}
            >
              <fieldset className="space-y-5" disabled={isArchived}>
                <label className="block space-y-2">
                  <span className="field-label">Human Summary</span>
                  <textarea
                    className="field-input min-h-[100px]"
                    onChange={(event) =>
                      setLearning((current) => ({...current, summary: event.target.value}))
                    }
                    value={learning.summary}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="field-label">What Worked</span>
                    <textarea
                      className="field-input min-h-[120px]"
                      onChange={(event) =>
                        setLearning((current) => ({...current, what_worked: event.target.value}))
                      }
                      value={learning.what_worked}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="field-label">What Failed</span>
                    <textarea
                      className="field-input min-h-[120px]"
                      onChange={(event) =>
                        setLearning((current) => ({...current, what_failed: event.target.value}))
                      }
                      value={learning.what_failed}
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="field-label">Next Test</span>
                  <textarea
                    className="field-input min-h-[100px]"
                    onChange={(event) =>
                      setLearning((current) => ({...current, next_test: event.target.value}))
                    }
                    value={learning.next_test}
                  />
                </label>

                <div className="flex flex-wrap items-end justify-between gap-4">
                  <label className="space-y-2">
                    <span className="field-label">Decision</span>
                    <select
                      className="field-input"
                      onChange={(event) =>
                        setLearning((current) => ({
                          ...current,
                          decision: event.target.value as AdCampaignDecision
                        }))
                      }
                      value={learning.decision}
                    >
                      {decisionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!isArchived ? (
                    <button className="action-button-primary" disabled={isSavingLearning} type="submit">
                      <Save size={16} />
                      {isSavingLearning ? "Saving..." : "Save Learning"}
                    </button>
                  ) : null}
                </div>
              </fieldset>
            </form>
          </div>

          <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="field-label">Saved Human Context</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {detail.learning ? "Latest note" : "No note saved"}
              </h2>
            </div>
            {detail.learning ? (
              <div className="space-y-4 text-sm leading-6 text-muted">
                <p>
                  <span className="field-label block">Decision</span>
                  <span className="font-semibold capitalize text-ink">{detail.learning.decision}</span>
                </p>
                <p>
                  <span className="field-label block">Summary</span>
                  {detail.learning.summary || "No summary yet."}
                </p>
                <p>
                  <span className="field-label block">Next Test</span>
                  {detail.learning.next_test || "No next test noted yet."}
                </p>
              </div>
            ) : (
              <p className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-sm text-muted">
                Save a campaign learning once you have enough signal from this batch.
              </p>
            )}
          </section>
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Raw Imported Rows</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Debug table</h2>
            </div>
            <Link className="action-button-tertiary" href="/admin/attribution">
              Link-page attribution
              <ExternalLink size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Ad Set</th>
                  <th className="px-3 py-3 font-semibold">Ad</th>
                  <th className="px-3 py-3 font-semibold">Date Range</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Impressions</th>
                  <th className="px-3 py-3 font-semibold">Reach</th>
                  <th className="px-3 py-3 font-semibold">UTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {detail.reports.map((report) => (
                  <tr className="text-[#d9dee5]" key={report.id}>
                    <td className="px-3 py-4">{report.campaign_name || "N/A"}</td>
                    <td className="px-3 py-4">{report.ad_set_name || "N/A"}</td>
                    <td className="px-3 py-4 font-semibold">{report.ad_name}</td>
                    <td className="px-3 py-4">
                      {formatDate(report.reporting_start)} to {formatDate(report.reporting_end)}
                    </td>
                    <td className="px-3 py-4">{formatMoney(report.spend)}</td>
                    <td className="px-3 py-4">{formatNumber(report.impressions)}</td>
                    <td className="px-3 py-4">{formatNumber(report.reach)}</td>
                    <td className="px-3 py-4">
                      {report.utm_source || report.utm_campaign || report.utm_content
                        ? `${report.utm_source || "no source"} / ${report.utm_campaign || "no campaign"} / ${report.utm_content || "no content"}`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {showRenameDialog ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
            <form
              className="w-full max-w-xl rounded-[28px] border border-[#30343b] bg-[#111418] p-5 shadow-2xl sm:p-6"
              onSubmit={handleRename}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="field-label text-[#d7b45e]">Metadata Cleanup</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Rename ad import batch?</h2>
                </div>
                <button
                  className="action-button-tertiary !w-auto"
                  onClick={() => setShowRenameDialog(false)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-muted">
                <p>
                  Only the batch display label/name will be edited. All metrics, reports, links, and archived decision properties will remain untouched.
                </p>
              </div>

              <label className="mt-5 block space-y-2">
                <span className="field-label">Batch Name</span>
                <input
                  className="field-input"
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. mad_bunny_cycle_01"
                  value={newName}
                  required
                  maxLength={120}
                />
              </label>

              {message ? (
                <div className="mt-4 rounded-[18px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
                  {message}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  className="action-button-secondary"
                  disabled={isRenaming}
                  onClick={() => setShowRenameDialog(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="action-button-primary"
                  disabled={isRenaming || !newName.trim()}
                  type="submit"
                >
                  <Save size={16} />
                  {isRenaming ? "Renaming..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
