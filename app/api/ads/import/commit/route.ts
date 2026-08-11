export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {commitMetaImport} from "@/lib/ads/meta-import-service";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try {
    const body = await readLimitedAdminJson(request) as Record<string, unknown>;
    const result = await commitMetaImport({
      actor: {userId: auth.userId, username: auth.username}, previewToken: String(body.previewToken ?? ""),
      clientIdempotencyKey: String(body.clientIdempotencyKey ?? ""), confirmFinalReview: body.confirmFinalReview === true,
      acknowledgeWarnings: body.acknowledgeWarnings === true,
      replacementTargetBatchId: typeof body.replacementTargetBatchId === "string" ? body.replacementTargetBatchId : null
    });
    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error, {context: "ad-lab.csv-commit", fallbackMessage: "The Meta CSV import could not be committed.", exposeMessage: true});
  }
}
