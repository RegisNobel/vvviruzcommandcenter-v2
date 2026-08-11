export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {withdrawMetaImport} from "@/lib/ads/meta-import-service";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

export async function POST(request: Request, context: {params: Promise<{batchId: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try {
    const {batchId} = await context.params; const body = await readLimitedAdminJson(request) as Record<string, unknown>;
    return NextResponse.json(await withdrawMetaImport({actor: {userId: auth.userId, username: auth.username}, importId: batchId, reason: String(body.reason ?? "")}));
  } catch (error) {
    return adminErrorResponse(error, {context: "ad-lab.import-withdraw", fallbackMessage: "The Meta import could not be withdrawn.", exposeMessage: true});
  }
}
