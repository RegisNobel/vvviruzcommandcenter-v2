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
  spend: number;
  streamingClicks: number;
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
  streamingClicks: number;
  viewToStreamRate: number | null;
}) {
  if (!input.hasAdsData) {
    return "Import the latest Meta CSV export so spend, CTR, CPC, and creative winners can be read beside link-hub behavior.";
  }

  if (input.linksViews === 0) {
    return "Verify the campaign URL points to /links with UTMs before judging ad quality.";
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
  const spend = adMetrics.total_spend;
  const clickToViewRate = ratio(linksViews, metaClicks);
  const viewToStreamRate = ratio(streamingClickCount, linksViews);
  const clickToStreamRate = ratio(streamingClickCount, metaClicks);
  const costPerStreamingClick = cost(spend, streamingClickCount);
  const topPlatforms = toTopCounters(platformCounts);
  const topSources = toTopCounters(sourceCounts);
  const topUtms = toTopCounters(utmCounts);
  const topLinks = toTopCounters(linkCounts);

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
      links_page_views: linksViews,
      streaming_clicks: streamingClickCount,
      click_to_view_rate: clickToViewRate,
      view_to_stream_rate: viewToStreamRate,
      meta_click_to_stream_rate: clickToStreamRate,
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
      spend,
      streamingClicks: streamingClickCount,
      viewToStreamRate
    }),
    recommended_next_move: createRecommendedMove({
      bestAdName: adMetrics.best_ad?.ad_name,
      bestHookLabel: adMetrics.best_hook?.label,
      hasAdsData: adMetrics.has_data,
      linksViews,
      streamingClicks: streamingClickCount,
      viewToStreamRate
    }),
    daily_trend: Array.from(dailyBuckets.values()).reverse(),
    breakdowns: {
      platforms: topPlatforms,
      sources: topSources,
      links: topLinks,
      utms: topUtms
    }
  };
}
