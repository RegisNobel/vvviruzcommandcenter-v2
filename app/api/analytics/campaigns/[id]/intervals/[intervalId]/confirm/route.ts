export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {z} from "zod";
import {resolveCampaignSuggestion} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";
const schema = z.object({activeStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), activeEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), timezone: z.string().trim().min(1).max(100), reason: z.string().max(500).optional()}).strict();
export async function POST(request: Request, {params}: {params: Promise<{id: string; intervalId: string}>}) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const p = await params; return NextResponse.json(await resolveCampaignSuggestion(p.id, p.intervalId, {...schema.parse(await readLimitedAdminJson(request)), action: "CONFIRM", actor: {userId: auth.userId, username: auth.username}})); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.suggestions.confirm", fallbackMessage: "Suggestion could not be confirmed."}); } }
