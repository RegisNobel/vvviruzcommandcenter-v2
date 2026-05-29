import {NextResponse} from "next/server";

import {resolveShortLinkRedirect} from "@/lib/repositories/short-links";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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

  return NextResponse.redirect(redirect.destinationUrl, {
    status: 302
  });
}
