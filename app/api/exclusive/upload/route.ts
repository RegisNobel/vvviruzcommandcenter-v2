export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs/promises";
import path from "node:path";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AUDIO_EXTENSIONS, IMAGE_EXTENSIONS} from "@/lib/constants";
import {
  ensureStorageDirs,
  exclusiveArtDir,
  exclusiveTracksDir
} from "@/lib/server/storage";
import type {ExclusiveAssetUploadResponse} from "@/lib/types";

const mimeToExtension: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  await ensureStorageDirs();

  const formData = await request.formData();
  const file = formData.get("file");
  const assetType = String(formData.get("assetType") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({message: "A file is required."}, {status: 400});
  }

  if (assetType !== "track" && assetType !== "art") {
    return NextResponse.json({message: "Choose track or art upload."}, {status: 400});
  }

  const detectedExtension =
    path.extname(file.name).toLowerCase() || mimeToExtension[file.type] || "";
  const isValidExtension =
    assetType === "track"
      ? AUDIO_EXTENSIONS.has(detectedExtension)
      : IMAGE_EXTENSIONS.has(detectedExtension);

  if (!isValidExtension) {
    return NextResponse.json(
      {
        message:
          assetType === "track"
            ? "Choose an mp3, wav, or m4a track file."
            : "Choose a jpg, jpeg, png, or webp image."
      },
      {status: 400}
    );
  }

  const storedFileName = `${crypto.randomUUID()}${detectedExtension}`;
  const filePath =
    assetType === "track"
      ? path.join(exclusiveTracksDir, storedFileName)
      : path.join(exclusiveArtDir, storedFileName);

  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const payload: ExclusiveAssetUploadResponse = {
    assetType,
    fileName: file.name,
    storedPath:
      assetType === "track"
        ? storedFileName
        : `/api/assets/exclusive-art/${storedFileName}`,
    publicUrl:
      assetType === "track" ? null : `/api/assets/exclusive-art/${storedFileName}`,
    mimeType: file.type || "application/octet-stream"
  };

  return NextResponse.json(payload);
}

