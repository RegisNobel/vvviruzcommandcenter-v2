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
  CopySummary
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
