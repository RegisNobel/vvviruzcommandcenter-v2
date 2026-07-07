export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {readSubscriberByExclusiveAccessToken} from "@/lib/repositories/audience";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t")?.trim();

  if (!token) {
    return NextResponse.redirect(new URL("/exclusives", url.origin));
  }

  const subscriber = await readSubscriberByExclusiveAccessToken(token);

  if (!subscriber) {
    // If token is invalid, redirect back to exclusives page
    return NextResponse.redirect(new URL("/exclusives?error=invalid_token", url.origin));
  }

  // Create clean redirect response
  const redirectResponse = NextResponse.redirect(new URL("/exclusives", url.origin));

  // Set the server-generated HttpOnly cookie
  redirectResponse.cookies.set("vcc_exclusive_access", token, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return redirectResponse;
}
