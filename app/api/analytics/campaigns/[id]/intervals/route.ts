export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {z} from "zod";
import {addCampaignInterval} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";
const schema = z.object({activeStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), activeEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), timezone: z.string().trim().min(1).max(100), sourceType: z.string().max(50).optional(), confirmationStatus: z.string().max(40).optional(), evidenceId: z.string().max(200).nullable().optional(), notes: z.string().max(2000).optional()}).strict();
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const input = schema.parse(await readLimitedAdminJson(request)); return NextResponse.json(await addCampaignInterval((await params).id, {...input, actor: {userId: auth.userId, username: auth.username}}), {status: 201}); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.intervals.create", fallbackMessage: "Interval could not be added."}); } }
