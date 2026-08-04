export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {listReleaseAliases} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json({ok: true, code: "ALIASES_LOADED", message: "Release aliases loaded.", ...(await listReleaseAliases({page: Number(query.get("page") || 1), pageSize: Number(query.get("page_size") || 25), status: query.get("status") || undefined, artistProfileId: query.get("artist_id") || undefined, source: query.get("source") || undefined, exportType: query.get("export_type") || undefined}))});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.aliases.list", fallbackMessage: "Release aliases could not be loaded."});
  }
}
