export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {createSpotifyImportPreview, SPOTIFY_IMPORT_MAX_FILE_BYTES} from "@/lib/analytics/spotify-import-service";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";
import {withOperationalSpan} from "@/lib/server/operational-log";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > SPOTIFY_IMPORT_MAX_FILE_BYTES + 1024 * 1024) {
      throw new AdminError("Spotify preview requests must be 11 MiB or smaller.", {code: "INVALID_FILE", status: 413});
    }
    const form = await request.formData();
    const files = form.getAll("file").filter((value): value is File => value instanceof File);
    if (files.length !== 1) throw new AdminError("Upload exactly one Spotify CSV file.", {code: "INVALID_FILE", status: 400});
    const file = files[0];
    if (file.size > SPOTIFY_IMPORT_MAX_FILE_BYTES) throw new AdminError("Spotify CSV files must be 10 MiB or smaller.", {code: "INVALID_FILE", status: 413});
    const periodStart = String(form.get("period_start") ?? "").trim();
    const periodEnd = String(form.get("period_end") ?? "").trim();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await withOperationalSpan("analytics.import.preview", {actorId: auth.userId}, () => createSpotifyImportPreview({
      actor: {userId: auth.userId, username: auth.username},
      fileName: file.name,
      mimeType: file.type,
      bytes,
      previewPeriod: periodStart || periodEnd ? {periodStart, periodEnd} : null,
      artistProfileId: String(form.get("artist_profile_id") ?? "").trim() || null,
      releaseId: String(form.get("release_id") ?? "").trim() || null
    }), (value) => ({
      importType: value.detectedType,
      rowCount: value.counts.total,
      acceptedRowCount: value.counts.accepted,
      rejectedRowCount: value.counts.rejected,
      duplicate: value.duplicateFile,
      code: value.code
    }));
    return NextResponse.json(result, {status: result.code === "PREVIEW_READY" ? 200 : 422});
  } catch (error) {
    return adminErrorResponse(error, {context: "analytics.imports.preview", fallbackMessage: "The Spotify export preview could not be created."});
  }
}
