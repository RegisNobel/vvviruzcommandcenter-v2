export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";
import {createPromotionCampaign, listPromotionCampaigns} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

const createSchema = z.object({artistProfileId: z.string().trim().min(1).max(200), releaseId: z.string().trim().min(1).max(200), platform: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(200), objective: z.string().trim().min(1).max(40), notes: z.string().max(2000).optional(), externalCampaignId: z.string().max(200).optional(), externalCampaignName: z.string().max(300).optional()}).strict();

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try { const p = new URL(request.url).searchParams; return NextResponse.json({ok: true, code: "CAMPAIGNS_LISTED", message: "Campaigns loaded.", ...(await listPromotionCampaigns({page: Number(p.get("page") || 1), pageSize: Number(p.get("page_size") || 25), releaseId: p.get("release_id") || undefined, platform: p.get("platform") || undefined, status: p.get("status") || undefined, activeDate: p.get("active_date") || undefined, confirmationStatus: p.get("confirmation_status") || undefined}))}); }
  catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.list", fallbackMessage: "Campaigns could not be loaded."}); }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try { const input = createSchema.parse(await readLimitedAdminJson(request)); return NextResponse.json(await createPromotionCampaign({...input, actor: {userId: auth.userId, username: auth.username}}), {status: 201}); }
  catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.create", fallbackMessage: "Campaign could not be created."}); }
}
