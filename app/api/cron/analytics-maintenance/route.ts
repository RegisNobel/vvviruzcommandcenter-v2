export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import {NextResponse} from "next/server";

import {runRetentionCleanup} from "@/lib/analytics/retention-cleanup";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ok: false, code: "UNAUTHORIZED", message: "Unauthorized."}, {status: 401});
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await runRetentionCleanup({dryRun});
  return NextResponse.json({
    ok: result.errors.length === 0,
    code: result.errors.length ? "ANALYTICS_CLEANUP_PARTIAL" : "ANALYTICS_CLEANUP_COMPLETE",
    message: result.errors.length ? "Analytics cleanup completed with retryable failures." : "Analytics cleanup completed.",
    result
  }, {status: result.errors.length ? 207 : 200});
}
