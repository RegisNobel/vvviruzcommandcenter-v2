export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {readSpotifyImportDetail} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const {id} = await params;
    return NextResponse.json({ok: true, code: "IMPORT_DETAIL_LOADED", message: "Analytics import loaded.", import: await readSpotifyImportDetail(id)});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.detail", fallbackMessage: "The analytics import could not be loaded."});
  }
}
