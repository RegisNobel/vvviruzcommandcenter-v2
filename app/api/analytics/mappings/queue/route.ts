export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {listMappingQueue} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";

function optionalDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AdminError("Mapping date filter is invalid.", {code: "VALIDATION", status: 400});
  return date;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json({ok: true, code: "MAPPING_QUEUE_LOADED", message: "Mapping review queue loaded.", ...(await listMappingQueue({page: Number(query.get("page") || 1), pageSize: Number(query.get("page_size") || 25), importId: query.get("import_id") || undefined, exportType: query.get("export_type") || undefined, mappingStatus: query.get("status") || undefined, artistProfileId: query.get("artist_id") || undefined, confidence: query.get("confidence") || undefined, suggestedReleaseId: query.get("suggested_release_id") || undefined, dateFrom: optionalDate(query.get("date_from")), dateTo: optionalDate(query.get("date_to"))}))});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.mappings.queue", fallbackMessage: "The mapping queue could not be loaded."});
  }
}
