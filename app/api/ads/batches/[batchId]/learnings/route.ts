export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {archiveAdCampaignLearning, saveAdCampaignLearning} from "@/lib/repositories/ads";

const learningSchema = z.object({
  release_id: z.string().trim().min(1).nullable().default(null),
  summary: z.string().default(""),
  what_worked: z.string().default(""),
  what_failed: z.string().default(""),
  next_test: z.string().default(""),
  decision: z.enum(["scale", "iterate", "pause", "retire", "retest-hook", "retest-visual", "retest-audience", "needs-more-data"]).default("iterate"),
  /** V1.2: set to true to lock this record as a permanent historical archive entry. */
  archive: z.boolean().optional().default(false),
  final_decision: z.string().default(""),
  human_override_notes: z.string().default("")
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

    // Route to archiving when the caller explicitly requests a lock.
    if (parsed.data.archive) {
      const learning = await archiveAdCampaignLearning({
        importBatchId: batchId,
        reviewedBy: auth.username,
        finalDecision: parsed.data.final_decision,
        humanOverrideNotes: parsed.data.human_override_notes
      });

      return NextResponse.json({learning});
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
