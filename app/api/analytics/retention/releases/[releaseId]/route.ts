export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {
  readReleaseRetentionAnalysis,
  RetentionCampaignRequiredError
} from "@/lib/analytics/retention-data";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";
import {withOperationalSpan} from "@/lib/server/operational-log";

type Context = {params: Promise<{releaseId: string}>};

export async function GET(request: Request, {params}: Context) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const {releaseId} = await params;
    const campaignId = new URL(request.url).searchParams.get("campaignId");
    const analysis = await withOperationalSpan(
      "analytics.retention.calculate",
      {actorId: auth.userId, releaseId, campaignId},
      () => readReleaseRetentionAnalysis(releaseId, {campaignId}),
      (value) => ({
        status: value.status,
        confidence: value.confidence,
        missingDayCount: value.reasonCodes.filter((reason) => reason.includes("MISSING")).length,
        exclusionReasons: value.reasonCodes.filter((reason) => reason.includes("OVERLAP") || reason.includes("EXCLUDED"))
      })
    );
    return NextResponse.json({
      ok: true,
      code: "RETENTION_ANALYSIS_CALCULATED",
      message: "Retention analysis calculated from current observations.",
      analysis
    });
  } catch (error) {
    if (error instanceof RetentionCampaignRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
          error: {code: error.code, message: error.message, retryable: false},
          campaigns: error.campaigns
        },
        {status: error.status}
      );
    }
    return adminErrorResponse(
      error instanceof AdminError
        ? error
        : new AdminError("Retention analysis could not be calculated.", {
            code: "RETENTION_CALCULATION_FAILED",
            status: 500,
            retryable: true
          }),
      {
        context: "analytics.retention.release.read",
        fallbackMessage: "Retention analysis could not be calculated."
      }
    );
  }
}
