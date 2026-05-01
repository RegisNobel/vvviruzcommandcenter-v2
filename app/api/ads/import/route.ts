export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {importMetaAdReports} from "@/lib/repositories/ads";

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
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    const unsupported = files.find((file) => !isCsvFile(file));

    if (unsupported) {
      return NextResponse.json(
        {message: `Unsupported file: ${unsupported.name}. Upload CSV files only.`},
        {status: 400}
      );
    }

    if (files.length === 0) {
      return NextResponse.json({message: "Upload at least one Meta CSV file."}, {status: 400});
    }

    const result = await importMetaAdReports({
      attributionSetting: formData.get("attribution_setting")?.toString() ?? "",
      batchType: formData.get("batch_type")?.toString() ?? "",
      exportedAt: formData.get("exported_at")?.toString().trim() || null,
      releaseId: formData.get("release_id")?.toString().trim() || null,
      name: formData.get("name")?.toString() ?? "",
      notes: formData.get("notes")?.toString() ?? "",
      files: await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          text: await file.text()
        }))
      )
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Meta CSV import failed unexpectedly."
      },
      {status: 400}
    );
  }
}
