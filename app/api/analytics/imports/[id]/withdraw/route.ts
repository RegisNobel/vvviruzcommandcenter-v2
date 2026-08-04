export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {withdrawSpotifyImport} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";
import {withOperationalSpan} from "@/lib/server/operational-log";

const schema = z.object({reason: z.string().trim().min(1).max(500)}).strict();

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 8 * 1024) {
      throw new AdminError("Withdrawal requests must be 8 KiB or smaller.", {code: "VALIDATION", status: 413});
    }
    const {id} = await params;
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 8 * 1024) {
      throw new AdminError("Withdrawal requests must be 8 KiB or smaller.", {code: "VALIDATION", status: 413});
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AdminError("Withdrawal request must contain valid JSON.", {code: "VALIDATION", status: 400});
    }
    const {reason} = schema.parse(json);
    const result = await withOperationalSpan(
      "analytics.import.withdraw",
      {actorId: auth.userId, importId: id},
      () => withdrawSpotifyImport(id, {userId: auth.userId, username: auth.username}, reason),
      (value) => ({code: value.code, duplicate: value.replayed})
    );
    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.withdraw", fallbackMessage: "The analytics import could not be withdrawn."});
  }
}
