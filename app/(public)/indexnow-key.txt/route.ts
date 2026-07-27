export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {NextResponse} from "next/server";

export async function GET() {
  const configuredKey = process.env.INDEXNOW_KEY?.trim() || "";

  if (!configuredKey) {
    return new NextResponse("Not found.", {status: 404});
  }

  return new NextResponse(configuredKey, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
