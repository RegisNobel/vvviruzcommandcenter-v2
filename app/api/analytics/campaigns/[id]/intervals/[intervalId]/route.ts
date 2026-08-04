export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {z} from "zod";
import {correctCampaignInterval} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";
const schema = z.object({activeStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), activeEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), timezone: z.string().trim().min(1).max(100), reason: z.string().trim().min(1).max(500)}).strict();
export async function PATCH(request: Request, {params}: {params: Promise<{id: string; intervalId: string}>}) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const input = schema.parse(await readLimitedAdminJson(request)); const p = await params; return NextResponse.json(await correctCampaignInterval(p.id, p.intervalId, {...input, actor: {userId: auth.userId, username: auth.username}})); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.intervals.correct", fallbackMessage: "Interval could not be corrected."}); } }
