export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import {NextResponse} from "next/server";

import {runAllBackups} from "@/lib/backups/runner";
import {cleanupStalePublicRateLimits} from "@/lib/public-rate-limit";

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({message: "Unauthorized."}, {status: 401});
  }

  const [cleanupCount, backupResult] = await Promise.all([
    cleanupStalePublicRateLimits(),
    runAllBackups()
  ]);
  const {ok, results} = backupResult;

  return NextResponse.json(
    {ok, results, maintenance: {publicRateLimitRowsDeleted: cleanupCount}},
    {status: ok ? 200 : 500}
  );
}
