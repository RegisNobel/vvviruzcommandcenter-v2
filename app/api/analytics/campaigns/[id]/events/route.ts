export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {z} from "zod";
import {addCampaignEvent} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";
const schema = z.object({eventType: z.string().max(60), eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), eventTime: z.string().max(8).optional(), timezone: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(240), notes: z.string().max(2000).optional(), metadata: z.record(z.unknown()).optional()}).strict();
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { return NextResponse.json(await addCampaignEvent((await params).id, {...schema.parse(await readLimitedAdminJson(request)), actor: {userId: auth.userId, username: auth.username}}), {status: 201}); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.events.create", fallbackMessage: "Event could not be added."}); } }
