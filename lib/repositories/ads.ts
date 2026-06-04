import type {
  AdCampaignLearning,
  AdCreativeReport,
  AdImportBatch,
  CopyEntry,
  Release
} from "@prisma/client";

import {
  parseAdName,
  type ParsedAdName
} from "@/lib/ads/naming-parser";
import { calculateBatchDiagnostics, calculateReleaseComboSuggestions } from "@/lib/ads/diagnostics-engine";
import {
  calculateConfidenceSignal,
  type ConfidenceSignalResult
} from "@/lib/ads/stats";
import {
  mergeParsedMetaRows,
  normalizeMetaAdName,
  parseMetaCsv,
  type ParsedMetaAdRow
} from "@/lib/ads/meta-csv";
import {prisma} from "@/lib/db/prisma";
import {toDate} from "@/lib/db/serialization";
import {hydrateCopy, summarizeCopy} from "@/lib/copy";
import type {
  AdCampaignDecision,
  AdBatchType,
  AdCampaignLearningRecord,
  AdCreativeReportRecord,
  AdImportBatchDetail,
  AdImportBatchSummary,
  AdLinkFollowThroughRecord,
  AdStrategyBreakdownRow,
  CopySummary,
  CampaignHistoryCycle,
  CampaignHistoryCreative,
  ReleaseCampaignHistory,
  ReleaseAdMetricsOverview,
  ComponentPerformanceRow,
  CreativePerformanceMemorySummaryRow,
  CreativePerformanceMemory,
  AdPerformanceTimeline,
  AdPerformanceSnapshot,
  AdPerformanceRow,
  AdPerformanceCell,
  CopyPerformanceRow,
  CopyPerformanceCoverage,
  CopyPerformanceMemoryWinner,
  UnlinkedAdSummaryRow,
  CopyPerformanceMemory
} from "@/lib/types";
import {createId} from "@/lib/utils";
import {
  adDateRangesOverlap,
  canCombineAdBatchTotals,
  defaultAdAttributionSetting,
  getAdBatchComparisonMode,
  normalizeAdBatchType
} from "@/lib/ads/batch-metadata";

type ImportFileInput = {
  fileName: string;
  text: string;
};

type ImportAdsInput = {
  attributionSetting: string;
  batchType: string;
  exportedAt: string | null;
  releaseId: string | null;
  name: string;
  notes: string;
  files: ImportFileInput[];
};

type AdReportWithLinks = AdCreativeReport & {
  copyLinks: Array<{
    copyEntry: CopyEntry;
  }>;
  directCopyLinks?: Array<{
    copyEntry: CopyEntry;
  }>;
  effectiveCopyLinks?: Array<{
    copyEntry: CopyEntry;
  }>;
  copyLinkSource?: "direct" | "carryover" | "none";
};

type BatchWithReports = AdImportBatch & {
  release: Pick<Release, "id" | "title"> | null;
  reports: AdReportWithLinks[];
  learnings: AdCampaignLearning[];
};

const decisionOptions = new Set<AdCampaignDecision>([
  "scale",
  "iterate",
  "pause",
  "retire",
  "retest-hook",
  "retest-visual",
  "retest-audience",
  "needs-more-data"
]);

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function cost(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 100) / 100;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toDateOrNull(value: string | null) {
  return value ? new Date(value) : null;
}

function fromJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeString(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalizeNullableString(value: string | null | undefined) {
  return value?.trim() || null;
}

function toDateInputOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

type AdBatchTimelineLike = {
  createdAt: Date;
  exportedAt: Date | null;
  reportingEnd: Date | null;
  reportingStart: Date | null;
};

function getBatchTimelineDate(batch: AdBatchTimelineLike) {
  return new Date(batch.exportedAt ?? batch.reportingEnd ?? batch.createdAt).getTime();
}

function sortBatchesByTimeline<T extends AdBatchTimelineLike>(batchList: T[]) {
  return [...batchList].sort((a, b) => {
    const dateA = getBatchTimelineDate(a);
    const dateB = getBatchTimelineDate(b);

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function adBatchesHaveOverlap<T extends Pick<AdBatchTimelineLike, "reportingEnd" | "reportingStart">>(
  batchList: T[]
) {
  return batchList.some((batch, index) =>
    batchList.slice(index + 1).some((otherBatch) => {
      const left = {
        reporting_start: batch.reportingStart ? batch.reportingStart.toISOString() : null,
        reporting_end: batch.reportingEnd ? batch.reportingEnd.toISOString() : null
      };
      const right = {
        reporting_start: otherBatch.reportingStart ? otherBatch.reportingStart.toISOString() : null,
        reporting_end: otherBatch.reportingEnd ? otherBatch.reportingEnd.toISOString() : null
      };

      return adDateRangesOverlap(left, right);
    })
  );
}

function toCopySummary(copy: CopyEntry): CopySummary {
  return summarizeCopy(
    hydrateCopy({
      id: copy.id,
      release_id: copy.releaseId,
      hook: copy.hook,
      caption: copy.caption,
      hookType: copy.hookType || copy.type,
      contentType: copy.contentType,
      songSection: copy.songSection,
      creativeNotes: copy.creativeNotes,
      created_on: copy.createdOn.toISOString(),
      updated_on: copy.updatedOn.toISOString(),
      archived_at: copy.archivedAt ? copy.archivedAt.toISOString() : null,
      archive_reason: copy.archiveReason
    })
  );
}

function calculateReportSignals(
  report: AdCreativeReport,
  averages: {costPerResult: number | null; ctr: number | null}
) {
  const signals: string[] = [];
  const spend = report.spend ?? 0;
  const impressions = report.impressions ?? 0;
  const results = report.results ?? 0;
  const ctrValue =
    report.ctr ?? ratio(report.linkClicks ?? 0, report.impressions ?? 0) ?? 0;
  const costPerResult =
    report.costPerResult ?? cost(report.spend ?? 0, report.results ?? 0);
  const landingPageViews = report.landingPageViews ?? 0;
  const linkClicks = report.linkClicks ?? 0;
  const clickToLandingRate = ratio(landingPageViews, linkClicks) ?? 0;
  const videoHoldRate = ratio(report.video100 ?? 0, report.threeSecondPlays ?? 0) ?? 0;
  const engagement =
    (report.postSaves ?? 0) +
    (report.postShares ?? 0) +
    (report.postComments ?? 0) +
    (report.postReactions ?? 0);

  if (
    spend >= 20 &&
    results >= 5 &&
    costPerResult !== null &&
    costPerResult <= 0.50
  ) {
    signals.push("Scale Winner");
  }


  if (
    spend >= 10 &&
    results >= 3 &&
    costPerResult !== null &&
    averages.costPerResult !== null &&
    costPerResult <= averages.costPerResult
  ) {
    signals.push("Efficiency Winner");
  }

  if (impressions >= 500 && ctrValue >= 1.5) {
    signals.push("Click Winner");
  }

  if (linkClicks >= 10 && clickToLandingRate >= 75) {
    signals.push("Landing Intent Winner");
  }

  if (linkClicks >= 10 && clickToLandingRate > 0 && clickToLandingRate < 50) {
    signals.push("Landing Drop-off Risk");
  }

  if (impressions >= 500 && ((report.thruPlays ?? 0) >= 50 || (report.video100 ?? 0) >= 10)) {
    signals.push("Attention Winner");
  }

  if ((report.threeSecondPlays ?? 0) >= 100 && videoHoldRate >= 10) {
    signals.push("Retention Winner");
  }

  if ((report.frequency ?? 0) >= 2.5 && ctrValue < 0.75) {
    signals.push("Frequency Watch");
  }

  if (engagement >= 5) {
    signals.push("Engagement Winner");
  }

  if (spend > 0 && spend < 10 && (ctrValue >= 1.5 || results >= 1)) {
    signals.push("Retest Candidate");
  }

  if (spend >= 10 && results <= 0 && ctrValue < 0.5) {
    signals.push("Underperformer");
  }

  return signals;
}

function createBatchAverages(reports: AdCreativeReport[]) {
  const resultRows = reports.filter((report) => (report.results ?? 0) > 0);
  const ctrRows = reports.filter((report) => (report.impressions ?? 0) >= 500);
  const spend = sum(resultRows.map((report) => report.spend));
  const results = sum(resultRows.map((report) => report.results));
  const clicks = sum(ctrRows.map((report) => report.linkClicks));
  const impressions = sum(ctrRows.map((report) => report.impressions));

  return {
    costPerResult: cost(spend, results),
    ctr: ratio(clicks, impressions)
  };
}

function toReportRecord(
  report: AdReportWithLinks,
  averages: {costPerResult: number | null; ctr: number | null}
): AdCreativeReportRecord {
  const targetLinks = report.effectiveCopyLinks || report.copyLinks;
  const linkedCopy = targetLinks[0]?.copyEntry
    ? toCopySummary(targetLinks[0].copyEntry)
    : null;

  return {
    id: report.id,
    import_batch_id: report.importBatchId,
    release_id: report.releaseId,
    campaign_name: normalizeString(report.campaignName),
    ad_set_name: normalizeString(report.adSetName),
    ad_name: report.adName,
    ad_delivery: normalizeString(report.adDelivery),
    reporting_start: toIso(report.reportingStart),
    reporting_end: toIso(report.reportingEnd),
    spend: report.spend,
    impressions: report.impressions,
    reach: report.reach,
    frequency: report.frequency,
    cost_per_thousand_accounts_reached: report.costPerThousandAccountsReached,
    cpm: report.cpm,
    results: report.results,
    result_indicator: normalizeString(report.resultIndicator),
    cost_per_result: report.costPerResult,
    link_clicks: report.linkClicks,
    cpc: report.cpc,
    ctr: report.ctr,
    clicks_all: report.clicksAll,
    ctr_all: report.ctrAll,
    cpc_all: report.cpcAll,
    landing_page_views: report.landingPageViews,
    cost_per_landing_page_view: report.costPerLandingPageView,
    shop_clicks: report.shopClicks,
    page_engagement: report.pageEngagement,
    post_reactions: report.postReactions,
    post_comments: report.postComments,
    post_saves: report.postSaves,
    post_shares: report.postShares,
    facebook_likes: report.facebookLikes,
    instagram_follows: report.instagramFollows,
    video_plays: report.videoPlays,
    two_second_continuous_plays: report.twoSecondContinuousPlays,
    cost_per_two_second_continuous_play: report.costPerTwoSecondContinuousPlay,
    three_second_plays: report.threeSecondPlays,
    cost_per_three_second_play: report.costPerThreeSecondPlay,
    thru_plays: report.thruPlays,
    cost_per_thru_play: report.costPerThruPlay,
    video_25: report.video25,
    video_50: report.video50,
    video_75: report.video75,
    video_95: report.video95,
    video_100: report.video100,
    quality_ranking: normalizeString(report.qualityRanking),
    engagement_rate_ranking: normalizeString(report.engagementRateRanking),
    conversion_rate_ranking: normalizeString(report.conversionRateRanking),
    utm_source: normalizeString(report.utmSource),
    utm_campaign: normalizeString(report.utmCampaign),
    utm_content: normalizeString(report.utmContent),
    linked_copy: linkedCopy,
    copy_link_source: report.copyLinkSource || (report.copyLinks.length > 0 ? "direct" : "none"),
    performance_signals: calculateReportSignals(report, averages),
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString()
  };
}

function toLearningRecord(learning: AdCampaignLearning): AdCampaignLearningRecord {
  return {
    id: learning.id,
    import_batch_id: learning.importBatchId,
    release_id: learning.releaseId,
    summary: learning.summary,
    what_worked: learning.whatWorked,
    what_failed: learning.whatFailed,
    next_test: learning.nextTest,
    decision: decisionOptions.has(learning.decision as AdCampaignDecision)
      ? (learning.decision as AdCampaignDecision)
      : "iterate",
    reviewed_at: learning.reviewedAt ? learning.reviewedAt.toISOString() : null,
    reviewed_by: learning.reviewedBy,
    final_decision: learning.finalDecision,
    human_override_notes: learning.humanOverrideNotes,
    created_at: learning.createdAt.toISOString(),
    updated_at: learning.updatedAt.toISOString()
  };
}

function summarizeBatch(batch: BatchWithReports): AdImportBatchSummary {
  const reports = batch.reports;
  const spend = sum(reports.map((report) => report.spend));
  const impressions = sum(reports.map((report) => report.impressions));
  const reach = sum(reports.map((report) => report.reach));
  const results = sum(reports.map((report) => report.results));
  const linkClicks = sum(reports.map((report) => report.linkClicks));
  const clicksAll = sum(reports.map((report) => report.clicksAll));
  const landingPageViews = sum(reports.map((report) => report.landingPageViews));

  return {
    id: batch.id,
    source: batch.source,
    name: batch.name,
    release_id: batch.releaseId,
    release_title: batch.release?.title ?? null,
    reporting_start: toIso(batch.reportingStart),
    reporting_end: toIso(batch.reportingEnd),
    exported_at: toIso(batch.exportedAt),
    attribution_setting: normalizeString(batch.attributionSetting) || defaultAdAttributionSetting,
    batch_type: normalizeAdBatchType(batch.batchType) as AdBatchType,
    file_names: fromJsonArray(batch.fileNames),
    notes: batch.notes,
    report_count: reports.length,
    linked_copy_count: reports.filter((report) => {
      const targetLinks = report.effectiveCopyLinks || report.copyLinks;
      return targetLinks.length > 0;
    }).length,
    spend,
    impressions,
    reach,
    landing_page_views: landingPageViews,
    results,
    link_clicks: linkClicks,
    clicks_all: clicksAll,
    ctr: ratio(linkClicks, impressions),
    click_to_landing_rate: ratio(landingPageViews, linkClicks),
    cost_per_landing_page_view: cost(spend, landingPageViews),
    created_at: batch.createdAt.toISOString(),
    updated_at: batch.updatedAt.toISOString()
  };
}

function getCampaignHistoryCreative(
  report: AdCreativeReportRecord | null,
  batchTotals: {
    results: number;
    impressions: number;
    linkClicks: number;
  }
): CampaignHistoryCreative | null {
  if (!report) {
    return null;
  }

  const parsed: ParsedAdName = parseAdName(report.ad_name);
  const confidence: ConfidenceSignalResult = calculateConfidenceSignal({
    spend: report.spend ?? 0,
    impressions: report.impressions ?? 0,
    results: report.results ?? 0,
    linkClicks: report.link_clicks ?? 0,
    batchTotalResults: batchTotals.results,
    batchTotalImpressions: batchTotals.impressions,
    batchTotalLinkClicks: batchTotals.linkClicks
  });

  return {
    ad_name: report.ad_name,
    visual: parsed.visual,
    songSection: parsed.songSection,
    revision: parsed.revision,
    spend: report.spend ?? 0,
    results: report.results ?? 0,
    cost_per_result: report.cost_per_result ?? cost(report.spend ?? 0, report.results ?? 0),
    confidence_score: confidence.score,
    confidence_source: confidence.type
  };
}

function getTopCampaignHistoryReport(reports: AdCreativeReportRecord[]) {
  if (reports.length === 0) {
    return null;
  }

  const reportsWithResults = reports.filter((report) => (report.results ?? 0) > 0);

  if (reportsWithResults.length > 0) {
    return reportsWithResults.reduce((best, current) => {
      const bestCpr = best.cost_per_result ?? cost(best.spend ?? 0, best.results ?? 0) ?? Infinity;
      const currentCpr = current.cost_per_result ?? cost(current.spend ?? 0, current.results ?? 0) ?? Infinity;

      if (currentCpr < bestCpr) {
        return current;
      }

      if (currentCpr === bestCpr && (current.results ?? 0) > (best.results ?? 0)) {
        return current;
      }

      return best;
    });
  }

  return reports.reduce((best, current) => {
    const bestScore =
      (best.link_clicks ?? 0) * 2 +
      (best.landing_page_views ?? 0) * 3 +
      (best.post_saves ?? 0) * 3 +
      (best.post_shares ?? 0) * 2 +
      (best.video_100 ?? 0) * 0.1;
    const currentScore =
      (current.link_clicks ?? 0) * 2 +
      (current.landing_page_views ?? 0) * 3 +
      (current.post_saves ?? 0) * 3 +
      (current.post_shares ?? 0) * 2 +
      (current.video_100 ?? 0) * 0.1;

    return currentScore > bestScore ? current : best;
  });
}

function createCampaignHistoryCycle(
  batch: BatchWithReports,
  learning: AdCampaignLearning | null
): CampaignHistoryCycle {
  const averages = createBatchAverages(batch.reports);
  const reports = batch.reports.map((report) => toReportRecord(report, averages));
  const spend = sum(batch.reports.map((report) => report.spend));
  const impressions = sum(batch.reports.map((report) => report.impressions));
  const results = sum(batch.reports.map((report) => report.results));
  const linkClicks = sum(batch.reports.map((report) => report.linkClicks));
  const topReport = getTopCampaignHistoryReport(reports);
  const topCreative = getCampaignHistoryCreative(topReport, {
    results,
    impressions,
    linkClicks
  });

  return {
    learning_id: learning?.id ?? "",
    batch_id: batch.id,
    batch_name: batch.name,
    reviewed_at: learning?.reviewedAt?.toISOString() ?? "",
    reviewed_by: learning?.reviewedBy ?? "",
    final_decision: learning?.finalDecision || learning?.decision || "",
    human_override_notes: learning?.humanOverrideNotes ?? "",
    reporting_start: toIso(batch.reportingStart),
    reporting_end: toIso(batch.reportingEnd),
    batch_type: normalizeAdBatchType(batch.batchType) as AdBatchType,
    spend,
    results,
    cost_per_result: cost(spend, results),
    top_creative: topCreative,
    confidence_score: topCreative?.confidence_score ?? "Insufficient Data",
    confidence_source: topCreative?.confidence_source ?? "none"
  };
}

function dateRangesOverlap(
  left: Pick<CampaignHistoryCycle, "reporting_start" | "reporting_end">,
  right: Pick<CampaignHistoryCycle, "reporting_start" | "reporting_end">
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

function createStrategyBreakdowns(reports: AdCreativeReportRecord[]) {
  const groups = {
    hook_type: new Map<string, AdStrategyBreakdownRow>(),
    content_type: new Map<string, AdStrategyBreakdownRow>(),
    song_section: new Map<string, AdStrategyBreakdownRow>(),
    combo: new Map<string, AdStrategyBreakdownRow>()
  };

  function push(map: Map<string, AdStrategyBreakdownRow>, label: string, report: AdCreativeReportRecord) {
    const current =
      map.get(label) ??
      {
        label,
        spend: 0,
        impressions: 0,
        reach: 0,
        results: 0,
        link_clicks: 0,
        landing_page_views: 0,
        cpc: null,
        ctr: null,
        click_to_landing_rate: null,
        cost_per_landing_page_view: null,
        thru_plays: 0,
        video_100: 0,
        video_hold_rate: null,
        report_count: 0
      };

    current.spend += report.spend ?? 0;
    current.impressions += report.impressions ?? 0;
    current.reach += report.reach ?? 0;
    current.results += report.results ?? 0;
    current.link_clicks += report.link_clicks ?? 0;
    current.landing_page_views += report.landing_page_views ?? 0;
    current.thru_plays += report.thru_plays ?? 0;
    current.video_100 += report.video_100 ?? 0;
    current.report_count += 1;
    current.cpc = cost(current.spend, current.link_clicks);
    current.ctr = ratio(current.link_clicks, current.impressions);
    current.click_to_landing_rate = ratio(current.landing_page_views, current.link_clicks);
    current.cost_per_landing_page_view = cost(current.spend, current.landing_page_views);
    current.video_hold_rate = ratio(current.video_100, current.thru_plays);

    map.set(label, current);
  }

  for (const report of reports) {
    const hookType = report.linked_copy?.hook_type ?? "Unlinked";
    const contentType = report.linked_copy?.content_type ?? "Unlinked";
    const songSection = report.linked_copy?.song_section ?? "Unlinked";

    push(groups.hook_type, hookType, report);
    push(groups.content_type, contentType, report);
    push(groups.song_section, songSection, report);
    push(groups.combo, `${contentType} + ${hookType} + ${songSection}`, report);
  }

  return {
    hook_type: Array.from(groups.hook_type.values()),
    content_type: Array.from(groups.content_type.values()),
    song_section: Array.from(groups.song_section.values()),
    combo: Array.from(groups.combo.values())
  };
}

async function createLinkFollowThrough(reports: AdCreativeReportRecord[]) {
  const matchableReports = reports.filter((report) => {
    const hasExplicitMetaUtm =
      (!report.utm_source || report.utm_source.toLowerCase() === "meta") &&
      report.utm_campaign &&
      report.utm_content;

    return Boolean(hasExplicitMetaUtm || report.ad_name.trim());
  });

  if (matchableReports.length === 0) {
    return [];
  }

  const events = await prisma.analyticsEvent.findMany({
    where: {
      page: "links",
      utmSource: "meta"
    }
  });

  return matchableReports.map((report): AdLinkFollowThroughRecord => {
    const hasExplicitMetaUtm =
      (!report.utm_source || report.utm_source.toLowerCase() === "meta") &&
      report.utm_campaign &&
      report.utm_content;
    const normalizedAdName = normalizeMetaAdName(report.ad_name);
    const matchingEvents = events.filter((event) => {
      if (hasExplicitMetaUtm) {
        return event.utmCampaign === report.utm_campaign && event.utmContent === report.utm_content;
      }

      return Boolean(normalizedAdName && normalizeMetaAdName(event.utmContent) === normalizedAdName);
    });
    const views = matchingEvents.filter((event) => event.eventType === "links_page_view").length;
    const clicks = matchingEvents.filter((event) => event.eventType === "links_link_click");
    const spotify = clicks.filter((event) =>
      `${event.linkLabel} ${event.linkType}`.toLowerCase().includes("spotify")
    ).length;
    const apple = clicks.filter((event) =>
      `${event.linkLabel} ${event.linkType}`.toLowerCase().includes("apple")
    ).length;
    const youtube = clicks.filter((event) =>
      `${event.linkLabel} ${event.linkType}`.toLowerCase().includes("youtube")
    ).length;
    const outboundStreamingClicks = clicks.length;
    const metaClicks = report.link_clicks ?? 0;

    return {
      ad_report_id: report.id,
      meta_link_clicks: metaClicks,
      links_page_views: views,
      outbound_streaming_clicks: outboundStreamingClicks,
      spotify_clicks: spotify,
      apple_music_clicks: apple,
      youtube_music_clicks: youtube,
      click_to_view_match_percentage: ratio(views, metaClicks),
      view_to_stream_intent_percentage: ratio(outboundStreamingClicks, views),
      meta_click_to_stream_intent_percentage: ratio(outboundStreamingClicks, metaClicks)
    };
  });
}

async function readBatchWithReports(batchId: string): Promise<BatchWithReports> {
  const batch = await prisma.adImportBatch.findUnique({
    where: {
      id: batchId
    },
    include: {
      release: {
        select: {
          id: true,
          title: true
        }
      },
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        },
        orderBy: [
          {
            spend: "desc"
          },
          {
            adName: "asc"
          }
        ]
      },
      learnings: {
        orderBy: {
          updatedAt: "desc"
        }
      }
    }
  });

  if (!batch) {
    throw new Error("Ad import batch not found.");
  }

  if (batch.releaseId) {
    await resolveEffectiveCopyLinksForRelease(batch.releaseId, batch.reports);
  }

  return batch;
}

export async function resolveEffectiveCopyLinksForRelease<T extends AdReportWithLinks>(
  releaseId: string | null,
  reports: T[]
): Promise<T[]> {
  if (reports.length === 0) {
    return reports;
  }

  // Step 0: Initialize direct & effective copy links based on raw db copyLinks
  for (const r of reports) {
    r.directCopyLinks = [...r.copyLinks];
    r.effectiveCopyLinks = [...r.copyLinks];
    r.copyLinkSource = r.copyLinks.length > 0 ? "direct" : "none";
  }

  if (!releaseId) {
    return reports;
  }

  // 1. Fetch all batches for this release with their reports and copyLinks, ordered chronologically
  const batches = await prisma.adImportBatch.findMany({
    where: { releaseId },
    include: {
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  // 2. Sequentially build active copy links chronologically (forward-only carryover)
  const activeCopyLinksMap = new Map<string, CopyEntry>();
  const resolvedCarryoverMap = new Map<string, CopyEntry>();

  for (const batch of batches) {
    for (const report of batch.reports) {
      const normName = normalizeMetaAdName(report.adName);
      const existingLink = report.copyLinks[0]?.copyEntry;
      if (existingLink) {
        activeCopyLinksMap.set(normName, existingLink);
      } else {
        const carriedOver = activeCopyLinksMap.get(normName);
        if (carriedOver) {
          resolvedCarryoverMap.set(report.id, carriedOver);
        }
      }
    }
  }

  // 3. Apply resolved carryover to the input reports if they have no direct/manual links
  for (const r of reports) {
    if (r.directCopyLinks && r.directCopyLinks.length > 0) {
      // Direct link wins
      r.copyLinkSource = "direct";
    } else {
      const carriedCopy = resolvedCarryoverMap.get(r.id);
      if (carriedCopy) {
        r.effectiveCopyLinks = [
          {
            id: `virtual-${r.id}`,
            adCreativeReportId: r.id,
            copyEntryId: carriedCopy.id,
            createdAt: new Date(),
            copyEntry: carriedCopy
          }
        ] as any;
        r.copyLinkSource = "carryover";
      } else {
        r.effectiveCopyLinks = [];
        r.copyLinkSource = "none";
      }
    }
  }

  return reports;
}

function collectReportingDateRange(rows: ParsedMetaAdRow[]) {
  const starts = rows
    .map((row) => toDateOrNull(row.reporting_start))
    .filter((value): value is Date => Boolean(value));
  const ends = rows
    .map((row) => toDateOrNull(row.reporting_end))
    .filter((value): value is Date => Boolean(value));

  return {
    reportingStart:
      starts.length > 0
        ? new Date(Math.min(...starts.map((date) => date.getTime())))
        : null,
    reportingEnd:
      ends.length > 0
        ? new Date(Math.max(...ends.map((date) => date.getTime())))
        : null
  };
}

async function readPreviousCopyLinksForCarryover(releaseId: string, createdBefore: Date) {
  const reports = await prisma.adCreativeReport.findMany({
    where: {
      releaseId,
      importBatch: {
        createdAt: {
          lt: createdBefore
        }
      },
      copyLinks: {
        some: {}
      }
    },
    select: {
      adName: true,
      copyLinks: {
        select: {
          copyEntryId: true
        }
      },
      importBatch: {
        select: {
          createdAt: true
        }
      }
    }
  });

  const sortedReports = [...reports].sort((a, b) => {
    const aTime = a.importBatch?.createdAt?.getTime() ?? 0;
    const bTime = b.importBatch?.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const links = new Map<string, string>();

  for (const report of sortedReports) {
    const copyEntryId = report.copyLinks[0]?.copyEntryId;

    if (!copyEntryId) {
      continue;
    }

    const key = normalizeMetaAdName(report.adName);

    if (!links.has(key)) {
      links.set(key, copyEntryId);
    }
  }

  return links;
}

export async function importMetaAdReports(input: ImportAdsInput) {
  if (input.files.length === 0) {
    throw new Error("Upload at least one CSV file.");
  }

  const parsedFiles = input.files.map((file) => parseMetaCsv(file.fileName, file.text));
  const rows = mergeParsedMetaRows(parsedFiles.flatMap((file) => file.rows), {
    onConflict: (message) => console.warn(`[Ads Analytics] ${message}`)
  });

  if (rows.length === 0) {
    throw new Error("No valid Meta ad rows were found in the uploaded CSV files.");
  }

  const release = input.releaseId
    ? await prisma.release.findUnique({
        where: {
          id: input.releaseId
        },
        select: {
          id: true
        }
      })
    : null;
  const releaseId = release?.id ?? null;
  const now = new Date();
  const range = collectReportingDateRange(rows);
  const batchId = createId();
  const batchType = normalizeAdBatchType(input.batchType);
  const attributionSetting = input.attributionSetting.trim() || defaultAdAttributionSetting;
  const exportedAt = toDateInputOrNull(input.exportedAt) ?? now;
  const carryoverLinks = releaseId
    ? await readPreviousCopyLinksForCarryover(releaseId, now)
    : new Map<string, string>();
  const reportRows = rows.map((row) => ({
    id: createId(),
    releaseId,
    campaignName: normalizeNullableString(row.campaign_name),
    adSetName: normalizeNullableString(row.ad_set_name),
    adName: row.ad_name,
    adDelivery: normalizeNullableString(row.ad_delivery),
    reportingStart: row.reporting_start ? toDate(row.reporting_start) : null,
    reportingEnd: row.reporting_end ? toDate(row.reporting_end) : null,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    frequency: row.frequency,
    costPerThousandAccountsReached: row.cost_per_thousand_accounts_reached,
    cpm: row.cpm,
    results: row.results,
    resultIndicator: normalizeNullableString(row.result_indicator),
    costPerResult: row.cost_per_result,
    linkClicks: row.link_clicks,
    cpc: row.cpc,
    ctr: row.ctr,
    clicksAll: row.clicks_all,
    ctrAll: row.ctr_all,
    cpcAll: row.cpc_all,
    landingPageViews: row.landing_page_views,
    costPerLandingPageView: row.cost_per_landing_page_view,
    shopClicks: row.shop_clicks,
    pageEngagement: row.page_engagement,
    postReactions: row.post_reactions,
    postComments: row.post_comments,
    postSaves: row.post_saves,
    postShares: row.post_shares,
    facebookLikes: row.facebook_likes,
    instagramFollows: row.instagram_follows,
    videoPlays: row.video_plays,
    twoSecondContinuousPlays: row.two_second_continuous_plays,
    costPerTwoSecondContinuousPlay: row.cost_per_two_second_continuous_play,
    threeSecondPlays: row.three_second_plays,
    costPerThreeSecondPlay: row.cost_per_three_second_play,
    thruPlays: row.thru_plays,
    costPerThruPlay: row.cost_per_thru_play,
    video25: row.video_25,
    video50: row.video_50,
    video75: row.video_75,
    video95: row.video_95,
    video100: row.video_100,
    qualityRanking: normalizeNullableString(row.quality_ranking),
    engagementRateRanking: normalizeNullableString(row.engagement_rate_ranking),
    conversionRateRanking: normalizeNullableString(row.conversion_rate_ranking),
    utmSource: normalizeNullableString(row.utm_source),
    utmCampaign: normalizeNullableString(row.utm_campaign),
    utmContent: normalizeNullableString(row.utm_content),
    createdAt: now,
    updatedAt: now
  }));
  const carriedCopyLinks = reportRows
    .map((row) => ({
      id: createId(),
      adCreativeReportId: row.id,
      copyEntryId: carryoverLinks.get(normalizeMetaAdName(row.adName)),
      createdAt: now
    }))
    .filter(
      (link): link is {id: string; adCreativeReportId: string; copyEntryId: string; createdAt: Date} =>
        Boolean(link.copyEntryId)
    );

  await prisma.$transaction(async (transaction) => {
    await transaction.adImportBatch.create({
      data: {
        id: batchId,
        source: "meta",
        name: input.name.trim(),
        releaseId,
        reportingStart: range.reportingStart,
        reportingEnd: range.reportingEnd,
        exportedAt,
        attributionSetting,
        batchType,
        fileNames: JSON.stringify(input.files.map((file) => file.fileName)),
        notes: input.notes.trim(),
        createdAt: now,
        updatedAt: now,
        reports: {
          create: reportRows
        }
      }
    });

    if (carriedCopyLinks.length > 0) {
      await transaction.adCreativeCopyLink.createMany({
        data: carriedCopyLinks
      });
    }
  });

  return {
    batchId,
    importedRows: rows.length,
    carriedCopyLinks: carriedCopyLinks.length,
    files: parsedFiles.map((file) => ({
      fileName: file.fileName,
      columns: file.columns,
      rows: file.rows.length,
      warnings: file.warnings
    }))
  };
}

export async function deleteAdImportBatch(batchId: string) {
  const existing = await prisma.adImportBatch.findUnique({
    where: {
      id: batchId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new Error("Ad import batch not found.");
  }

  await prisma.$transaction(async (transaction) => {
    const reports = await transaction.adCreativeReport.findMany({
      where: {
        importBatchId: batchId
      },
      select: {
        id: true
      }
    });
    const reportIds = reports.map((report) => report.id);

    if (reportIds.length > 0) {
      await transaction.adCreativeCopyLink.deleteMany({
        where: {
          adCreativeReportId: {
            in: reportIds
          }
        }
      });
    }

    await transaction.adCampaignLearning.deleteMany({
      where: {
        importBatchId: batchId
      }
    });
    await transaction.adCreativeReport.deleteMany({
      where: {
        importBatchId: batchId
      }
    });
    await transaction.adImportBatch.delete({
      where: {
        id: batchId
      }
    });
  });
}

export async function renameAdImportBatch(batchId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Batch name cannot be empty.");
  }
  if (trimmed.length > 120) {
    throw new Error("Batch name cannot exceed 120 characters.");
  }

  const existing = await prisma.adImportBatch.findUnique({
    where: {
      id: batchId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new Error("Ad import batch not found.");
  }

  await prisma.adImportBatch.update({
    where: {
      id: batchId
    },
    data: {
      name: trimmed
    }
  });
}

export async function readAdImportBatchSummaries(releaseId?: string | null) {
  const batches = await prisma.adImportBatch.findMany({
    where: releaseId
      ? {
          releaseId
        }
      : undefined,
    include: {
      release: {
        select: {
          id: true,
          title: true
        }
      },
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      },
      learnings: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const reportsByRelease = new Map<string, AdReportWithLinks[]>();
  for (const batch of batches) {
    if (batch.releaseId) {
      const list = reportsByRelease.get(batch.releaseId) || [];
      list.push(...batch.reports);
      reportsByRelease.set(batch.releaseId, list);
    }
  }
  for (const [rid, rpts] of reportsByRelease.entries()) {
    await resolveEffectiveCopyLinksForRelease(rid, rpts);
  }

  return batches.map(summarizeBatch);
}

export async function readAdsHomeStats(releaseId?: string | null) {
  const summaries = await readAdImportBatchSummaries(releaseId);
  const canCombineTotals = summaries.length > 0 && canCombineAdBatchTotals(summaries);
  const metricSource = canCombineTotals
    ? summaries
    : summaries.length > 0
      ? [summaries[0]]
      : [];

  return {
    batches: summaries,
    overview: {
      import_count: summaries.length,
      report_count: sum(metricSource.map((batch) => batch.report_count)),
      spend: sum(metricSource.map((batch) => batch.spend)),
      impressions: sum(metricSource.map((batch) => batch.impressions)),
      results: sum(metricSource.map((batch) => batch.results)),
      link_clicks: sum(metricSource.map((batch) => batch.link_clicks)),
      landing_page_views: sum(metricSource.map((batch) => batch.landing_page_views)),
      click_to_landing_rate: ratio(
        sum(metricSource.map((batch) => batch.landing_page_views)),
        sum(metricSource.map((batch) => batch.link_clicks))
      ),
      cost_per_landing_page_view: cost(
        sum(metricSource.map((batch) => batch.spend)),
        sum(metricSource.map((batch) => batch.landing_page_views))
      ),
      comparison_mode: getAdBatchComparisonMode(summaries),
      can_combine_totals: canCombineTotals,
      metric_scope: canCombineTotals ? "Combined fixed-period totals" : "Latest snapshot only"
    }
  };
}

export async function readAdImportBatchDetail(batchId: string): Promise<AdImportBatchDetail> {
  const batch = await readBatchWithReports(batchId);
  const averages = createBatchAverages(batch.reports);
  const reports = batch.reports.map((report) => toReportRecord(report, averages));

  const linkedCopyIds = new Set<string>();
  for (const report of batch.reports) {
    for (const link of report.copyLinks) {
      linkedCopyIds.add(link.copyEntry.id);
    }
  }

  const availableCopies = await prisma.copyEntry.findMany({
    where: {
      OR: [
        {
          archivedAt: null,
          releaseId: batch.releaseId || null
        },
        {
          archivedAt: null,
          releaseId: null
        },
        {
          id: { in: Array.from(linkedCopyIds) }
        }
      ]
    },
    orderBy: [
      {
        releaseId: "desc"
      },
      {
        updatedOn: "desc"
      }
    ]
  });

  const detailResult: AdImportBatchDetail = {
    ...summarizeBatch(batch),
    reports,
    available_copies: availableCopies.map(toCopySummary),
    strategy_breakdowns: createStrategyBreakdowns(reports),
    link_follow_through: await createLinkFollowThrough(reports),
    learning: batch.learnings[0] ? toLearningRecord(batch.learnings[0]) : null
  };

  // Find other batches with the same ad names to determine multi-batch status
  const adNamesInBatch = reports.map((r) => r.ad_name);
  const allReportsWithSameNames = await prisma.adCreativeReport.findMany({
    where: {
      adName: { in: adNamesInBatch }
    },
    select: {
      adName: true,
      importBatchId: true
    }
  });

  const batchCountMap: Record<string, number> = {};
  const batchesPerAd = new Map<string, Set<string>>();
  for (const r of allReportsWithSameNames) {
    const norm = normalizeMetaAdName(r.adName);
    if (!batchesPerAd.has(norm)) {
      batchesPerAd.set(norm, new Set());
    }
    batchesPerAd.get(norm)!.add(r.importBatchId);
  }
  for (const [norm, batchIds] of batchesPerAd.entries()) {
    batchCountMap[norm] = batchIds.size;
  }

  // Find other batches for the same release to check for overlaps
  let hasOverlappingSnapshots = false;
  if (batch.releaseId) {
    const otherBatches = await prisma.adImportBatch.findMany({
      where: {
        releaseId: batch.releaseId,
        id: { not: batchId }
      },
      select: {
        reportingStart: true,
        reportingEnd: true
      }
    });
    hasOverlappingSnapshots = otherBatches.some((other) => {
      const left = {
        reporting_start: batch.reportingStart ? batch.reportingStart.toISOString() : null,
        reporting_end: batch.reportingEnd ? batch.reportingEnd.toISOString() : null
      };
      const right = {
        reporting_start: other.reportingStart ? other.reportingStart.toISOString() : null,
        reporting_end: other.reportingEnd ? other.reportingEnd.toISOString() : null
      };
      return adDateRangesOverlap(left, right);
    });
  }

  detailResult.creative_diagnostics = calculateBatchDiagnostics(detailResult, {
    batchCountMap,
    hasOverlappingSnapshots
  });

  return detailResult;
}

export async function setAdCreativeCopyLink(adCreativeReportId: string, copyEntryId: string | null) {
  const report = await prisma.adCreativeReport.findUnique({
    where: {
      id: adCreativeReportId
    },
    select: {
      id: true
    }
  });

  if (!report) {
    throw new Error("Ad report not found.");
  }

  await prisma.adCreativeCopyLink.deleteMany({
    where: {
      adCreativeReportId
    }
  });

  if (!copyEntryId) {
    return;
  }

  const copy = await prisma.copyEntry.findUnique({
    where: {
      id: copyEntryId
    },
    select: {
      id: true
    }
  });

  if (!copy) {
    throw new Error("Copy Lab entry not found.");
  }

  await prisma.adCreativeCopyLink.create({
    data: {
      id: createId(),
      adCreativeReportId,
      copyEntryId,
      createdAt: new Date()
    }
  });
}

export async function saveAdCampaignLearning(input: {
  importBatchId: string;
  releaseId: string | null;
  summary: string;
  whatWorked: string;
  whatFailed: string;
  nextTest: string;
  decision: AdCampaignDecision;
}) {
  const now = new Date();
  const existing = await prisma.adCampaignLearning.findFirst({
    where: {
      importBatchId: input.importBatchId
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  // Do not allow edits to a locked (archived) learning record.
  if (existing?.reviewedAt) {
    throw new Error(
      "This test cycle is archived. Use the archive record for historical reference."
    );
  }

  const data = {
    releaseId: input.releaseId,
    summary: input.summary.trim(),
    whatWorked: input.whatWorked.trim(),
    whatFailed: input.whatFailed.trim(),
    nextTest: input.nextTest.trim(),
    decision: decisionOptions.has(input.decision) ? input.decision : "iterate",
    updatedAt: now
  };

  if (existing) {
    return prisma.adCampaignLearning.update({
      where: {
        id: existing.id
      },
      data
    });
  }

  return prisma.adCampaignLearning.create({
    data: {
      id: createId(),
      importBatchId: input.importBatchId,
      ...data,
      createdAt: now
    }
  });
}

/**
 * V1.2 Lock & Archive: Permanently stamps a campaign learning record with the
 * reviewer's identity, a final decision override, and optional human notes.
 * Once archived, the record cannot be edited via saveAdCampaignLearning.
 */
export async function archiveAdCampaignLearning(input: {
  importBatchId: string;
  reviewedBy: string;
  finalDecision: string;
  humanOverrideNotes: string;
}) {
  const existing = await prisma.adCampaignLearning.findFirst({
    where: {
      importBatchId: input.importBatchId
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (!existing) {
    throw new Error(
      "No campaign learning found for this batch. Save a draft first before locking."
    );
  }

  if (existing.reviewedAt) {
    throw new Error("This test cycle is already archived.");
  }

  const now = new Date();

  return prisma.adCampaignLearning.update({
    where: {
      id: existing.id
    },
    data: {
      reviewedAt: now,
      reviewedBy: input.reviewedBy.trim(),
      finalDecision: input.finalDecision.trim(),
      humanOverrideNotes: input.humanOverrideNotes.trim(),
      updatedAt: now
    }
  });
}

export async function readLatestAdCampaignLearningForRelease(releaseId: string) {
  const learning = await prisma.adCampaignLearning.findFirst({
    where: {
      releaseId
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return learning ? toLearningRecord(learning) : null;
}

export async function readReleaseCampaignHistory(
  releaseId: string
): Promise<ReleaseCampaignHistory> {
  const batches = await prisma.adImportBatch.findMany({
    where: {
      releaseId
    },
    include: {
      release: {
        select: {
          id: true,
          title: true
        }
      },
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      },
      learnings: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const allReports = batches.flatMap((b) => b.reports);
  await resolveEffectiveCopyLinksForRelease(releaseId, allReports);

  const archivedCycles = batches
    .flatMap((batch) =>
      batch.learnings
        .filter((learning) => learning.reviewedAt)
        .map((learning) => createCampaignHistoryCycle(batch, learning))
    )
    .sort((left, right) => {
      const rightDate = new Date(right.reviewed_at).getTime();
      const leftDate = new Date(left.reviewed_at).getTime();

      return rightDate - leftDate;
    });

  const currentBatch =
    batches.find((batch) => !batch.learnings.some((learning) => learning.reviewedAt)) ?? null;
  const currentSnapshot = currentBatch ? createCampaignHistoryCycle(currentBatch, null) : null;
  const latestArchivedCycle = archivedCycles[0] ?? null;
  const rangesOverlap =
    latestArchivedCycle && currentSnapshot
      ? dateRangesOverlap(latestArchivedCycle, currentSnapshot)
      : false;

  return {
    archived_cycles: archivedCycles,
    current_snapshot: currentSnapshot,
    comparison:
      latestArchivedCycle && currentSnapshot
        ? {
            mode: rangesOverlap ? "Snapshot Comparison" : "Combined Fixed Period",
            archived_winner: latestArchivedCycle.top_creative,
            current_winner: currentSnapshot.top_creative,
            ranges_overlap: rangesOverlap
          }
        : null
  };
}

const emptyReleaseAdMetrics: ReleaseAdMetricsOverview = {
  has_data: false,
  source_label: "No data",
  source_context: null,
  total_spend: 0,
  total_impressions: 0,
  total_reach: 0,
  total_results: 0,
  total_link_clicks: 0,
  total_landing_page_views: 0,
  total_thru_plays: null,
  total_video_100: null,
  ctr: null,
  cpc: null,
  cpr: null,
  click_to_landing_rate: null,
  cost_per_landing_page_view: null,
  batch_count: 0,
  report_count: 0,
  best_ad: null,
  worst_ad: null,
  best_hook: null,
  worst_hook: null,
  batches: []
};

export async function readReleaseAdMetrics(releaseId: string): Promise<ReleaseAdMetricsOverview> {
  const batches = await prisma.adImportBatch.findMany({
    where: {
      releaseId
    },
    include: {
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (batches.length === 0) {
    return emptyReleaseAdMetrics;
  }

  const allReports = batches.flatMap((b) => b.reports);
  await resolveEffectiveCopyLinksForRelease(releaseId, allReports);

  let metricBatches: typeof batches;
  let sourceLabel = "";
  let sourceContext: ReleaseAdMetricsOverview["source_context"] = null;

  const r2dBatch = batches.find(b => b.batchType === "Release-to-Date" || b.batchType === "Full Campaign");

  if (r2dBatch) {
    metricBatches = [r2dBatch];
    sourceLabel = r2dBatch.batchType === "Full Campaign" ? "Using Full Campaign export" : "Using Release-to-Date export";
    sourceContext = {
      reporting_start: r2dBatch.reportingStart ? r2dBatch.reportingStart.toISOString() : null,
      reporting_end: r2dBatch.reportingEnd ? r2dBatch.reportingEnd.toISOString() : null,
      batch_type: r2dBatch.batchType,
      exported_at: r2dBatch.exportedAt ? r2dBatch.exportedAt.toISOString() : null,
      attribution_setting: r2dBatch.attributionSetting || defaultAdAttributionSetting
    };
  } else {
    const summarizedBatches = batches.map(batch => ({
      batch_type: normalizeAdBatchType(batch.batchType),
      reporting_start: batch.reportingStart ? batch.reportingStart.toISOString() : null,
      reporting_end: batch.reportingEnd ? batch.reportingEnd.toISOString() : null
    }));
    const canCombine = canCombineAdBatchTotals(summarizedBatches);
    
    if (canCombine && batches.length > 0) {
      metricBatches = batches;
      sourceLabel = "Combined non-overlapping fixed-period exports";
      
      const starts = metricBatches.map(b => b.reportingStart?.getTime()).filter(Boolean) as number[];
      const ends = metricBatches.map(b => b.reportingEnd?.getTime()).filter(Boolean) as number[];
      
      sourceContext = {
        reporting_start: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
        reporting_end: ends.length ? new Date(Math.max(...ends)).toISOString() : null,
        batch_type: "Combined Fixed Period",
        exported_at: metricBatches[0].exportedAt ? metricBatches[0].exportedAt.toISOString() : null,
        attribution_setting: metricBatches[0].attributionSetting || defaultAdAttributionSetting
      };
    } else {
      metricBatches = [batches[0]];
      sourceLabel = "Using latest summarized Meta snapshot";
      sourceContext = {
        reporting_start: batches[0].reportingStart ? batches[0].reportingStart.toISOString() : null,
        reporting_end: batches[0].reportingEnd ? batches[0].reportingEnd.toISOString() : null,
        batch_type: batches[0].batchType,
        exported_at: batches[0].exportedAt ? batches[0].exportedAt.toISOString() : null,
        attribution_setting: batches[0].attributionSetting || defaultAdAttributionSetting
      };
    }
  }

  const metricReports = metricBatches.flatMap((batch) => batch.reports);
  const averages = createBatchAverages(metricReports);
  const reportRecords = metricReports.map((report) => toReportRecord(report as AdReportWithLinks, averages));

  const totalSpend = sum(metricReports.map((r) => r.spend));
  const totalImpressions = sum(metricReports.map((r) => r.impressions));
  const totalReach = sum(metricReports.map((r) => r.reach));
  const totalResults = sum(metricReports.map((r) => r.results));
  const totalLinkClicks = sum(metricReports.map((r) => r.linkClicks));
  const totalLandingPageViews = sum(metricReports.map((r) => r.landingPageViews));
  const totalThruPlays = sum(metricReports.map((r) => r.thruPlays));
  const totalVideo100 = sum(metricReports.map((r) => r.video100));

  const getCpr = (r: AdCreativeReportRecord) => r.cost_per_result ?? cost(r.spend ?? 0, r.results ?? 0);

  // Best ad: lowest CPR among reports with meaningful spend and results
  const qualifyingForBest = reportRecords.filter(
    (r) => (r.spend ?? 0) >= 5 && (r.results ?? 0) >= 1 && getCpr(r) !== null
  );
  const bestAdReport = qualifyingForBest.length > 0
    ? qualifyingForBest.reduce((best, current) =>
        (getCpr(current) ?? Infinity) < (getCpr(best) ?? Infinity) ? current : best
      )
    : null;

  // Worst ad: highest CPR among reports with meaningful spend, or zero results with high spend
  const qualifyingForWorst = reportRecords.filter(
    (r) => (r.spend ?? 0) >= 5
  );
  const worstAdReport = qualifyingForWorst.length > 0
    ? qualifyingForWorst.reduce((worst, current) => {
        const currentCpr = getCpr(current) ?? Infinity;
        const worstCpr = getCpr(worst) ?? Infinity;

        return currentCpr > worstCpr ? current : worst;
      })
    : null;

  // Best hook: aggregate by hook_type across all reports, pick lowest CPR
  const hookMap = new Map<string, { spend: number; results: number; link_clicks: number; impressions: number }>();

  for (const report of reportRecords) {
    const hookType = report.linked_copy?.hook_type ?? null;

    if (!hookType) {
      continue;
    }

    const current = hookMap.get(hookType) ?? { spend: 0, results: 0, link_clicks: 0, impressions: 0 };

    current.spend += report.spend ?? 0;
    current.results += report.results ?? 0;
    current.link_clicks += report.link_clicks ?? 0;
    current.impressions += report.impressions ?? 0;
    hookMap.set(hookType, current);
  }

  let bestHook: ReleaseAdMetricsOverview["best_hook"] = null;
  let worstHook: ReleaseAdMetricsOverview["worst_hook"] = null;

  for (const [label, data] of hookMap) {
    const hookCpr = cost(data.spend, data.results);
    const hookCtr = ratio(data.link_clicks, data.impressions);
    
    const hookSummary = {
      label,
      spend: data.spend,
      results: data.results,
      link_clicks: data.link_clicks,
      cpr: hookCpr,
      ctr: hookCtr
    };

    if (data.results >= 1) {
      if (!bestHook || (hookCpr !== null && (bestHook.cpr === null || hookCpr < bestHook.cpr))) {
        bestHook = hookSummary;
      }
    }

    if (data.spend >= 5) {
      if (!worstHook || (hookCpr === null && worstHook.cpr !== null) || (hookCpr !== null && worstHook.cpr !== null && hookCpr > worstHook.cpr)) {
        worstHook = hookSummary;
      }
    }
  }

  return {
    has_data: true,
    source_label: sourceLabel,
    source_context: sourceContext,
    total_spend: totalSpend,
    total_impressions: totalImpressions,
    total_reach: totalReach,
    total_results: totalResults,
    total_link_clicks: totalLinkClicks,
    total_landing_page_views: totalLandingPageViews,
    total_thru_plays: totalThruPlays > 0 ? totalThruPlays : null,
    total_video_100: totalVideo100 > 0 ? totalVideo100 : null,
    ctr: ratio(totalLinkClicks, totalImpressions),
    cpc: cost(totalSpend, totalLinkClicks),
    cpr: cost(totalSpend, totalResults),
    click_to_landing_rate: ratio(totalLandingPageViews, totalLinkClicks),
    cost_per_landing_page_view: cost(totalSpend, totalLandingPageViews),
    batch_count: batches.length,
    report_count: allReports.length,
    best_ad: bestAdReport
      ? {
          ad_name: bestAdReport.ad_name,
          spend: bestAdReport.spend ?? 0,
          results: bestAdReport.results ?? 0,
          cpr: getCpr(bestAdReport),
          ctr: bestAdReport.ctr,
          signals: bestAdReport.performance_signals
        }
      : null,
    worst_ad: worstAdReport && worstAdReport.id !== bestAdReport?.id
      ? {
          ad_name: worstAdReport.ad_name,
          spend: worstAdReport.spend ?? 0,
          results: worstAdReport.results ?? 0,
          cpr: getCpr(worstAdReport),
          ctr: worstAdReport.ctr,
          signals: worstAdReport.performance_signals
        }
      : null,
    best_hook: bestHook,
    worst_hook: worstHook && worstHook.label !== bestHook?.label ? worstHook : null,
    batches: batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      spend: sum(batch.reports.map((r) => r.spend)),
      report_count: batch.reports.length,
      created_at: batch.createdAt.toISOString()
    }))
  };
}

export async function readCreativePerformanceMemory(
  releaseId: string
): Promise<CreativePerformanceMemory> {
  const batches = await prisma.adImportBatch.findMany({
    where: { releaseId },
    include: {
      reports: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const hasOverlappingSnapshots = adBatchesHaveOverlap(batches);

  type ReportWithBatch = {
    report: typeof batches[0]["reports"][0];
    batch: typeof batches[0];
  };

  const componentGroups = {
    visuals: new Map<string, ReportWithBatch[]>(),
    songSections: new Map<string, ReportWithBatch[]>(),
    revisions: new Map<string, ReportWithBatch[]>()
  };

  for (const batch of batches) {
    for (const report of batch.reports) {
      const parsed = parseAdName(report.adName);

      if (parsed.visual && parsed.visual !== "Unparsed") {
        const list = componentGroups.visuals.get(parsed.visual) ?? [];
        list.push({ report, batch });
        componentGroups.visuals.set(parsed.visual, list);
      }
      if (parsed.songSection && parsed.songSection !== "Unparsed") {
        const list = componentGroups.songSections.get(parsed.songSection) ?? [];
        list.push({ report, batch });
        componentGroups.songSections.set(parsed.songSection, list);
      }
      if (parsed.revision && parsed.revision !== "Unparsed") {
        const list = componentGroups.revisions.get(parsed.revision) ?? [];
        list.push({ report, batch });
        componentGroups.revisions.set(parsed.revision, list);
      }
    }
  }

  function processGroup(
    groupMap: Map<string, ReportWithBatch[]>
  ): ComponentPerformanceRow[] {
    const rows: ComponentPerformanceRow[] = [];

    for (const [value, reportsWithBatch] of groupMap.entries()) {
      const activeBatchIds = Array.from(
        new Set(reportsWithBatch.map((rb) => rb.batch.id))
      );
      const activeBatches = sortBatchesByTimeline(
        activeBatchIds.map((id) => batches.find((b) => b.id === id)!)
      );

      const isSpendOverlapping = adBatchesHaveOverlap(activeBatches);

      const reportsByBatch = new Map<string, typeof reportsWithBatch>();
      for (const rb of reportsWithBatch) {
        const list = reportsByBatch.get(rb.batch.id) ?? [];
        list.push(rb);
        reportsByBatch.set(rb.batch.id, list);
      }

      const batchCprs: { batchId: string; cpr: number | null; results: number; spend: number }[] = [];
      for (const [batchId, rbList] of reportsByBatch.entries()) {
        const bSpend = sum(rbList.map((rb) => rb.report.spend));
        const bResults = sum(rbList.map((rb) => rb.report.results));
        batchCprs.push({
          batchId,
          cpr: cost(bSpend, bResults),
          results: bResults,
          spend: bSpend
        });
      }

      const latestBatch = activeBatches[activeBatches.length - 1];
      const latestRbList = latestBatch ? (reportsByBatch.get(latestBatch.id) ?? []) : [];
      const metricReports = isSpendOverlapping ? latestRbList : reportsWithBatch;
      const metricBasis: ComponentPerformanceRow["metricBasis"] = isSpendOverlapping
        ? "latest_snapshot"
        : "combined_total";
      const totalSpend = sum(metricReports.map((rb) => rb.report.spend));
      const totalResults = sum(metricReports.map((rb) => rb.report.results));
      const totalImpressions = sum(metricReports.map((rb) => rb.report.impressions));
      const totalLinkClicks = sum(metricReports.map((rb) => rb.report.linkClicks));

      const averageCpr = cost(totalSpend, totalResults);

      const batchesWithResults = batchCprs.filter((bc) => bc.results > 0 && bc.cpr !== null);
      const bestBatchCpr =
        batchesWithResults.length > 0
          ? Math.min(...batchesWithResults.map((bc) => bc.cpr!))
          : null;

      const latestBatchData = batchCprs.find((bc) => bc.batchId === latestBatch.id);
      const latestBatchCpr = latestBatchData ? latestBatchData.cpr : null;

      const backgroundReports = isSpendOverlapping
        ? latestBatch.reports
        : activeBatches.flatMap((b) => b.reports);
      const bgResults = sum(backgroundReports.map((r) => r.results));
      const bgImpressions = sum(backgroundReports.map((r) => r.impressions));
      const bgLinkClicks = sum(backgroundReports.map((r) => r.linkClicks));

      const confidence = calculateConfidenceSignal({
        spend: totalSpend,
        impressions: totalImpressions,
        results: totalResults,
        linkClicks: totalLinkClicks,
        batchTotalResults: bgResults,
        batchTotalImpressions: bgImpressions,
        batchTotalLinkClicks: bgLinkClicks
      });

      let trendLabel: ComponentPerformanceRow["trendLabel"] = "Needs More Data";
      const batchCount = activeBatches.length;

      if (batchCount < 2 || totalSpend < 10 || totalResults < 5) {
        trendLabel = "Needs More Data";
      } else {
        const previousBatches = activeBatches.slice(0, -1);
        const previousSnapshotBatch = previousBatches[previousBatches.length - 1];
        const previousRbList = isSpendOverlapping && previousSnapshotBatch
          ? (reportsByBatch.get(previousSnapshotBatch.id) ?? [])
          : reportsWithBatch.filter((rb) =>
              previousBatches.some((pb) => pb.id === rb.batch.id)
            );
        const previousSpend = sum(previousRbList.map((rb) => rb.report.spend));
        const previousResults = sum(previousRbList.map((rb) => rb.report.results));

        if (previousResults > 0 && latestBatchData && latestBatchData.results > 0 && latestBatchCpr !== null) {
          const previousCpr = cost(previousSpend, previousResults);
          if (previousCpr !== null && previousCpr > 0) {
            if (latestBatchCpr <= previousCpr * 0.85) {
              trendLabel = "Improving";
            } else if (latestBatchCpr >= previousCpr * 1.15) {
              trendLabel = "Fading";
            } else {
              trendLabel = "Stable";
            }
          } else {
            trendLabel = "Stable";
          }
        } else {
          trendLabel = "Stable";
        }
      }

      rows.push({
        value,
        batchCount,
        totalSpend,
        isSpendOverlapping,
        metricBasis,
        totalResults,
        averageCpr,
        bestBatchCpr,
        latestBatchCpr,
        confidenceScore: confidence.score,
        confidenceType: confidence.type,
        trendLabel
      });
    }

    return rows.sort((a, b) => b.totalSpend - a.totalSpend);
  }

  const visuals = processGroup(componentGroups.visuals);
  const songSections = processGroup(componentGroups.songSections);
  const revisions = processGroup(componentGroups.revisions);

  // Best Visual: spend >= 10, warning if seen in only 1 batch
  const qualifyingVisuals = visuals.filter((v) => v.totalSpend >= 10 && v.averageCpr !== null);
  let bestVisual: CreativePerformanceMemorySummaryRow | null = null;
  if (qualifyingVisuals.length > 0) {
    const winner = qualifyingVisuals.reduce((best, curr) =>
      curr.averageCpr! < best.averageCpr! ? curr : best
    );
    bestVisual = {
      value: winner.value,
      cpr: winner.averageCpr,
      results: winner.totalResults,
      warning: winner.isSpendOverlapping
        ? "Rolling snapshot: latest batch only"
        : winner.batchCount === 1 ? "Seen in only 1 batch" : undefined
    };
  }

  // Best Song Section: spend >= 10, warning if seen in only 1 batch
  const qualifyingSongSections = songSections.filter((s) => s.totalSpend >= 10 && s.averageCpr !== null);
  let bestSongSection: CreativePerformanceMemorySummaryRow | null = null;
  if (qualifyingSongSections.length > 0) {
    const winner = qualifyingSongSections.reduce((best, curr) =>
      curr.averageCpr! < best.averageCpr! ? curr : best
    );
    bestSongSection = {
      value: winner.value,
      cpr: winner.averageCpr,
      results: winner.totalResults,
      warning: winner.isSpendOverlapping
        ? "Rolling snapshot: latest batch only"
        : winner.batchCount === 1 ? "Seen in only 1 batch" : undefined
    };
  }

  const allRows = [...visuals, ...songSections, ...revisions];

  // Efficiency Winner: at least $10 spend and at least 5 results
  const qualifyingEfficiency = allRows.filter(
    (row) => row.totalSpend >= 10 && row.totalResults >= 5 && row.averageCpr !== null
  );
  let efficiencyWinner: CreativePerformanceMemorySummaryRow | null = null;
  if (qualifyingEfficiency.length > 0) {
    const winner = qualifyingEfficiency.reduce((best, curr) =>
      curr.averageCpr! < best.averageCpr! ? curr : best
    );
    efficiencyWinner = {
      value: winner.value,
      cpr: winner.averageCpr,
      results: winner.totalResults
    };
  }

  // Volume Winner: highest total results with spend >= 10 and results >= 5
  const qualifyingVolume = allRows.filter((row) => row.totalSpend >= 10 && row.totalResults >= 5);
  let volumeWinner: CreativePerformanceMemorySummaryRow | null = null;
  if (qualifyingVolume.length > 0) {
    const winner = qualifyingVolume.reduce((best, curr) =>
      curr.totalResults > best.totalResults ? curr : best
    );
    volumeWinner = {
      value: winner.value,
      cpr: winner.averageCpr,
      results: winner.totalResults
    };
  }

  // Strongest Confidence Signal: must pass minimum spend ($5.0) and impression (100) thresholds
  let strongestConfidenceSignal: CreativePerformanceMemorySummaryRow | null = null;
  let highestZ = -Infinity;
  let bestConfRow: typeof allRows[0] | null = null;

  for (const row of allRows) {
    const rbList = [
      ...(componentGroups.visuals.get(row.value) ?? []),
      ...(componentGroups.songSections.get(row.value) ?? []),
      ...(componentGroups.revisions.get(row.value) ?? [])
    ];
    const activeBatches = sortBatchesByTimeline(Array.from(
      new Set(rbList.map((rb) => rb.batch.id))
    ).map((id) => batches.find((b) => b.id === id)!));
    const confidenceRowsOverlap = adBatchesHaveOverlap(activeBatches);
    const reportsByBatch = new Map<string, typeof rbList>();
    for (const rb of rbList) {
      const list = reportsByBatch.get(rb.batch.id) ?? [];
      list.push(rb);
      reportsByBatch.set(rb.batch.id, list);
    }
    const latestBatch = activeBatches[activeBatches.length - 1];
    const confidenceReports = confidenceRowsOverlap && latestBatch
      ? (reportsByBatch.get(latestBatch.id) ?? [])
      : rbList;
    const spend = sum(confidenceReports.map((rb) => rb.report.spend));
    const impressions = sum(confidenceReports.map((rb) => rb.report.impressions));
    const results = sum(confidenceReports.map((rb) => rb.report.results));
    const linkClicks = sum(confidenceReports.map((rb) => rb.report.linkClicks));

    if (spend < 5.0 || impressions < 100) {
      continue;
    }

    const backgroundReports = confidenceRowsOverlap && latestBatch
      ? latestBatch.reports
      : activeBatches.flatMap((b) => b.reports);
    const bgResults = sum(backgroundReports.map((r) => r.results));
    const bgImpressions = sum(backgroundReports.map((r) => r.impressions));
    const bgLinkClicks = sum(backgroundReports.map((r) => r.linkClicks));

    let p1 = 0;
    let p0 = 0;
    if (bgResults > 0) {
      p1 = results / impressions;
      p0 = bgResults / bgImpressions;
    } else if (bgLinkClicks > 0) {
      p1 = linkClicks / impressions;
      p0 = bgLinkClicks / bgImpressions;
    } else {
      continue;
    }

    if (p0 <= 0 || p0 >= 1) continue;
    const se = Math.sqrt((p0 * (1.0 - p0)) / impressions);
    if (se === 0) continue;
    const z = (p1 - p0) / se;

    if (z >= 1.28 && z > highestZ) {
      highestZ = z;
      bestConfRow = row;
    }
  }

  if (bestConfRow) {
    strongestConfidenceSignal = {
      value: bestConfRow.value,
      score: bestConfRow.confidenceScore,
      results: bestConfRow.totalResults,
      cpr: bestConfRow.averageCpr
    };
  }

  return {
    visuals,
    songSections,
    revisions,
    bestVisual,
    bestSongSection,
    volumeWinner,
    efficiencyWinner,
    strongestConfidenceSignal,
    hasOverlappingSnapshots
  };
}

export async function readAdPerformanceTimeline(
  releaseId: string
): Promise<AdPerformanceTimeline> {
  const batches = await prisma.adImportBatch.findMany({
    where: { releaseId },
    include: {
      reports: true
    }
  });

  const sortedBatches = [...batches].sort((a, b) => {
    const dateA = a.reportingEnd ? new Date(a.reportingEnd).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.reportingEnd ? new Date(b.reportingEnd).getTime() : new Date(b.createdAt).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const hasOverlappingSnapshots = sortedBatches.some((batch, index) =>
    sortedBatches.slice(index + 1).some((otherBatch) => {
      const left = {
        reporting_start: batch.reportingStart ? batch.reportingStart.toISOString() : null,
        reporting_end: batch.reportingEnd ? batch.reportingEnd.toISOString() : null
      };
      const right = {
        reporting_start: otherBatch.reportingStart ? otherBatch.reportingStart.toISOString() : null,
        reporting_end: otherBatch.reportingEnd ? otherBatch.reportingEnd.toISOString() : null
      };
      return adDateRangesOverlap(left, right);
    })
  );

  const adNamesMap = new Map<string, string>(); // normalized -> original
  const batchAdDataMap = new Map<string, Map<string, { spend: number; results: number; impressions: number; linkClicks: number; cpr: number | null; originalName: string }>>();

  for (const batch of sortedBatches) {
    const adMap = new Map<string, { spend: number; results: number; impressions: number; linkClicks: number; cpr: number | null; originalName: string }>();
    for (const report of batch.reports) {
      const norm = normalizeMetaAdName(report.adName);
      adNamesMap.set(norm, report.adName);

      const existing = adMap.get(norm);
      const spend = report.spend ?? 0;
      const results = report.results ?? 0;
      const impressions = report.impressions ?? 0;
      const linkClicks = report.linkClicks ?? 0;

      if (existing) {
        existing.spend += spend;
        existing.results += results;
        existing.impressions += impressions;
        existing.linkClicks += linkClicks;
      } else {
        adMap.set(norm, {
          spend,
          results,
          impressions,
          linkClicks,
          cpr: null,
          originalName: report.adName
        });
      }
    }

    for (const data of adMap.values()) {
      data.cpr = cost(data.spend, data.results);
    }
    batchAdDataMap.set(batch.id, adMap);
  }

  const snapshots: AdPerformanceSnapshot[] = sortedBatches.map((batch) => {
    const adMap = batchAdDataMap.get(batch.id)!;
    const totalSpend = sum(Array.from(adMap.values()).map(a => a.spend));
    const totalResults = sum(Array.from(adMap.values()).map(a => a.results));

    let winnerAdName: string | null = null;
    let lowestCpr = Infinity;
    for (const [norm, data] of adMap.entries()) {
      if (data.spend >= 10 && data.results >= 5 && data.cpr !== null) {
        if (data.cpr < lowestCpr) {
          lowestCpr = data.cpr;
          winnerAdName = norm;
        }
      }
    }

    let lowDataWinnerAdName: string | null = null;
    if (!winnerAdName) {
      let lowestLowDataCpr = Infinity;
      for (const [norm, data] of adMap.entries()) {
        if (data.spend > 0 && data.results > 0 && data.cpr !== null) {
          if (data.cpr < lowestLowDataCpr) {
            lowestLowDataCpr = data.cpr;
            lowDataWinnerAdName = norm;
          }
        }
      }
    }

    return {
      id: batch.id,
      name: batch.name,
      reportingStart: batch.reportingStart ? batch.reportingStart.toISOString() : null,
      reportingEnd: batch.reportingEnd ? batch.reportingEnd.toISOString() : null,
      totalSpend,
      totalResults,
      winnerAdName,
      lowDataWinnerAdName,
      lostLeadAdName: null
    };
  });

  for (let i = 1; i < snapshots.length; i++) {
    const prevWinner = snapshots[i - 1].winnerAdName;
    const currWinner = snapshots[i].winnerAdName;
    if (prevWinner && currWinner !== prevWinner) {
      snapshots[i].lostLeadAdName = prevWinner;
    }
  }

  const adTotalSpend = new Map<string, number>();
  for (const norm of adNamesMap.keys()) {
    let total = 0;
    for (const batch of sortedBatches) {
      const adMap = batchAdDataMap.get(batch.id)!;
      total += adMap.get(norm)?.spend ?? 0;
    }
    adTotalSpend.set(norm, total);
  }

  const sortedAdNames = Array.from(adNamesMap.keys()).sort((a, b) => {
    return (adTotalSpend.get(b) ?? 0) - (adTotalSpend.get(a) ?? 0);
  });

  const rows: AdPerformanceRow[] = sortedAdNames.map((norm) => {
    const originalName = adNamesMap.get(norm)!;
    const cells: Array<AdPerformanceCell | null> = [];

    for (let i = 0; i < sortedBatches.length; i++) {
      const batch = sortedBatches[i];
      const adMap = batchAdDataMap.get(batch.id)!;
      const data = adMap.get(norm);

      if (!data) {
        cells.push(null);
        continue;
      }

      const bgResults = sum(batch.reports.map((r) => r.results));
      const bgImpressions = sum(batch.reports.map((r) => r.impressions));
      const bgLinkClicks = sum(batch.reports.map((r) => r.linkClicks));

      const confidence = calculateConfidenceSignal({
        spend: data.spend,
        impressions: data.impressions,
        results: data.results,
        linkClicks: data.linkClicks,
        batchTotalResults: bgResults,
        batchTotalImpressions: bgImpressions,
        batchTotalLinkClicks: bgLinkClicks
      });

      const isSnapshotWinner = snapshots[i].winnerAdName === norm;

      let movementLabel: AdPerformanceCell["movementLabel"] = null;

      let isPresentBefore = false;
      for (let prevIdx = 0; prevIdx < i; prevIdx++) {
        if (batchAdDataMap.get(sortedBatches[prevIdx].id)!.has(norm)) {
          isPresentBefore = true;
          break;
        }
      }

      let hasWonBefore = false;
      for (let prevIdx = 0; prevIdx < i - 1; prevIdx++) {
        if (snapshots[prevIdx].winnerAdName === norm) {
          hasWonBefore = true;
          break;
        }
      }

      const wasWinner = i > 0 && snapshots[i - 1].winnerAdName === norm;

      if (isSnapshotWinner) {
        if (wasWinner) {
          movementLabel = "Held Lead";
        } else if (hasWonBefore) {
          movementLabel = "Rebounded";
        } else {
          movementLabel = "New Winner";
        }
      } else {
        if (!isPresentBefore) {
          movementLabel = "New Entrant";
        } else if (data.spend < 10 || data.results < 5) {
          movementLabel = "Needs More Data";
        }
      }

      cells.push({
        cpr: data.cpr,
        results: data.results,
        spend: data.spend,
        confidenceScore: confidence.score,
        confidenceType: confidence.type,
        movementLabel,
        isSnapshotWinner,
        isPresent: true
      });
    }

    return {
      normalizedName: norm,
      originalName,
      cells
    };
  });

  return {
    snapshots,
    rows,
    hasOverlappingSnapshots
  };
}

export async function readCopyPerformanceMemory(
  releaseId: string
): Promise<CopyPerformanceMemory> {
  const batches = await prisma.adImportBatch.findMany({
    where: { releaseId },
    include: {
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const allReports = batches.flatMap((b) => b.reports) as AdReportWithLinks[];
  await resolveEffectiveCopyLinksForRelease(releaseId, allReports);

  const averages = createBatchAverages(allReports);
  const reportRecords = allReports.map((report) => toReportRecord(report, averages));
  const followThroughs = await createLinkFollowThrough(reportRecords);
  const followThroughMap = new Map<string, AdLinkFollowThroughRecord>();
  for (const ft of followThroughs) {
    followThroughMap.set(ft.ad_report_id, ft);
  }

  type ReportWithData = {
    report: typeof allReports[0];
    record: AdCreativeReportRecord;
    visual: string;
    songSection: string;
    revision: string;
    outboundStreamingClicks: number;
    batch: typeof batches[0];
  };

  const reportsWithData: ReportWithData[] = allReports.map((report, idx) => {
    const record = reportRecords[idx];
    const parsed = parseAdName(report.adName);
    const ft = followThroughMap.get(report.id);
    const outboundStreamingClicks = ft?.outbound_streaming_clicks ?? 0;
    const batch = batches.find((b) => b.id === report.importBatchId)!;
    return {
      report,
      record,
      visual: parsed.visual || "Unparsed",
      songSection: parsed.songSection || "Unparsed",
      revision: parsed.revision || "Unparsed",
      outboundStreamingClicks,
      batch
    };
  });

  const sortedBatches = sortBatchesByTimeline(batches);
  const hasOverlappingSnapshots = adBatchesHaveOverlap(sortedBatches);
  const latestOverallBatch = sortedBatches[sortedBatches.length - 1] ?? null;
  const coverageItems = hasOverlappingSnapshots && latestOverallBatch
    ? reportsWithData.filter((item) => item.batch.id === latestOverallBatch.id)
    : reportsWithData;

  let totalSpend = 0;
  let linkedSpend = 0;
  let unlinkedSpend = 0;

  const adCopyStatus = new Map<string, boolean>();

  for (const item of coverageItems) {
    const targetLinks = item.report.effectiveCopyLinks || item.report.copyLinks;
    const hasLink = targetLinks.length > 0;
    const normName = normalizeMetaAdName(item.report.adName);
    totalSpend += item.report.spend ?? 0;
    if (hasLink) {
      linkedSpend += item.report.spend ?? 0;
      adCopyStatus.set(normName, true);
    } else {
      unlinkedSpend += item.report.spend ?? 0;
      if (!adCopyStatus.has(normName)) {
        adCopyStatus.set(normName, false);
      }
    }
  }

  let linkedAdCount = 0;
  let unlinkedAdCount = 0;
  for (const isLinked of adCopyStatus.values()) {
    if (isLinked) {
      linkedAdCount++;
    } else {
      unlinkedAdCount++;
    }
  }

  const linkedSpendPercentage = totalSpend > 0 ? (linkedSpend / totalSpend) * 100 : 0;
  const unlinkedSpendPercentage = totalSpend > 0 ? (unlinkedSpend / totalSpend) * 100 : 0;

  const coverage: CopyPerformanceCoverage = {
    totalSpend,
    linkedSpend,
    unlinkedSpend,
    metricBasis: hasOverlappingSnapshots ? "latest_snapshot" : "combined_total",
    linkedSpendPercentage,
    unlinkedSpendPercentage,
    linkedAdCount,
    unlinkedAdCount
  };

  const pairGroups = new Map<string, { copyEntry: CopyEntry; items: ReportWithData[] }>();
  const angleGroups = new Map<string, ReportWithData[]>();
  const songSectionGroups = new Map<string, ReportWithData[]>();
  const comboGroups = new Map<string, { key: string; copyEntry?: CopyEntry; songSection?: string; items: ReportWithData[] }>();
  const unlinkedAdsMap = new Map<string, ReportWithData[]>();

  angleGroups.set("Unlinked", []);
  songSectionGroups.set("Unlinked", []);
  comboGroups.set("Unlinked", { key: "Unlinked", items: [] });

  function formatHookType(hookType: string): string {
    if (!hookType) return "Unspecified Angle";
    return hookType
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  function formatSongSection(songSection: string): string {
    if (!songSection) return "Unspecified Section";
    return songSection
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  for (const item of reportsWithData) {
    const targetLinks = item.report.effectiveCopyLinks || item.report.copyLinks;
    const copyLink = targetLinks[0]?.copyEntry;
    const normName = normalizeMetaAdName(item.report.adName);

    if (copyLink) {
      const pairKey = copyLink.id;
      const pairGroup = pairGroups.get(pairKey) ?? { copyEntry: copyLink, items: [] };
      pairGroup.items.push(item);
      pairGroups.set(pairKey, pairGroup);

      const angleKey = formatHookType(copyLink.hookType);
      const angleList = angleGroups.get(angleKey) ?? [];
      angleList.push(item);
      angleGroups.set(angleKey, angleList);

      const sectionKey = formatSongSection(item.songSection);
      const sectionList = songSectionGroups.get(sectionKey) ?? [];
      sectionList.push(item);
      songSectionGroups.set(sectionKey, sectionList);

      const comboKey = `${copyLink.id} + ${formatSongSection(item.songSection)}`;
      const comboGroup = comboGroups.get(comboKey) ?? { key: comboKey, copyEntry: copyLink, songSection: formatSongSection(item.songSection), items: [] };
      comboGroup.items.push(item);
      comboGroups.set(comboKey, comboGroup);
    } else {
      angleGroups.get("Unlinked")!.push(item);
      songSectionGroups.get("Unlinked")!.push(item);
      comboGroups.get("Unlinked")!.items.push(item);

      const adList = unlinkedAdsMap.get(normName) ?? [];
      adList.push(item);
      unlinkedAdsMap.set(normName, adList);
    }
  }

  function aggregateRow(
    label: string,
    copyEntryId: string | null,
    items: ReportWithData[],
    copyAngle?: string,
    hook?: string,
    caption?: string
  ): CopyPerformanceRow {
    const activeBatchIds = Array.from(new Set(items.map((it) => it.batch.id)));
    const activeBatches = sortBatchesByTimeline(
      activeBatchIds.map((id) => batches.find((b) => b.id === id)!)
    );
    const isSpendOverlapping = adBatchesHaveOverlap(activeBatches);
    const itemsByBatch = new Map<string, ReportWithData[]>();
    for (const item of items) {
      const list = itemsByBatch.get(item.batch.id) ?? [];
      list.push(item);
      itemsByBatch.set(item.batch.id, list);
    }

    const latestBatch = activeBatches[activeBatches.length - 1];
    const metricItems = isSpendOverlapping && latestBatch
      ? (itemsByBatch.get(latestBatch.id) ?? [])
      : items;
    const metricBasis: CopyPerformanceRow["metricBasis"] = isSpendOverlapping
      ? "latest_snapshot"
      : "combined_total";
    const totalSpend = sum(metricItems.map((it) => it.report.spend));
    const totalResults = sum(metricItems.map((it) => it.report.results));
    const totalImpressions = sum(metricItems.map((it) => it.report.impressions));
    const totalLinkClicks = sum(metricItems.map((it) => it.report.linkClicks));
    const totalLandingPageViews = sum(metricItems.map((it) => it.report.landingPageViews));
    const totalOutbound = sum(metricItems.map((it) => it.outboundStreamingClicks));

    const backgroundReports = isSpendOverlapping && latestBatch
      ? latestBatch.reports
      : activeBatches.flatMap((b) => b.reports);
    const bgResults = sum(backgroundReports.map((r) => r.results));
    const bgImpressions = sum(backgroundReports.map((r) => r.impressions));
    const bgLinkClicks = sum(backgroundReports.map((r) => r.linkClicks));

    const confidence = calculateConfidenceSignal({
      spend: totalSpend,
      impressions: totalImpressions,
      results: totalResults,
      linkClicks: totalLinkClicks,
      batchTotalResults: bgResults,
      batchTotalImpressions: bgImpressions,
      batchTotalLinkClicks: bgLinkClicks
    });

    return {
      label,
      copyEntryId,
      copyAngle,
      hook,
      caption,
      spend: totalSpend,
      isSpendOverlapping,
      metricBasis,
      results: totalResults,
      cpr: cost(totalSpend, totalResults),
      linkClicks: totalLinkClicks,
      landingPageViews: totalLandingPageViews,
      outboundStreamingClicks: totalOutbound,
      batchCount: activeBatchIds.length,
      confidenceScore: confidence.score,
      confidenceType: confidence.type
    };
  }

  const copyPairs: CopyPerformanceRow[] = [];
  for (const grp of pairGroups.values()) {
    copyPairs.push(
      aggregateRow(
        grp.copyEntry.hook,
        grp.copyEntry.id,
        grp.items,
        formatHookType(grp.copyEntry.hookType),
        grp.copyEntry.hook,
        grp.copyEntry.caption
      )
    );
  }
  copyPairs.sort((a, b) => b.spend - a.spend);

  const copyAngles: CopyPerformanceRow[] = [];
  for (const [angle, items] of angleGroups.entries()) {
    if (angle === "Unlinked" && items.length === 0) continue;
    copyAngles.push(aggregateRow(angle, null, items, angle));
  }
  copyAngles.sort((a, b) => b.spend - a.spend);

  const songSections: CopyPerformanceRow[] = [];
  for (const [section, items] of songSectionGroups.entries()) {
    if (section === "Unlinked" && items.length === 0) continue;
    songSections.push(aggregateRow(section, null, items));
  }
  songSections.sort((a, b) => b.spend - a.spend);

  const combos: CopyPerformanceRow[] = [];
  for (const grp of comboGroups.values()) {
    if (grp.key === "Unlinked" && grp.items.length === 0) continue;
    const label = grp.key === "Unlinked" ? "Unlinked" : `${grp.copyEntry!.hook} + ${grp.songSection}`;
    combos.push(
      aggregateRow(
        label,
        grp.copyEntry?.id ?? null,
        grp.items,
        grp.copyEntry ? formatHookType(grp.copyEntry.hookType) : undefined
      )
    );
  }
  combos.sort((a, b) => b.spend - a.spend);

  const unlinkedAds: UnlinkedAdSummaryRow[] = [];
  for (const [adName, items] of unlinkedAdsMap.entries()) {
    const activeBatchIds = Array.from(new Set(items.map((it) => it.batch.id)));
    const activeBatches = sortBatchesByTimeline(
      activeBatchIds.map((id) => batches.find((b) => b.id === id)!)
    );
    const isSpendOverlapping = adBatchesHaveOverlap(activeBatches);
    const latestBatch = activeBatches[activeBatches.length - 1];
    const metricItems = isSpendOverlapping && latestBatch
      ? items.filter((item) => item.batch.id === latestBatch.id)
      : items;
    const totalSpend = sum(metricItems.map((it) => it.report.spend));
    const totalResults = sum(metricItems.map((it) => it.report.results));
    const totalLinkClicks = sum(metricItems.map((it) => it.report.linkClicks));
    const totalLandingPageViews = sum(metricItems.map((it) => it.report.landingPageViews));

    unlinkedAds.push({
      adName,
      spend: totalSpend,
      isSpendOverlapping,
      metricBasis: isSpendOverlapping ? "latest_snapshot" : "combined_total",
      results: totalResults,
      cpr: cost(totalSpend, totalResults),
      linkClicks: totalLinkClicks,
      landingPageViews: totalLandingPageViews,
      batchCount: activeBatchIds.length
    });
  }
  unlinkedAds.sort((a, b) => b.spend - a.spend);

  function findEfficiencyWinner(rows: CopyPerformanceRow[]): CopyPerformanceMemoryWinner | null {
    const validRows = rows.filter(
      (r) => r.label !== "Unlinked" && r.spend >= 10 && r.results >= 5 && r.cpr !== null
    );
    if (validRows.length === 0) return null;
    const winner = [...validRows].sort((a, b) => a.cpr! - b.cpr!)[0];
    return {
      label: winner.label,
      cpr: winner.cpr,
      results: winner.results,
      warning: winner.isSpendOverlapping ? "Rolling snapshot: latest batch only" : undefined
    };
  }

  function findVolumeWinner(rows: CopyPerformanceRow[]): CopyPerformanceMemoryWinner | null {
    const validRows = rows.filter((r) => r.label !== "Unlinked" && r.spend >= 10);
    if (validRows.length === 0) return null;
    const winner = [...validRows].sort((a, b) => b.results - a.results)[0];
    return {
      label: winner.label,
      cpr: winner.cpr,
      results: winner.results,
      warning: winner.isSpendOverlapping ? "Rolling snapshot: latest batch only" : undefined
    };
  }

  const bestCopyPair = findEfficiencyWinner(copyPairs);
  const bestAngle = findEfficiencyWinner(copyAngles);
  const bestCombo = findEfficiencyWinner(combos);
  const volumeWinner = findVolumeWinner(copyPairs);

  const creativeMemory = await readCreativePerformanceMemory(releaseId);
  const suggestions = calculateReleaseComboSuggestions(
    creativeMemory,
    {
      coverage,
      copyPairs,
      copyAngles,
      songSections,
      combos,
      unlinkedAds,
      hasOverlappingSnapshots,
      winners: {
        bestCopyPair,
        bestAngle,
        bestCombo,
        volumeWinner
      }
    },
    reportRecords
  );

  return {
    coverage,
    copyPairs,
    copyAngles,
    songSections,
    combos,
    unlinkedAds,
    hasOverlappingSnapshots,
    winners: {
      bestCopyPair,
      bestAngle,
      bestCombo,
      volumeWinner
    },
    suggestions
  };
}

export async function readReleaseAdReports(releaseId: string): Promise<any[]> {
  const reports = await prisma.adCreativeReport.findMany({
    where: {
      importBatch: {
        releaseId
      }
    },
    include: {
      copyLinks: {
        include: {
          copyEntry: true
        }
      }
    }
  });
  await resolveEffectiveCopyLinksForRelease(releaseId, reports);
  return reports;
}
