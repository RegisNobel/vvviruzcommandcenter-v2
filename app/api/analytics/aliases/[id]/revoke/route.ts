export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {revokeReleaseAlias} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

const schema = z.object({reason: z.string().trim().min(1).max(500)}).strict();

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const input = schema.parse(await readLimitedAdminJson(request));
    const {id} = await params;
    return NextResponse.json(await revokeReleaseAlias(id, {actor: {userId: auth.userId, username: auth.username}, reason: input.reason}));
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.aliases.revoke", fallbackMessage: "The release alias could not be revoked."});
  }
}
