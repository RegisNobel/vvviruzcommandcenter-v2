import {cookies} from "next/headers";

import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";

export type PublicAnalyticsEventInput = {
  eventType: "links_page_view" | "links_link_click";
  page: "links";
  path?: string;
  releaseId?: string | null;
  linkType?: string;
  linkLabel?: string;
  targetUrl?: string;
  referrer?: string;
  userAgent?: string;
  visitorId?: string;
  sessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  country?: string;
};

export type AnalyticsBreakdownKind = "country" | "source" | "link" | "utm";

export type AnalyticsBreakdownItem = {
  label: string;
  views: number;
  conversions: number;
  ctr: number;
};

export type LinkPageAnalyticsSummary = Awaited<ReturnType<typeof readLinkPageAnalytics>>;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCtr(views: number, conversions: number) {
  if (views <= 0) {
    return 0;
  }

  return Math.round((conversions / views) * 1000) / 10;
}

function normalize(value: string | null | undefined) {
  return value?.trim().slice(0, 500) || "";
}

export async function recordPublicAnalyticsEvent(input: PublicAnalyticsEventInput) {
  return prisma.analyticsEvent.create({
    data: {
      id: createId(),
      eventType: input.eventType,
      page: input.page,
      path: normalize(input.path),
      releaseId: normalize(input.releaseId) || null,
      linkType: normalize(input.linkType),
      linkLabel: normalize(input.linkLabel),
      targetUrl: normalize(input.targetUrl),
      referrer: normalize(input.referrer),
      userAgent: normalize(input.userAgent),
      visitorId: normalize(input.visitorId),
      sessionId: normalize(input.sessionId),
      utmSource: normalize(input.utmSource),
      utmMedium: normalize(input.utmMedium),
      utmCampaign: normalize(input.utmCampaign),
      utmContent: normalize(input.utmContent),
      utmTerm: normalize(input.utmTerm),
      country: normalize(input.country),
      createdAt: new Date()
    }
  });
}

