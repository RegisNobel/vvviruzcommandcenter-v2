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

function toTopList(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([label, count]) => ({label, count}))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
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
  const dayBuckets = new Map<string, {date: string; views: number; conversions: number}>();
  const platformCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const targetCounts = new Map<string, number>();

  for (let offset = 0; offset < safeDays; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = toDateKey(date);

    dayBuckets.set(key, {
      date: key,
      views: 0,
      conversions: 0
    });
  }

  for (const event of events) {
    const key = toDateKey(event.createdAt);
    const bucket = dayBuckets.get(key);

    if (bucket) {
      if (event.eventType === "links_page_view") {
        bucket.views += 1;
      }

      if (event.eventType === "links_link_click") {
        bucket.conversions += 1;
      }
    }

    if (event.eventType === "links_link_click") {
      pushCounter(platformCounts, event.linkLabel || event.linkType);
      pushCounter(targetCounts, event.targetUrl || event.linkLabel || event.linkType);
    }

    if (event.referrer) {
      pushCounter(referrerCounts, event.referrer);
    }

    pushCounter(sourceCounts, event.utmSource || event.utmMedium || "Direct / Unknown");
  }

  const daily = Array.from(dayBuckets.values()).map((bucket) => ({
    ...bucket,
    ctr: getCtr(bucket.views, bucket.conversions)
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
    sources: toTopList(sourceCounts)
  };
}

export async function getAnalyticsCookieIds() {
  const cookieStore = await cookies();

  return {
    visitorId: cookieStore.get("vcc_visitor_id")?.value || createId(),
    sessionId: cookieStore.get("vcc_session_id")?.value || createId()
  };
}
