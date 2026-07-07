export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {readSubscriberByExclusiveAccessToken} from "@/lib/repositories/audience";
import {recordPublicAnalyticsEvent} from "@/lib/repositories/analytics";

function sanitizeReferrer(referrer: string | null) {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    url.searchParams.delete("t");
    url.searchParams.delete("token");
    return url.toString();
  } catch {
    return referrer;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t")?.trim();

  if (!token) {
    return NextResponse.redirect(new URL("/exclusives", url.origin), {
      status: 303
    });
  }

  const subscriber = await readSubscriberByExclusiveAccessToken(token);

  if (!subscriber) {
    // If token is invalid, redirect back to exclusives page
    return NextResponse.redirect(new URL("/exclusives?error=invalid_token", url.origin), {
      status: 303
    });
  }

  // Create clean redirect response with HTTP 303 See Other
  const redirectResponse = NextResponse.redirect(new URL("/exclusives", url.origin), {
    status: 303
  });

  // Set the server-generated HttpOnly cookie
  redirectResponse.cookies.set("vcc_exclusive_access", token, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  try {
    const cleanReferrer = sanitizeReferrer(request.headers.get("referer"));
    const params = url.searchParams;
    await recordPublicAnalyticsEvent({
      eventType: "exclusive_email_unlock_success",
      page: "preview",
      referrer: cleanReferrer,
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || "",
      utmTerm: params.get("utm_term") || ""
    });
  } catch (err) {
    console.error("Failed to record email unlock analytics event:", err);
  }

  return redirectResponse;
}
