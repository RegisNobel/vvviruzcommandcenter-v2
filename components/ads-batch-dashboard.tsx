"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, ExternalLink, Save} from "lucide-react";

import {AdsDeleteBatchButton} from "@/components/ads-delete-batch-button";
import {defaultAdAttributionSetting} from "@/lib/ads/batch-metadata";
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
  HookType
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
  {value: "retest", label: "Retest"},
  {value: "iterate", label: "Iterate"},
  {value: "pause", label: "Pause"},
  {value: "archive", label: "Archive"}
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
    return formatContentType(value as CopyContentType);
  }

  return formatSongSection(value as CopySongSection);
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

  if (detail.spend >= 30) {
    score += 1;
    reasons.push("Spend is high enough to read beyond noise.");
  } else {
    warnings.push("Spend is still light; do not let a tiny test overrule stronger future data.");
  }

  if (detail.link_clicks >= 100) {
    score += 1;
    reasons.push("Meta link-click volume is meaningful.");
  } else {
    warnings.push("Link-click volume is thin.");
  }

  if (detail.landing_page_views >= 50) {
    score += 1;
    reasons.push("Landing-page view volume is usable.");
  } else {
    warnings.push("Landing-page view volume is low.");
  }

  if (outboundClicks >= 15) {
    score += 1;
    reasons.push("Streaming outbound click volume is usable.");
  } else {
    warnings.push("Streaming outbound click volume is low.");
  }

  if ((attributionCoverage ?? 0) >= 85) {
    score += 1;
    reasons.push("Most imported ads have explicit UTMs or matched first-party content values.");
  } else {
    warnings.push(
      "Some Meta rows lack exported URL parameters and do not match first-party content values, so ad-level attribution may be blurry."
    );
  }

  if (detail.batch_type === "Release-to-Date" || detail.batch_type === "Full Campaign" || detail.batch_type === "Fixed Period") {
    score += 1;
    reasons.push(`${detail.batch_type} exports are cleaner for campaign decisions than overlapping snapshots.`);
  } else {
    warnings.push("Rolling snapshots can overlap; treat comparisons as directional.");
  }

  if (score >= 5) {
    return {
      detail: "Strong enough to make a campaign decision, assuming the CSV export covers the intended window.",
      level: "High confidence",
      reasons,
      warnings
    };
  }

  if (score >= 3) {
    return {
      detail: "Useful directional signal, but keep the next test conservative.",
      level: "Medium confidence",
      reasons,
      warnings
    };
  }

  return {
    detail: "Weak signal. Use this readout to choose what to test next, not to declare a winner.",
    level: "Low confidence",
    reasons,
    warnings
  };
}

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

  if (confidence.level === "Low confidence") {
    return "Iterate";
  }

  if (detail.spend >= 40 && detail.link_clicks <= 5 && outboundClicks <= 1) {
    return "Retire";
  }

  if (landingQuality.tone === "bad" && detail.link_clicks >= 50) {
    return "Retest with new hook";
  }

  if (streamingQuality.tone === "bad" && detail.landing_page_views >= 25) {
    return "Retest with new visual";
  }

  if (
    topCreative &&
    (topCreative.results ?? 0) > 0 &&
    landingQuality.tone === "good" &&
    streamingQuality.tone !== "bad"
  ) {
    return "Scale";
  }

  if (detail.spend >= 50 && outboundClicks <= 2) {
    return "Pause";
  }

  return "Iterate";
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
    nextTest:
      decision === "Scale"
        ? `Increase budget carefully around ${topCreativeName} and keep the same UTM discipline.`
        : decision === "Retest with new hook"
          ? "Keep the strongest visual direction, but test a sharper hook and clearer promise."
          : decision === "Retest with new visual"
            ? "Keep the strongest hook, but test a new visual direction or stronger first-frame pattern."
            : decision === "Retire"
              ? "Stop spending on this direction and rebuild the creative from a different angle."
              : "Run the next test with one controlled change and wait for stronger confidence before scaling.",
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

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Ad Lab</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {detail.name || "Imported Meta Report"}
              </h1>
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
              <p className="field-label">Computed Campaign Readout</p>
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
            <ReadoutItem label="Best Hook" value={campaignReadout.bestHook} />
            <ReadoutItem label="Worst Hook" value={campaignReadout.worstHook} />
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
                <option value="all">All Hook Types</option>
                {hookTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatHookType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setContentFilter(event.target.value)} value={contentFilter}>
                <option value="all">All Content Types</option>
                {contentTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatContentType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
                <option value="all">All Song Sections</option>
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
            <table className="w-full min-w-[1900px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Ad Name</th>
                  <th className="px-3 py-3 font-semibold">Linked Copy</th>
                  <th className="px-3 py-3 font-semibold">Delivery</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Results</th>
                  <th className="px-3 py-3 font-semibold">Cost / Result</th>
                  <th className="w-[220px] px-3 py-3 font-semibold">Result Type</th>
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
                {filteredReports.map((report) => (
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
                    <td className="w-[220px] max-w-[220px] px-3 py-4 text-xs leading-5 text-muted">
                      <span
                        className="block max-w-[200px] break-all rounded-[14px] border border-[#252a31] bg-[#101216] px-2 py-1"
                        title={report.result_indicator || "N/A"}
                      >
                        {report.result_indicator || "N/A"}
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
                ))}
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
            title="Performance by Hook Type"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.content_type.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "content")
            }))}
            title="Performance by Content Type"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.song_section.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "section")
            }))}
            title="Performance by Song Section"
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
          <form className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6" onSubmit={handleLearningSave}>
            <div>
              <p className="field-label">Optional Human Context</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Notes and overrides</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                The campaign decision above is computed. Use this only for context the
                data cannot know, like why a creative was paused or what you want to try next.
              </p>
            </div>

            <label className="space-y-2">
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
              <label className="space-y-2">
                <span className="field-label">What Worked</span>
                <textarea
                  className="field-input min-h-[120px]"
                  onChange={(event) =>
                    setLearning((current) => ({...current, what_worked: event.target.value}))
                  }
                  value={learning.what_worked}
                />
              </label>
              <label className="space-y-2">
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

            <label className="space-y-2">
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

              <button className="action-button-primary" disabled={isSavingLearning} type="submit">
                <Save size={16} />
                {isSavingLearning ? "Saving..." : "Save Learning"}
              </button>
            </div>
          </form>

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
      </div>
    </main>
  );
}
