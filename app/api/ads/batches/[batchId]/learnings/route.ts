export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {saveAdCampaignLearning} from "@/lib/repositories/ads";

const learningSchema = z.object({
  release_id: z.string().trim().min(1).nullable().default(null),
  summary: z.string().default(""),
  what_worked: z.string().default(""),
  what_failed: z.string().default(""),
  next_test: z.string().default(""),
  decision: z.enum(["scale", "retest", "iterate", "pause", "archive"]).default("iterate")
});

export async function PUT(
  request: Request,
  {params}: {params: Promise<{batchId: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {batchId} = await params;
    const parsed = learningSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid learning payload."},
        {status: 400}
      );
    }

    const learning = await saveAdCampaignLearning({
      importBatchId: batchId,
      releaseId: parsed.data.release_id,
      summary: parsed.data.summary,
      whatWorked: parsed.data.what_worked,
      whatFailed: parsed.data.what_failed,
      nextTest: parsed.data.next_test,
      decision: parsed.data.decision
    });

    return NextResponse.json({learning});
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Learning save failed."},
      {status: 400}
    );
  }
}
