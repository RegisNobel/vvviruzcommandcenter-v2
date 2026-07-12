export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {recordPublicAnalyticsEvent} from "@/lib/repositories/analytics";
import {prisma} from "@/lib/db/prisma";
import {sendMetaConversionsApiEvent} from "@/lib/server/meta-conversions-api";
import {verifyShortLinkAttributionToken} from "@/lib/server/short-link-attribution";
import {consumeRateLimit, getClientIpAddress as getRateLimitIp} from "@/lib/public-rate-limit";
import {createId} from "@/lib/utils";

const analyticsEventSchema = z.object({
  eventType: z.enum([
    "links_page_view",
    "links_link_click",
    "vault_page_view",
    "vault_cta_click",
    "playlist_page_view",
    "playlist_track_click",
    "playlist_follow_click",
    "preview_player_impression",
    "preview_play",
    "preview_pause",
    "preview_next",
    "preview_previous",
    "preview_milestone",
    "preview_complete",
    "preview_error",
    "preview_exclusives_cta",
    "exclusive_unlock_success",
    "exclusive_unlock_existing_subscriber",
    "exclusive_embed_impression",
    "exclusive_youtube_play",
    "exclusive_youtube_pause",
    "exclusive_youtube_video_change",
    "exclusive_youtube_complete",
    "exclusive_youtube_error",
    "exclusive_open_in_youtube",
    "exclusive_subscribe_youtube_click",
    "exclusive_page_view",
    "exclusive_claim_success",
    "exclusive_email_unlock_success",
    "exclusive_preview_open",
    "exclusive_discord_cta"
  ]),
  page: z.enum(["links", "vault", "playlist", "preview"]),
  eventId: z.string().max(200).optional(),
  path: z.string().max(1000).default(""),
  hubPath: z.string().max(500).default(""),
  playlistId: z.string().max(200).nullish(),
  playlistSlug: z.string().max(200).default(""),
  shortLinkContext: z.string().max(1000).default(""),
  releaseId: z.string().nullish(),
  platform: z.enum(["spotify", "apple_music", "youtube_music", "youtube", "other"]).optional(),
  entryType: z.enum(["external", "short_link", "internal_navigation", "direct"]).optional(),
  originalReferrer: z.string().max(1000).default(""),
  fbclid: z.string().max(500).default(""),
  linkType: z.string().max(100).default(""),
  linkLabel: z.string().max(200).default(""),
  targetUrl: z.string().max(2000).default(""),
  utmSource: z.string().default(""),
  utmMedium: z.string().default(""),
  utmCampaign: z.string().default(""),
  utmContent: z.string().default(""),
  utmTerm: z.string().default(""),
  metaEventId: z.string().max(200).default(""),
  metaEventName: z.enum(["ViewContent", "Lead", "StreamingOutboundClick"]).optional(),
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
  const isPreviewEvent =
    event.page === "preview" &&
    [
      "preview_player_impression",
      "preview_play",
      "preview_pause",
      "preview_next",
      "preview_previous",
      "preview_milestone",
      "preview_complete",
      "preview_error",
      "preview_exclusives_cta",
      "exclusive_unlock_success",
      "exclusive_unlock_existing_subscriber",
      "exclusive_embed_impression",
      "exclusive_youtube_play",
      "exclusive_youtube_pause",
      "exclusive_youtube_video_change",
      "exclusive_youtube_complete",
      "exclusive_youtube_error",
      "exclusive_open_in_youtube",
      "exclusive_subscribe_youtube_click",
      "exclusive_page_view",
      "exclusive_claim_success",
      "exclusive_email_unlock_success",
      "exclusive_preview_open",
      "exclusive_discord_cta"
    ].includes(event.eventType);

  if (!isLinksEvent && !isVaultEvent && !isPlaylistEvent && !isPreviewEvent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unsupported analytics event for page."
    });
  }
  if (isPlaylistEvent && !(event.eventId || event.metaEventId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Playlist analytics require an event ID."
    });
  }
  if (event.eventType === "playlist_track_click" && !event.platform) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Playlist outbound clicks require a normalized platform."
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
    const eventId = parsed.eventId || parsed.metaEventId || "";
    const shortLinkId = parsed.shortLinkContext
      ? verifyShortLinkAttributionToken(parsed.shortLinkContext)
      : null;
    const rateLimit = await consumeRateLimit({
      bucket: "public-analytics",
      key: getRateLimitIp(request),
      maxAttempts: 240,
      windowMs: 60_000,
      blockMs: 60_000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({message: "Analytics rate limit reached."}, {status: 429});
    }

    let entryType = parsed.entryType || "";
    if (parsed.eventType === "playlist_page_view" && parsed.playlistId) {
      const priorPageView = await prisma.analyticsEvent.findFirst({
        select: {id: true},
        where: {
          eventType: "playlist_page_view",
          playlistId: parsed.playlistId,
          sessionId
        }
      });
      entryType = parsed.entryType === "internal_navigation"
        ? "internal_navigation"
        : shortLinkId
          ? "short_link"
          : parsed.utmSource || parsed.utmCampaign || parsed.utmContent || parsed.fbclid || parsed.originalReferrer
            ? "external"
            : priorPageView
              ? "internal_navigation"
              : "direct";
    }

    await recordPublicAnalyticsEvent({
      ...parsed,
      eventId,
      shortLinkId,
      entryType,
      releaseId: parsed.releaseId ?? null,
      referrer: request.headers.get("referer") || "",
      userAgent: request.headers.get("user-agent") || "",
      visitorId,
      sessionId,
      country: request.headers.get("x-vercel-ip-country") || ""
    });

    if ((parsed.page === "links" || parsed.page === "playlist") && parsed.metaEventName && eventId) {
      await sendMetaConversionsApiEvent({
        eventId,
        eventName: parsed.metaEventName,
        eventSourceUrl: toEventSourceUrl(request, parsed.path),
        clientIpAddress: getClientIpAddress(request),
        clientUserAgent: request.headers.get("user-agent") || "",
        fbc: readCookieValue(cookieHeader, "_fbc"),
        fbp: readCookieValue(cookieHeader, "_fbp"),
        linkLabel: parsed.linkLabel,
        linkType: parsed.linkType,
        page: parsed.page,
        playlistId: parsed.playlistId ?? null,
        playlistSlug: parsed.playlistSlug,
        platform: parsed.platform,
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
