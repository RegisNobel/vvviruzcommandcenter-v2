import type {
  AdCampaignLearning,
  AdCreativeReport,
  AdImportBatch,
  CopyEntry,
  Release
} from "@prisma/client";

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
  ReleaseAdMetricsOverview
} from "@/lib/types";
import {createId} from "@/lib/utils";
import {
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
};

type BatchWithReports = AdImportBatch & {
  release: Pick<Release, "id" | "title"> | null;
  reports: AdReportWithLinks[];
  learnings: AdCampaignLearning[];
};

const decisionOptions = new Set<AdCampaignDecision>([
  "scale",
  "retest",
  "iterate",
  "pause",
  "archive"
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
      updated_on: copy.updatedOn.toISOString()
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
  const engagement =
    (report.postSaves ?? 0) +
    (report.postShares ?? 0) +
    (report.postComments ?? 0) +
    (report.postReactions ?? 0);

  if (
    spend >= 20 &&
    results >= 5 &&
    costPerResult !== null &&
    averages.costPerResult !== null &&
    costPerResult <= averages.costPerResult
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

  if (impressions >= 500 && ((report.thruPlays ?? 0) >= 50 || (report.video100 ?? 0) >= 10)) {
    signals.push("Attention Winner");
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
  const linkedCopy = report.copyLinks[0]?.copyEntry
    ? toCopySummary(report.copyLinks[0].copyEntry)
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
    results: report.results,
    cost_per_result: report.costPerResult,
    link_clicks: report.linkClicks,
    cpc: report.cpc,
    ctr: report.ctr,
    page_engagement: report.pageEngagement,
    post_reactions: report.postReactions,
    post_comments: report.postComments,
    post_saves: report.postSaves,
    post_shares: report.postShares,
    instagram_follows: report.instagramFollows,
    video_plays: report.videoPlays,
    three_second_plays: report.threeSecondPlays,
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
    linked_copy_count: reports.filter((report) => report.copyLinks.length > 0).length,
    spend,
    impressions,
    reach,
    results,
    link_clicks: linkClicks,
    ctr: ratio(linkClicks, impressions),
    created_at: batch.createdAt.toISOString(),
    updated_at: batch.updatedAt.toISOString()
  };
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
        cpc: null,
        ctr: null,
        thru_plays: 0,
        video_100: 0,
        report_count: 0
      };

    current.spend += report.spend ?? 0;
    current.impressions += report.impressions ?? 0;
    current.reach += report.reach ?? 0;
    current.results += report.results ?? 0;
    current.link_clicks += report.link_clicks ?? 0;
    current.thru_plays += report.thru_plays ?? 0;
    current.video_100 += report.video_100 ?? 0;
    current.report_count += 1;
    current.cpc = cost(current.spend, current.link_clicks);
    current.ctr = ratio(current.link_clicks, current.impressions);

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
  const matchableReports = reports.filter(
    (report) =>
      report.utm_source.toLowerCase() === "meta" &&
      report.utm_campaign &&
      report.utm_content
  );

  if (matchableReports.length === 0) {
    return [];
  }

  const events = await prisma.analyticsEvent.findMany({
    where: {
      page: "links",
      utmSource: "meta",
      OR: matchableReports.map((report) => ({
        utmCampaign: report.utm_campaign,
        utmContent: report.utm_content
      }))
    }
  });

  return matchableReports.map((report): AdLinkFollowThroughRecord => {
    const matchingEvents = events.filter(
      (event) =>
        event.utmCampaign === report.utm_campaign && event.utmContent === report.utm_content
    );
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

  return batch;
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
  const previousBatch = await prisma.adImportBatch.findFirst({
    where: {
      releaseId,
      createdAt: {
        lt: createdBefore
      }
    },
    include: {
      reports: {
        include: {
          copyLinks: {
            orderBy: {
              createdAt: "asc"
            },
            take: 1
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const links = new Map<string, string>();

  for (const report of previousBatch?.reports ?? []) {
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
    results: row.results,
    costPerResult: row.cost_per_result,
    linkClicks: row.link_clicks,
    cpc: row.cpc,
    ctr: row.ctr,
    pageEngagement: row.page_engagement,
    postReactions: row.post_reactions,
    postComments: row.post_comments,
    postSaves: row.post_saves,
    postShares: row.post_shares,
    instagramFollows: row.instagram_follows,
    videoPlays: row.video_plays,
    threeSecondPlays: row.three_second_plays,
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
  const availableCopies = await prisma.copyEntry.findMany({
    where: batch.releaseId
      ? {
          OR: [
            {
              releaseId: batch.releaseId
            },
            {
              releaseId: null
            }
          ]
        }
      : undefined,
    orderBy: [
      {
        releaseId: "desc"
      },
      {
        updatedOn: "desc"
      }
    ]
  });

  return {
    ...summarizeBatch(batch),
    reports,
    available_copies: availableCopies.map(toCopySummary),
    strategy_breakdowns: createStrategyBreakdowns(reports),
    link_follow_through: await createLinkFollowThrough(reports),
    learning: batch.learnings[0] ? toLearningRecord(batch.learnings[0]) : null
  };
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

const emptyReleaseAdMetrics: ReleaseAdMetricsOverview = {
  has_data: false,
  source_label: "No data",
  source_context: null,
  total_spend: 0,
  total_impressions: 0,
  total_reach: 0,
  total_results: 0,
  total_link_clicks: 0,
  total_thru_plays: null,
  total_video_100: null,
  ctr: null,
  cpc: null,
  cpr: null,
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

  const allReports = metricBatches.flatMap((batch) => batch.reports);
  const averages = createBatchAverages(allReports);
  const reportRecords = allReports.map((report) => toReportRecord(report as AdReportWithLinks, averages));

  const totalSpend = sum(allReports.map((r) => r.spend));
  const totalImpressions = sum(allReports.map((r) => r.impressions));
  const totalReach = sum(allReports.map((r) => r.reach));
  const totalResults = sum(allReports.map((r) => r.results));
  const totalLinkClicks = sum(allReports.map((r) => r.linkClicks));
  const totalThruPlays = sum(allReports.map((r) => r.thruPlays));
  const totalVideo100 = sum(allReports.map((r) => r.video100));

  const getCpr = (r: AdCreativeReportRecord) => r.cost_per_result ?? cost(r.spend ?? 0, r.results ?? 0);

  // Best ad: lowest CPR among reports with meaningful spend and results
  const qualifyingForBest = reportRecords.filter(
    (r) => (r.spend ?? 0) >= 10 && (r.results ?? 0) >= 3 && getCpr(r) !== null
  );
  const bestAdReport = qualifyingForBest.length > 0
    ? qualifyingForBest.reduce((best, current) =>
        (getCpr(current) ?? Infinity) < (getCpr(best) ?? Infinity) ? current : best
      )
    : null;

  // Worst ad: highest CPR among reports with meaningful spend, or zero results with high spend
  const qualifyingForWorst = reportRecords.filter(
    (r) => (r.spend ?? 0) >= 10
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

    if (data.spend >= 10) {
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
    total_thru_plays: totalThruPlays > 0 ? totalThruPlays : null,
    total_video_100: totalVideo100 > 0 ? totalVideo100 : null,
    ctr: ratio(totalLinkClicks, totalImpressions),
    cpc: cost(totalSpend, totalLinkClicks),
    cpr: cost(totalSpend, totalResults),
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
