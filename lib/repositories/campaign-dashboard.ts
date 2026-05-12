import {prisma} from "@/lib/db/prisma";
import {toDateInputValue} from "@/lib/db/serialization";
import {readReleaseAdMetrics} from "@/lib/repositories/ads";
import {readSiteSettings} from "@/lib/repositories/site-settings";

const streamingLinkTypes = new Set(["apple-music", "spotify", "youtube-music", "youtube-video"]);

type CampaignDashboardInput = {
  releaseId?: string;
  days?: number;
};

type Counter = {
  label: string;
  value: number;
};

type AttributionEventCounts = {
  appleMusicClicks: number;
  linksPageViews: number;
  spotifyClicks: number;
  streamingClicks: number;
  utmCampaign: string;
  utmContent: string;
  youtubeClicks: number;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function cost(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 100) / 100;
}

function increment(map: Map<string, number>, label: string) {
  const normalizedLabel = label.trim() || "Unknown";

  map.set(normalizedLabel, (map.get(normalizedLabel) ?? 0) + 1);
}

function toTopCounters(map: Map<string, number>, limit = 5): Counter[] {
  return Array.from(map.entries())
    .map(([label, value]) => ({label, value}))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function createEmptyAttributionEventCounts(utmCampaign: string, utmContent: string): AttributionEventCounts {
  return {
    appleMusicClicks: 0,
    linksPageViews: 0,
    spotifyClicks: 0,
    streamingClicks: 0,
    utmCampaign,
    utmContent,
    youtubeClicks: 0
  };
}

function createAttributionKey(utmCampaign: string, utmContent: string) {
  return `${utmCampaign.trim().toLowerCase()}|${utmContent.trim().toLowerCase()}`;
}

function createAttributionLabel({
  adName,
  utmCampaign,
  utmContent
}: {
  adName: string;
  utmCampaign: string;
  utmContent: string;
}) {
  if (utmContent.trim()) {
    return utmCampaign.trim()
      ? `${utmCampaign.trim()} / ${utmContent.trim()}`
      : utmContent.trim();
  }

  return adName.trim() || "No UTM content";
}

function getSourceLabel(event: {referrer: string; utmMedium: string; utmSource: string}) {
  if (event.utmSource.trim()) {
    return event.utmMedium.trim()
      ? `${event.utmSource.trim()} / ${event.utmMedium.trim()}`
      : event.utmSource.trim();
  }

  try {
    const host = new URL(event.referrer).hostname.replace(/^www\./, "");

    return host || "Direct / Unknown";
  } catch {
    return "Direct / Unknown";
  }
}

function getUtmLabel(event: {utmCampaign: string; utmContent: string; utmSource: string}) {
  const parts = [
    event.utmSource && `source=${event.utmSource}`,
    event.utmCampaign && `campaign=${event.utmCampaign}`,
    event.utmContent && `content=${event.utmContent}`
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "No UTM";
}

function getLinkLabel(event: {linkLabel: string; linkType: string; targetUrl: string}) {
  if (event.linkLabel.trim()) {
    return event.linkLabel.trim();
  }

  if (event.linkType.trim()) {
    return event.linkType.trim();
  }

  try {
    return new URL(event.targetUrl).hostname.replace(/^www\./, "") || "Unknown link";
  } catch {
    return "Unknown link";
  }
}

function createDailyBuckets(days: number) {
  const now = new Date();
  const buckets = new Map<string, {date: string; streamingClicks: number; views: number}>();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = toDateKey(date);

    buckets.set(key, {
      date: key,
      streamingClicks: 0,
      views: 0
    });
  }

  return buckets;
}

function createProblemSignals(input: {
  hasAdsData: boolean;
  linksViews: number;
  metaClicks: number;
  metaLandingPageViews: number;
  spend: number;
  streamingClicks: number;
  trackedViewCoverageRate: number | null;
  utmCoverageRate: number | null;
  viewToStreamRate: number | null;
}) {
  const signals: Array<{severity: "good" | "risk" | "warning"; text: string}> = [];

  if (!input.hasAdsData) {
    signals.push({
      severity: "warning",
      text: "No Meta CSV data is attached to this release yet."
    });
  }

  if (input.metaClicks > 0 && input.linksViews === 0) {
    signals.push({
      severity: "warning",
      text: "Meta has link clicks, but the link hub has no matching page views."
    });
  }

  if (
    input.metaLandingPageViews >= 20 &&
    (input.trackedViewCoverageRate ?? 0) > 0 &&
    (input.trackedViewCoverageRate ?? 0) < 60
  ) {
    signals.push({
      severity: "risk",
      text: "Meta landing page views are materially higher than first-party /links views. Expect some privacy loss, but check URL consistency, page load, and tracker firing."
    });
  }

  if (input.linksViews >= 20 && (input.utmCoverageRate ?? 0) < 80) {
    signals.push({
      severity: "risk",
      text: "A meaningful share of /links views are missing campaign/content UTM data, which weakens ad-level attribution."
    });
  }

  if (input.metaClicks >= 20 && input.linksViews > 0 && (ratio(input.linksViews, input.metaClicks) ?? 0) < 50) {
    signals.push({
      severity: "risk",
      text: "Click-to-view match is weak. Check UTMs, load speed, and landing URL consistency."
    });
  }

  if (input.linksViews >= 20 && (input.viewToStreamRate ?? 0) < 15) {
    signals.push({
      severity: "risk",
      text: "Link-page visitors are not clicking through to streaming platforms at a strong rate."
    });
  }

  if (input.spend >= 20 && input.streamingClicks === 0) {
    signals.push({
      severity: "warning",
      text: "Spend is active, but no streaming-platform clicks are recorded for this release."
    });
  }

  if (signals.length === 0) {
    signals.push({
      severity: "good",
      text: "No major tracking or funnel issues detected for this release."
    });
  }

  return signals;
}

function createRecommendedMove(input: {
  bestAdName?: string | null;
  bestHookLabel?: string | null;
  hasAdsData: boolean;
  linksViews: number;
  metaLandingPageViews: number;
  streamingClicks: number;
  trackedViewCoverageRate: number | null;
  viewToStreamRate: number | null;
}) {
  if (!input.hasAdsData) {
    return "Import the latest Meta CSV export so spend, CTR, CPC, and creative winners can be read beside link-hub behavior.";
  }

  if (input.linksViews === 0) {
    return "Verify the campaign URL points to /links with UTMs before judging ad quality.";
  }

  if (
    input.metaLandingPageViews >= 20 &&
    (input.trackedViewCoverageRate ?? 0) > 0 &&
    (input.trackedViewCoverageRate ?? 0) < 60
  ) {
    return "Audit the /links tracking path before making creative decisions; Meta LPV and first-party tracked views are too far apart.";
  }

  if ((input.viewToStreamRate ?? 0) >= 25 && input.bestAdName) {
    return `Scale or duplicate ${input.bestAdName}; it has enough follow-through to deserve another test.`;
  }

  if (input.streamingClicks === 0) {
    return "Do not scale yet. Fix link-page offer clarity or platform button placement before increasing spend.";
  }

  if (input.bestHookLabel) {
    return `Make the next creative around ${input.bestHookLabel}; it is the strongest tagged hook signal right now.`;
  }

  return "Keep collecting traffic, then link top ads to Copy Lab entries so strategy winners become clearer.";
}

export async function readCampaignCommandDashboard(input: CampaignDashboardInput = {}) {
  const safeDays = Math.min(Math.max(input.days ?? 30, 7), 120);
  const startDate = startOfUtcDay(
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - safeDays + 1))
  );
  const [releases, analyticsCounts, siteSettings] = await Promise.all([
    prisma.release.findMany({
      orderBy: [
        {
          releaseDate: {
            sort: "desc",
            nulls: "last"
          }
        },
        {
          updatedOn: "desc"
        }
      ],
      select: {
        id: true,
        title: true,
        releaseDate: true,
        type: true,
        updatedOn: true,
        _count: {
          select: {
            adImportBatches: true
          }
        }
      }
    }),
    prisma.analyticsEvent.groupBy({
      by: ["releaseId"],
      where: {
        page: "links",
        releaseId: {
          not: null
        }
      },
      _count: {
        _all: true
      }
    }),
    readSiteSettings()
  ]);
  const analyticsCountByReleaseId = new Map(
    analyticsCounts
      .filter((item) => item.releaseId)
      .map((item) => [item.releaseId as string, item._count._all])
  );
  const preferredReleaseId = input.releaseId?.trim();
  const settingsReleaseId = siteSettings.site_content.links.selected_release_id?.trim() ?? "";
  const selectedRelease =
    releases.find((release) => release.id === preferredReleaseId) ??
    releases.find((release) => release.id === settingsReleaseId) ??
    releases.find(
      (release) =>
        release._count.adImportBatches > 0 || (analyticsCountByReleaseId.get(release.id) ?? 0) > 0
    ) ??
    releases[0] ??
    null;

  const releaseOptions = releases.map((release) => ({
    id: release.id,
    title: release.title,
    type: release.type,
    release_date: toDateInputValue(release.releaseDate),
    ad_batch_count: release._count.adImportBatches,
    analytics_event_count: analyticsCountByReleaseId.get(release.id) ?? 0
  }));

  if (!selectedRelease) {
    return {
      days: safeDays,
      release_options: releaseOptions,
      selected_release: null,
      updated_at: new Date().toISOString()
    };
  }

  const [adMetrics, analyticsEvents] = await Promise.all([
    readReleaseAdMetrics(selectedRelease.id),
    prisma.analyticsEvent.findMany({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        page: "links",
        releaseId: selectedRelease.id,
        createdAt: {
          gte: startDate
        }
      }
    })
  ]);
  const views = analyticsEvents.filter((event) => event.eventType === "links_page_view");
  const allClicks = analyticsEvents.filter((event) => event.eventType === "links_link_click");
  const streamingClicks = allClicks.filter((event) => streamingLinkTypes.has(event.linkType));
  const dailyBuckets = createDailyBuckets(Math.min(safeDays, 14));
  const platformCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const utmCounts = new Map<string, number>();
  const linkCounts = new Map<string, number>();
  const attributionEventCounts = new Map<string, AttributionEventCounts>();
  const viewsWithUtm = views.filter((event) => event.utmCampaign || event.utmContent).length;

  for (const event of analyticsEvents) {
    const key = toDateKey(event.createdAt);
    const bucket = dailyBuckets.get(key);

    if (bucket) {
      if (event.eventType === "links_page_view") {
        bucket.views += 1;
      }

      if (event.eventType === "links_link_click" && streamingLinkTypes.has(event.linkType)) {
        bucket.streamingClicks += 1;
      }
    }

    increment(sourceCounts, getSourceLabel(event));
    increment(utmCounts, getUtmLabel(event));

    if (event.utmCampaign || event.utmContent) {
      const attributionKey = createAttributionKey(event.utmCampaign, event.utmContent);
      const current =
        attributionEventCounts.get(attributionKey) ??
        createEmptyAttributionEventCounts(event.utmCampaign, event.utmContent);

      if (event.eventType === "links_page_view") {
        current.linksPageViews += 1;
      }

      if (event.eventType === "links_link_click" && streamingLinkTypes.has(event.linkType)) {
        current.streamingClicks += 1;

        if (event.linkType === "spotify") {
          current.spotifyClicks += 1;
        } else if (event.linkType === "apple-music") {
          current.appleMusicClicks += 1;
        } else if (event.linkType === "youtube-music" || event.linkType === "youtube-video") {
          current.youtubeClicks += 1;
        }
      }

      attributionEventCounts.set(attributionKey, current);
    }

    if (event.eventType === "links_link_click") {
      increment(linkCounts, getLinkLabel(event));

      if (streamingLinkTypes.has(event.linkType)) {
        increment(platformCounts, event.linkLabel || event.linkType);
      }
    }
  }

  const linksViews = views.length;
  const streamingClickCount = streamingClicks.length;
  const metaClicks = adMetrics.total_link_clicks;
  const metaLandingPageViews = adMetrics.total_landing_page_views;
  const spend = adMetrics.total_spend;
  const clickToViewRate = ratio(linksViews, metaClicks);
  const trackedViewCoverageRate = ratio(linksViews, metaLandingPageViews);
  const lpvToStreamRate = ratio(streamingClickCount, metaLandingPageViews);
  const viewToStreamRate = ratio(streamingClickCount, linksViews);
  const clickToStreamRate = ratio(streamingClickCount, metaClicks);
  const utmCoverageRate = ratio(viewsWithUtm, linksViews);
  const costPerStreamingClick = cost(spend, streamingClickCount);
  const topPlatforms = toTopCounters(platformCounts);
  const topSources = toTopCounters(sourceCounts);
  const topUtms = toTopCounters(utmCounts);
  const topLinks = toTopCounters(linkCounts);
  const attributionBatches = await prisma.adImportBatch.findMany({
    where: {
      releaseId: selectedRelease.id
    },
    include: {
      reports: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const preferredAttributionBatch =
    attributionBatches.find((batch) => batch.batchType === "Release-to-Date" || batch.batchType === "Full Campaign") ??
    attributionBatches[0] ??
    null;
  const attributionRowsByKey = new Map<
    string,
    {
      ad_name: string;
      apple_music_clicks: number;
      cost_per_landing_page_view: number | null;
      cost_per_result: number | null;
      cost_per_streaming_click: number | null;
      click_to_lpv_rate: number | null;
      label: string;
      links_page_views: number;
      lpv_to_tracked_view_rate: number | null;
      meta_click_to_stream_rate: number | null;
      meta_landing_page_views: number;
      meta_link_clicks: number;
      results: number;
      spend: number;
      spotify_clicks: number;
      streaming_clicks: number;
      tracking_status: "matched" | "meta_only" | "first_party_only" | "missing_utm";
      utm_campaign: string;
      utm_content: string;
      view_to_stream_rate: number | null;
      youtube_clicks: number;
    }
  >();

  for (const report of preferredAttributionBatch?.reports ?? []) {
    const hasUtm = Boolean(report.utmCampaign || report.utmContent);
    const key = hasUtm
      ? createAttributionKey(report.utmCampaign ?? "", report.utmContent ?? "")
      : `missing-utm|${report.adName.trim().toLowerCase()}`;
    const current =
      attributionRowsByKey.get(key) ?? {
        ad_name: report.adName,
        apple_music_clicks: 0,
        cost_per_landing_page_view: null,
        cost_per_result: null,
        cost_per_streaming_click: null,
        click_to_lpv_rate: null,
        label: createAttributionLabel({
          adName: report.adName,
          utmCampaign: report.utmCampaign ?? "",
          utmContent: report.utmContent ?? ""
        }),
        links_page_views: 0,
        lpv_to_tracked_view_rate: null,
        meta_click_to_stream_rate: null,
        meta_landing_page_views: 0,
        meta_link_clicks: 0,
        results: 0,
        spend: 0,
        spotify_clicks: 0,
        streaming_clicks: 0,
        tracking_status: hasUtm ? "meta_only" : "missing_utm",
        utm_campaign: report.utmCampaign ?? "",
        utm_content: report.utmContent ?? "",
        view_to_stream_rate: null,
        youtube_clicks: 0
      };

    current.spend += report.spend ?? 0;
    current.meta_link_clicks += report.linkClicks ?? 0;
    current.meta_landing_page_views += report.landingPageViews ?? 0;
    current.results += report.results ?? 0;
    current.cost_per_result = cost(current.spend, current.results);
    current.cost_per_landing_page_view = cost(current.spend, current.meta_landing_page_views);
    current.click_to_lpv_rate = ratio(current.meta_landing_page_views, current.meta_link_clicks);

    attributionRowsByKey.set(key, current);
  }

  for (const [key, counts] of attributionEventCounts) {
    const current =
      attributionRowsByKey.get(key) ?? {
        ad_name: "",
        apple_music_clicks: 0,
        cost_per_landing_page_view: null,
        cost_per_result: null,
        cost_per_streaming_click: null,
        click_to_lpv_rate: null,
        label: [counts.utmCampaign, counts.utmContent].filter(Boolean).join(" / ") || "First-party UTM only",
        links_page_views: 0,
        lpv_to_tracked_view_rate: null,
        meta_click_to_stream_rate: null,
        meta_landing_page_views: 0,
        meta_link_clicks: 0,
        results: 0,
        spend: 0,
        spotify_clicks: 0,
        streaming_clicks: 0,
        tracking_status: "first_party_only" as const,
        utm_campaign: counts.utmCampaign,
        utm_content: counts.utmContent,
        view_to_stream_rate: null,
        youtube_clicks: 0
      };

    current.links_page_views += counts.linksPageViews;
    current.streaming_clicks += counts.streamingClicks;
    current.spotify_clicks += counts.spotifyClicks;
    current.apple_music_clicks += counts.appleMusicClicks;
    current.youtube_clicks += counts.youtubeClicks;
    current.lpv_to_tracked_view_rate = ratio(current.links_page_views, current.meta_landing_page_views);
    current.view_to_stream_rate = ratio(current.streaming_clicks, current.links_page_views);
    current.meta_click_to_stream_rate = ratio(current.streaming_clicks, current.meta_link_clicks);
    current.cost_per_streaming_click = cost(current.spend, current.streaming_clicks);
    current.tracking_status =
      current.tracking_status === "meta_only" || current.tracking_status === "matched"
        ? "matched"
        : current.tracking_status;

    attributionRowsByKey.set(key, current);
  }

  const attributionRows = Array.from(attributionRowsByKey.values())
    .map((row) => ({
      ...row,
      lpv_to_tracked_view_rate: row.lpv_to_tracked_view_rate ?? ratio(row.links_page_views, row.meta_landing_page_views),
      view_to_stream_rate: row.view_to_stream_rate ?? ratio(row.streaming_clicks, row.links_page_views),
      meta_click_to_stream_rate: row.meta_click_to_stream_rate ?? ratio(row.streaming_clicks, row.meta_link_clicks),
      cost_per_streaming_click: row.cost_per_streaming_click ?? cost(row.spend, row.streaming_clicks)
    }))
    .sort((left, right) => right.spend - left.spend || right.streaming_clicks - left.streaming_clicks || left.label.localeCompare(right.label))
    .slice(0, 12);

  return {
    days: safeDays,
    release_options: releaseOptions,
    selected_release: {
      id: selectedRelease.id,
      title: selectedRelease.title,
      type: selectedRelease.type,
      release_date: toDateInputValue(selectedRelease.releaseDate)
    },
    updated_at: new Date().toISOString(),
    ad_metrics: adMetrics,
    overview: {
      spend,
      meta_link_clicks: metaClicks,
      meta_landing_page_views: metaLandingPageViews,
      links_page_views: linksViews,
      streaming_clicks: streamingClickCount,
      click_to_view_rate: clickToViewRate,
      click_to_lpv_rate: adMetrics.click_to_landing_rate,
      tracked_view_coverage_rate: trackedViewCoverageRate,
      lpv_to_stream_rate: lpvToStreamRate,
      view_to_stream_rate: viewToStreamRate,
      meta_click_to_stream_rate: clickToStreamRate,
      utm_coverage_rate: utmCoverageRate,
      cost_per_streaming_click: costPerStreamingClick
    },
    funnel: [
      {
        label: "Meta impressions",
        value: adMetrics.total_impressions
      },
      {
        label: "Meta link clicks",
        value: metaClicks
      },
      {
        label: "Meta landing views",
        value: metaLandingPageViews
      },
      {
        label: "/links views",
        value: linksViews
      },
      {
        label: "Streaming clicks",
        value: streamingClickCount
      }
    ],
    winners: {
      best_ad: adMetrics.best_ad,
      best_hook: adMetrics.best_hook,
      top_platform: topPlatforms[0] ?? null,
      top_source: topSources[0] ?? null
    },
    problem_signals: createProblemSignals({
      hasAdsData: adMetrics.has_data,
      linksViews,
      metaClicks,
      metaLandingPageViews,
      spend,
      streamingClicks: streamingClickCount,
      trackedViewCoverageRate,
      utmCoverageRate,
      viewToStreamRate
    }),
    recommended_next_move: createRecommendedMove({
      bestAdName: adMetrics.best_ad?.ad_name,
      bestHookLabel: adMetrics.best_hook?.label,
      hasAdsData: adMetrics.has_data,
      linksViews,
      metaLandingPageViews,
      streamingClicks: streamingClickCount,
      trackedViewCoverageRate,
      viewToStreamRate
    }),
    daily_trend: Array.from(dailyBuckets.values()).reverse(),
    tracking_health: {
      meta_landing_page_views: metaLandingPageViews,
      first_party_links_views: linksViews,
      tracked_view_coverage_rate: trackedViewCoverageRate,
      estimated_untracked_views: Math.max(metaLandingPageViews - linksViews, 0),
      utm_coverage_rate: utmCoverageRate,
      views_with_utm: viewsWithUtm,
      views_without_utm: Math.max(linksViews - viewsWithUtm, 0)
    },
    attribution: {
      source_batch_id: preferredAttributionBatch?.id ?? null,
      source_batch_name: preferredAttributionBatch?.name ?? "",
      source_batch_type: preferredAttributionBatch?.batchType ?? "",
      rows: attributionRows
    },
    breakdowns: {
      platforms: topPlatforms,
      sources: topSources,
      links: topLinks,
      utms: topUtms
    }
  };
}
