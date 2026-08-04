export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {readMappingRowDetail} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function GET(request: Request, {params}: {params: Promise<{rowId: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const {rowId} = await params;
    return NextResponse.json({ok: true, code: "MAPPING_ROW_LOADED", message: "Mapping row loaded.", row: await readMappingRowDetail(rowId)});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.mappings.detail", fallbackMessage: "The mapping row could not be loaded."});
  }
}
