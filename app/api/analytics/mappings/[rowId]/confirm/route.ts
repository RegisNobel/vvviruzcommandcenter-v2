export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {confirmMapping} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

const schema = z.object({releaseId: z.string().trim().min(1).max(200), createAlias: z.boolean().optional(), acknowledgeNoDateAlias: z.boolean().optional(), reason: z.string().max(500).optional()}).strict();

export async function POST(request: Request, {params}: {params: Promise<{rowId: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const input = schema.parse(await readLimitedAdminJson(request));
    const {rowId} = await params;
    return NextResponse.json(await confirmMapping(rowId, {...input, actor: {userId: auth.userId, username: auth.username}}));
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.mappings.confirm", fallbackMessage: "The mapping could not be confirmed."});
  }
}
