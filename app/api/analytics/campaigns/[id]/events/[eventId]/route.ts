export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {z} from "zod";
import {correctCampaignEvent} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";
const schema = z.object({eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), eventTime: z.string().max(8).optional(), timezone: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(240), notes: z.string().max(2000).optional(), reason: z.string().trim().min(1).max(500)}).strict();
export async function PATCH(request: Request, {params}: {params: Promise<{id: string; eventId: string}>}) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const p = await params; return NextResponse.json(await correctCampaignEvent(p.id, p.eventId, {...schema.parse(await readLimitedAdminJson(request)), actor: {userId: auth.userId, username: auth.username}})); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.events.correct", fallbackMessage: "Event could not be corrected."}); } }
