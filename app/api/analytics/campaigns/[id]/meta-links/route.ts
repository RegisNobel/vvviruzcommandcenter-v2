export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {createMetaPromotionLink, listMetaPromotionLinks, transitionMetaPromotionLink} from "@/lib/ads/meta-promotion-links";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

type Context = {params: Promise<{id: string}>};
export async function GET(request: Request, {params}: Context) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try { return NextResponse.json({items: await listMetaPromotionLinks((await params).id)}); }
  catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.meta-links.list", fallbackMessage: "Meta campaign links could not be loaded."}); }
}
export async function POST(request: Request, {params}: Context) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try {
    const body = await readLimitedAdminJson(request) as Record<string, unknown>; const promotionCampaignId = (await params).id;
    const actor = {userId: auth.userId, username: auth.username};
    const result = typeof body.linkId === "string"
      ? await transitionMetaPromotionLink({promotionCampaignId, linkId: body.linkId, status: String(body.status ?? ""), reason: String(body.reason ?? ""), confirmSharedScope: body.confirmSharedScope === true, actor})
      : await createMetaPromotionLink({promotionCampaignId, accountId: String(body.accountId ?? ""), scopeType: String(body.scopeType ?? ""), externalCampaignId: String(body.externalCampaignId ?? ""), externalAdSetId: String(body.externalAdSetId ?? ""), externalAdId: String(body.externalAdId ?? ""), currentDisplayName: String(body.currentDisplayName ?? ""), supersedesLinkId: typeof body.supersedesLinkId === "string" ? body.supersedesLinkId : undefined, evidence: body.evidence, actor});
    return NextResponse.json(result);
  } catch (error) { return adminErrorResponse(error, {context: "analytics.campaigns.meta-links.mutate", fallbackMessage: "Meta campaign link could not be changed."}); }
}
