export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {createMetaImportPreview} from "@/lib/ads/meta-import-service";
import {mapMetaImportPreviewError} from "@/lib/ads/meta-import-errors";
import {AdminError, adminErrorResponse} from "@/lib/server/admin-error-response";

function isCsvFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 22 * 1024 * 1024) {
      throw new AdminError("Meta import request is too large.", {code: "INVALID_FILE", status: 413});
    }
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    const unsupported = files.find((file) => !isCsvFile(file));

    if (unsupported) {
      throw new AdminError(`Unsupported file: ${unsupported.name}. Upload CSV files only.`, {code: "INVALID_FILE", status: 400});
    }

    if (files.length === 0) {
      throw new AdminError("Upload at least one Meta CSV file.", {code: "VALIDATION", status: 400});
    }

    const result = await createMetaImportPreview({
      actor: {userId: auth.userId, username: auth.username},
      context: {
        attributionSetting: formData.get("attribution_setting")?.toString() ?? "",
        batchType: formData.get("batch_type")?.toString() ?? "",
        sourceAsOf: formData.get("exported_at")?.toString().trim() || null,
        sourceAsOfOrigin: formData.get("exported_at")?.toString().trim() ? "USER_CONFIRMED" : "UNKNOWN",
        manualTimezone: formData.get("account_timezone")?.toString().trim() || null,
        manualTimezoneOrigin: formData.get("account_timezone")?.toString().trim() ? "USER_CONFIRMED" : null,
        confirmedCurrency: formData.get("confirmed_currency")?.toString().trim().toUpperCase() || null,
        expectedGranularity: formData.get("source_granularity")?.toString() === "DAILY" ? "DAILY" : "AGGREGATE_SNAPSHOT",
        releaseId: formData.get("release_id")?.toString().trim() || null,
        name: formData.get("name")?.toString() ?? "",
        notes: formData.get("notes")?.toString() ?? ""
      },
      files: await Promise.all(files.map(async (file) => ({fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer())})))
    });

    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(mapMetaImportPreviewError(error), {
      context: "ad-lab.csv-preview",
      fallbackMessage: "The Meta CSV preview could not be completed.",
      exposeMessage: true
    });
  }
}
