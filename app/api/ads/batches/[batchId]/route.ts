export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {deleteAdImportBatch, renameAdImportBatch} from "@/lib/repositories/ads";

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{batchId: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {batchId} = await params;
    const body = (await request.json().catch(() => null)) as
      | {name?: string}
      | null;

    const name = body?.name;
    if (typeof name !== "string") {
      return NextResponse.json(
        {message: "Batch name must be a string."},
        {status: 400}
      );
    }

    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json(
        {message: "Batch name cannot be empty."},
        {status: 400}
      );
    }

    if (trimmed.length > 120) {
      return NextResponse.json(
        {message: "Batch name cannot exceed 120 characters."},
        {status: 400}
      );
    }

    await renameAdImportBatch(batchId, trimmed);

    return NextResponse.json({ok: true, message: "Batch renamed successfully."});
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Ad import batch renaming failed unexpectedly."
      },
      {status: 400}
    );
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{batchId: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {batchId} = await params;
    const body = (await request.json().catch(() => null)) as
      | {confirmation?: string}
      | null;

    if (body?.confirmation !== "DELETE") {
      return NextResponse.json(
        {message: "Type DELETE to confirm this batch cleanup."},
        {status: 400}
      );
    }

    await deleteAdImportBatch(batchId);

    return NextResponse.json({ok: true});
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Ad import batch deletion failed unexpectedly."
      },
      {status: 400}
    );
  }
}
