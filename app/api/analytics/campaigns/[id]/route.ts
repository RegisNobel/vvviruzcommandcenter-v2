export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";
import {readPromotionCampaign, updatePromotionCampaign} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

const updateSchema = z.object({name: z.string().trim().min(1).max(200).optional(), platform: z.string().max(40).optional(), objective: z.string().max(40).optional(), status: z.string().max(40).optional(), notes: z.string().max(2000).optional(), externalCampaignId: z.string().max(200).optional(), externalCampaignName: z.string().max(300).optional(), reason: z.string().max(500).optional()}).strict();
type Context = {params: Promise<{id: string}>};
export async function GET(request: Request, {params}: Context) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const futureWindowEndDate = new URL(request.url).searchParams.get("future_window_end") || undefined; return NextResponse.json({ok: true, code: "CAMPAIGN_LOADED", message: "Campaign loaded.", campaign: await readPromotionCampaign((await params).id, {futureWindowEndDate})}); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.read", fallbackMessage: "Campaign could not be loaded."}); } }
export async function PATCH(request: Request, {params}: Context) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const input = updateSchema.parse(await readLimitedAdminJson(request)); return NextResponse.json(await updatePromotionCampaign((await params).id, {...input, actor: {userId: auth.userId, username: auth.username}})); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.update", fallbackMessage: "Campaign could not be updated."}); } }
