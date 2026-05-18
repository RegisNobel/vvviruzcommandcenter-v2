import {NextResponse} from "next/server";

import {resolveActiveShortLinkDestination} from "@/lib/repositories/short-links";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug: string}>}
) {
  const {slug} = await params;
  const destinationUrl = await resolveActiveShortLinkDestination(slug);

  if (!destinationUrl) {
    return new Response("Short link not found.", {
      status: 404
    });
  }

  return NextResponse.redirect(destinationUrl, {
    status: 302
  });
}
