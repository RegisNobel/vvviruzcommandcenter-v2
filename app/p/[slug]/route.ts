import {NextResponse} from "next/server";

import {resolveShortLinkRedirect} from "@/lib/repositories/short-links";
import {createShortLinkAttributionToken} from "@/lib/server/short-link-attribution";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {params}: {params: Promise<{slug: string}>}
) {
  const {slug} = await params;
  const redirect = await resolveShortLinkRedirect(slug);

  if (!redirect) {
    return new Response("Short link not found.", {
      status: 404
    });
  }

  if (!redirect.destinationUrl) {
    return new Response("Short link is paused.", {
      status: 410
    });
  }

  const destination = new URL(redirect.destinationUrl);
  const requestUrl = new URL(request.url);
  const configuredHosts = [
    requestUrl.hostname,
    request.headers.get("host")?.split(":")[0],
    process.env.PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL
  ]
    .filter(Boolean)
    .map((value) => {
      try {
        return (value as string).includes("://")
          ? new URL(value as string).hostname.toLowerCase()
          : (value as string).toLowerCase();
      } catch {
        return "";
      }
    });
  const destinationHost = destination.hostname.toLowerCase();
  const isLocalDestination = ["localhost", "127.0.0.1"].includes(destinationHost) &&
    configuredHosts.some((host) => ["localhost", "127.0.0.1"].includes(host));

  if (
    destination.pathname.startsWith("/listen/") &&
    (configuredHosts.includes(destinationHost) || isLocalDestination)
  ) {
    const token = createShortLinkAttributionToken(redirect.id);
    if (token) destination.searchParams.set("sl_ctx", token);
  }

  return NextResponse.redirect(destination, {
    status: 302
  });
}
