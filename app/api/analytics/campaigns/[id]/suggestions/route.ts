export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {NextResponse} from "next/server";
import {generateMetaIntervalSuggestions, readPromotionCampaign} from "@/lib/analytics/campaign-timeline-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
type Context = {params: Promise<{id: string}>};
export async function GET(request: Request, {params}: Context) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { const campaign = await readPromotionCampaign((await params).id); return NextResponse.json({ok: true, code: "CAMPAIGN_SUGGESTIONS_LOADED", message: "Suggestions loaded.", suggestions: campaign.activeIntervals.filter((item: {confirmationStatus: string}) => item.confirmationStatus !== "CONFIRMED")}); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.suggestions.list", fallbackMessage: "Suggestions could not be loaded."}); } }
export async function POST(request: Request, {params}: Context) { const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth; try { return NextResponse.json(await generateMetaIntervalSuggestions((await params).id, {userId: auth.userId, username: auth.username})); } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.suggestions.generate", fallbackMessage: "Suggestions could not be generated."}); } }
