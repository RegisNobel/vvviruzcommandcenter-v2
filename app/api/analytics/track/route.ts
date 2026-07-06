export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {recordPublicAnalyticsEvent} from "@/lib/repositories/analytics";
import {sendMetaConversionsApiEvent} from "@/lib/server/meta-conversions-api";
import {createId} from "@/lib/utils";

const analyticsEventSchema = z.object({
  eventType: z.enum([
    "links_page_view",
    "links_link_click",
    "vault_page_view",
    "vault_cta_click",
    "playlist_page_view",
    "playlist_track_click",
    "playlist_follow_click"
  ]),
  page: z.enum(["links", "vault", "playlist"]),
  path: z.string().default(""),
  hubPath: z.string().default(""),
  releaseId: z.string().nullish(),
  linkType: z.string().default(""),
  linkLabel: z.string().default(""),
  targetUrl: z.string().default(""),
  utmSource: z.string().default(""),
  utmMedium: z.string().default(""),
  utmCampaign: z.string().default(""),
  utmContent: z.string().default(""),
  utmTerm: z.string().default(""),
  metaEventId: z.string().max(200).default(""),
  metaEventName: z.enum(["ViewContent", "Lead"]).optional(),
  releaseTitle: z.string().default("")
}).superRefine((event, ctx) => {
  const isLinksEvent =
    event.page === "links" &&
    (event.eventType === "links_page_view" || event.eventType === "links_link_click");
  const isVaultEvent =
    event.page === "vault" &&
    (event.eventType === "vault_page_view" || event.eventType === "vault_cta_click");
  const isPlaylistEvent =
    event.page === "playlist" &&
    (event.eventType === "playlist_page_view" ||
     event.eventType === "playlist_track_click" ||
     event.eventType === "playlist_follow_click");

  if (!isLinksEvent && !isVaultEvent && !isPlaylistEvent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unsupported analytics event for page."
    });
  }
});

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return "";
  }

  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

function createTrackingCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    ""
  );
}

function toEventSourceUrl(request: Request, path: string) {
  const siteOrigin =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    new URL(request.url).origin;

  try {
    return new URL(path || request.url, siteOrigin).toString();
  } catch {
    return request.url;
  }
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const visitorId = readCookieValue(cookieHeader, "vcc_visitor_id") || createId();
  const sessionId = readCookieValue(cookieHeader, "vcc_session_id") || createId();

  try {
    const parsed = analyticsEventSchema.parse(await request.json());

    await recordPublicAnalyticsEvent({
      ...parsed,
      releaseId: parsed.releaseId ?? null,
      referrer: request.headers.get("referer") || "",
      userAgent: request.headers.get("user-agent") || "",
      visitorId,
      sessionId,
      country: request.headers.get("x-vercel-ip-country") || ""
    });

    if (parsed.page === "links" && parsed.metaEventName && parsed.metaEventId) {
      await sendMetaConversionsApiEvent({
        eventId: parsed.metaEventId,
        eventName: parsed.metaEventName,
        eventSourceUrl: toEventSourceUrl(request, parsed.path),
        clientIpAddress: getClientIpAddress(request),
        clientUserAgent: request.headers.get("user-agent") || "",
        fbc: readCookieValue(cookieHeader, "_fbc"),
        fbp: readCookieValue(cookieHeader, "_fbp"),
        linkLabel: parsed.linkLabel,
        linkType: parsed.linkType,
        releaseId: parsed.releaseId ?? null,
        releaseTitle: parsed.releaseTitle,
        targetUrl: parsed.targetUrl,
        utmCampaign: parsed.utmCampaign,
        utmContent: parsed.utmContent,
        utmMedium: parsed.utmMedium,
        utmSource: parsed.utmSource,
        utmTerm: parsed.utmTerm,
        visitorId
      });
    }

    const response = NextResponse.json({ok: true});

    response.headers.append(
      "Set-Cookie",
      createTrackingCookie("vcc_visitor_id", visitorId, 60 * 60 * 24 * 365)
    );
    response.headers.append(
      "Set-Cookie",
      createTrackingCookie("vcc_session_id", sessionId, 60 * 30)
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({message: "Invalid analytics event."}, {status: 400});
    }

    return NextResponse.json({message: "Analytics event was not saved."}, {status: 500});
  }
}
