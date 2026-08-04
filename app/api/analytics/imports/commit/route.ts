export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {commitSpotifyImport} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";
import {withOperationalSpan} from "@/lib/server/operational-log";

const commitSchema = z.object({
  previewToken: z.string().min(1),
  clientIdempotencyKey: z.string().min(8).max(200),
  artistProfileId: z.string().trim().nullable().optional(),
  releaseId: z.string().trim().nullable().optional(),
  periodStart: z.string().trim().nullable().optional(),
  periodEnd: z.string().trim().nullable().optional(),
  acknowledgeWarnings: z.boolean().optional(),
  acknowledgeFilenameNotIdentity: z.boolean().optional(),
  acknowledgeTrackStreamsNotRetention: z.boolean().optional(),
  replacementTargetImportId: z.string().trim().nullable().optional(),
  songMappings: z.array(z.object({
    originalRowNumber: z.number().int().positive(),
    releaseId: z.string().trim().nullable().optional(),
    leaveUnmatched: z.boolean().optional(),
    unmatchedReason: z.enum(["RELEASE_NOT_IN_CATALOG", "AMBIGUOUS_MATCH", "WRONG_ARTIST", "DUPLICATE_EXPORT_ROW", "VERSION_NOT_SUPPORTED", "USER_DEFERRED", "OTHER"]).nullable().optional(),
    unmatchedNote: z.string().trim().max(500).nullable().optional()
  })).optional()
}).strict();

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
      throw new AdminError("Analytics commit requests must be 256 KiB or smaller.", {code: "VALIDATION", status: 413});
    }
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 256 * 1024) {
      throw new AdminError("Analytics commit requests must be 256 KiB or smaller.", {code: "VALIDATION", status: 413});
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AdminError("Commit request must contain valid JSON.", {code: "VALIDATION", status: 400});
    }
    const input = commitSchema.parse(json);
    const result = await withOperationalSpan(
      "analytics.import.commit",
      {actorId: auth.userId},
      () => commitSpotifyImport({...input, actor: {userId: auth.userId, username: auth.username}}),
      (value) => ({importId: value.importId, code: value.code, duplicate: value.replayed})
    );
    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.commit", fallbackMessage: "The Spotify analytics import could not be committed."});
  }
}
