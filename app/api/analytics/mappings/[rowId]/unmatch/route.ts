export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {leaveMappingUnmatched, UNMATCHED_REASONS} from "@/lib/analytics/release-mapping-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

const schema = z.object({reason: z.enum(UNMATCHED_REASONS), note: z.string().max(500).optional()}).strict();

export async function POST(request: Request, {params}: {params: Promise<{rowId: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const input = schema.parse(await readLimitedAdminJson(request));
    const {rowId} = await params;
    return NextResponse.json(await leaveMappingUnmatched(rowId, {...input, actor: {userId: auth.userId, username: auth.username}}));
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.mappings.unmatch", fallbackMessage: "The unmatched decision could not be saved."});
  }
}
