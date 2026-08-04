export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {reprocessSpotifyImport} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {withOperationalSpan} from "@/lib/server/operational-log";

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const {id} = await params;
    const result = await withOperationalSpan(
      "analytics.import.reprocess",
      {actorId: auth.userId, importId: id},
      () => reprocessSpotifyImport(id, {userId: auth.userId, username: auth.username}),
      (value) => ({importType: value.detectedType, rowCount: value.counts.accepted + value.counts.warnings + value.counts.rejected, code: value.code})
    );
    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.reprocess", fallbackMessage: "The analytics import could not be reprocessed."});
  }
}
