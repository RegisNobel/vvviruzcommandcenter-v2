export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {listSpotifyImports} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const params = new URL(request.url).searchParams;
    const uploadedFrom = params.get("uploaded_from");
    const uploadedTo = params.get("uploaded_to");
    const withdrawn = params.get("withdrawn");
    const result = await listSpotifyImports({
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("page_size") || 25),
      status: params.get("status") || undefined,
      importType: params.get("import_type") || undefined,
      artistProfileId: params.get("artist_profile_id") || undefined,
      uploadedFrom: uploadedFrom ? new Date(uploadedFrom) : undefined,
      uploadedTo: uploadedTo ? new Date(uploadedTo) : undefined,
      withdrawn: withdrawn === "true" ? true : withdrawn === "false" ? false : undefined
    });
    return NextResponse.json({ok: true, code: "IMPORTS_LISTED", message: "Analytics imports loaded.", ...result});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.list", fallbackMessage: "Analytics imports could not be loaded."});
  }
}