function countUnique(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function pushCounter(map: Map<string, number>, key: string) {
  const normalizedKey = key.trim() || "Direct / Unknown";

  map.set(normalizedKey, (map.get(normalizedKey) ?? 0) + 1);
}

function pushBreakdownMetric(
  map: Map<string, {views: number; conversions: number}>,
  key: string,
  eventType: string
) {
  const normalizedKey = key.trim() || "Direct / Unknown";
  const current = map.get(normalizedKey) ?? {views: 0, conversions: 0};

  if (eventType === "links_page_view") {
    current.views += 1;
  }

  if (eventType === "links_link_click") {
    current.conversions += 1;
  }

  map.set(normalizedKey, current);
}

function toTopList(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([label, count]) => ({label, count}))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function toBreakdownList(
  map: Map<string, {views: number; conversions: number}>,
  limit = 8
): AnalyticsBreakdownItem[] {
  return Array.from(map.entries())
    .map(([label, counts]) => ({
      label,
      views: counts.views,
      conversions: counts.conversions,
      ctr: getCtr(counts.views, counts.conversions)
    }))
    .sort(
      (left, right) =>
        right.conversions - left.conversions ||
        right.views - left.views ||
        left.label.localeCompare(right.label)
    )
    .slice(0, limit);
}

function toHost(value: string) {
  try {
    const url = new URL(value);

    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getSourceLabel(event: {
  referrer: string;
  utmSource: string;
  utmMedium: string;
}) {
  if (event.utmSource.trim()) {
    return event.utmMedium.trim()
      ? `${event.utmSource.trim()} / ${event.utmMedium.trim()}`
      : event.utmSource.trim();
  }

  return toHost(event.referrer) || "Direct / Unknown";
}

function getUtmLabel(event: {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}) {
  const parts = [
    event.utmSource && `source=${event.utmSource}`,
    event.utmMedium && `medium=${event.utmMedium}`,
    event.utmCampaign && `campaign=${event.utmCampaign}`,
    event.utmContent && `content=${event.utmContent}`,
    event.utmTerm && `term=${event.utmTerm}`
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "No UTM";
}

function getCountryLabel(country: string) {
  return country.trim().toUpperCase() || "Unknown country";
}

function getLinkLabel(event: {
  linkLabel: string;
  linkType: string;
  targetUrl: string;
}) {
  return event.linkLabel.trim() || event.linkType.trim() || toHost(event.targetUrl) || "Unknown link";
}

function createBreakdownMaps() {
  return {
    country: new Map<string, {views: number; conversions: number}>(),
    source: new Map<string, {views: number; conversions: number}>(),
    link: new Map<string, {views: number; conversions: number}>(),
    utm: new Map<string, {views: number; conversions: number}>()
  };
}

export async function readLinkPageAnalytics(days = 30) {
  const safeDays = Math.min(Math.max(days, 1), 120);
  const now = new Date();
  const startDate = startOfUtcDay(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - safeDays + 1))
  );
  const events = await prisma.analyticsEvent.findMany({
    where: {
      page: "links",
      createdAt: {
        gte: startDate
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const views = events.filter((event) => event.eventType === "links_page_view");
  const conversions = events.filter((event) => event.eventType === "links_link_click");
  const dayBuckets = new Map<
    string,
    {
      date: string;
      views: number;
      conversions: number;
      breakdownMaps: ReturnType<typeof createBreakdownMaps>;
    }
  >();
  const platformCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const targetCounts = new Map<string, number>();
  const countryBreakdowns = new Map<string, {views: number; conversions: number}>();
  const sourceBreakdowns = new Map<string, {views: number; conversions: number}>();
  const linkBreakdowns = new Map<string, {views: number; conversions: number}>();
  const utmBreakdowns = new Map<string, {views: number; conversions: number}>();

  for (let offset = 0; offset < safeDays; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = toDateKey(date);

    dayBuckets.set(key, {
      date: key,
      views: 0,
      conversions: 0,
      breakdownMaps: createBreakdownMaps()
    });
  }

  for (const event of events) {
    const key = toDateKey(event.createdAt);
    const bucket = dayBuckets.get(key);
    const sourceLabel = getSourceLabel(event);
    const countryLabel = getCountryLabel(event.country);
    const utmLabel = getUtmLabel(event);
    const linkLabel = getLinkLabel(event);

    if (bucket) {
      if (event.eventType === "links_page_view") {
        bucket.views += 1;
      }

      if (event.eventType === "links_link_click") {
        bucket.conversions += 1;
      }

      pushBreakdownMetric(bucket.breakdownMaps.country, countryLabel, event.eventType);
      pushBreakdownMetric(bucket.breakdownMaps.source, sourceLabel, event.eventType);
      pushBreakdownMetric(bucket.breakdownMaps.utm, utmLabel, event.eventType);

      if (event.eventType === "links_link_click") {
        pushBreakdownMetric(bucket.breakdownMaps.link, linkLabel, event.eventType);
      }
    }

    if (event.eventType === "links_link_click") {
      pushCounter(platformCounts, event.linkLabel || event.linkType);
      pushCounter(targetCounts, event.targetUrl || event.linkLabel || event.linkType);
      pushBreakdownMetric(linkBreakdowns, linkLabel, event.eventType);
    }

    if (event.referrer) {
      pushCounter(referrerCounts, event.referrer);
    }

    pushCounter(sourceCounts, sourceLabel);
    pushBreakdownMetric(countryBreakdowns, countryLabel, event.eventType);
    pushBreakdownMetric(sourceBreakdowns, sourceLabel, event.eventType);
    pushBreakdownMetric(utmBreakdowns, utmLabel, event.eventType);
  }

  const daily = Array.from(dayBuckets.values()).map((bucket) => ({
    date: bucket.date,
    views: bucket.views,
    conversions: bucket.conversions,
    ctr: getCtr(bucket.views, bucket.conversions),
    breakdowns: {
      country: toBreakdownList(bucket.breakdownMaps.country),
      source: toBreakdownList(bucket.breakdownMaps.source),
      link: toBreakdownList(bucket.breakdownMaps.link).map((item) => ({
        ...item,
        views: bucket.views,
        ctr: getCtr(bucket.views, item.conversions)
      })),
      utm: toBreakdownList(bucket.breakdownMaps.utm)
    }
  }));
  const uniqueVisitors = countUnique(views.map((event) => event.visitorId));
  const uniqueConverters = countUnique(conversions.map((event) => event.visitorId));

  return {
    updatedAt: new Date().toISOString(),
    days: safeDays,
    overview: {
      views: views.length,
      conversions: conversions.length,
      ctr: getCtr(views.length, conversions.length),
      uniqueVisitors,
      uniqueConverters
    },
    daily,
    platforms: toTopList(platformCounts),
    topTargets: toTopList(targetCounts),
    referrers: toTopList(referrerCounts),
    sources: toTopList(sourceCounts),
    breakdowns: {
      country: toBreakdownList(countryBreakdowns),
      source: toBreakdownList(sourceBreakdowns),
      link: toBreakdownList(linkBreakdowns).map((item) => ({
        ...item,
        views: views.length,
        ctr: getCtr(views.length, item.conversions)
      })),
      utm: toBreakdownList(utmBreakdowns)
    }
  };
}

export async function getAnalyticsCookieIds() {
  const cookieStore = await cookies();

  return {
    visitorId: cookieStore.get("vcc_visitor_id")?.value || createId(),
    sessionId: cookieStore.get("vcc_session_id")?.value || createId()
  };
}
