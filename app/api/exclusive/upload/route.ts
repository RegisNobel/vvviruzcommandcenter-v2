export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";

import sharp from "sharp";
import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AUDIO_EXTENSIONS, IMAGE_EXTENSIONS} from "@/lib/constants";
import {storeAsset, deleteAsset} from "@/lib/server/asset-storage";
import {ensureStorageDirs} from "@/lib/server/storage";
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

  const formData = await request.formData();
  const file = formData.get("file");
  const assetType = String(formData.get("assetType") ?? "").trim();
  const previousPath = formData.get("previousPath") as string | null;

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

  const uuid = crypto.randomUUID();
  const storedFileName = `${uuid}${detectedExtension}`;

  if (assetType === "track") {
    const storedAsset = await storeAsset({
      kind: "exclusive-track",
      fileName: storedFileName,
      data: Buffer.from(await file.arrayBuffer()) as any,
      contentType: file.type || "application/octet-stream",
      access: "private"
    });

    if (previousPath) {
      await deleteAsset("exclusive-track", previousPath);
    }

    const payload: ExclusiveAssetUploadResponse = {
      assetType,
      fileName: file.name,
      storedPath: storedAsset.storedPath,
      publicUrl: storedAsset.publicUrl,
      mimeType: file.type || "application/octet-stream"
    };

    return NextResponse.json(payload);
  } else {
    // assetType === "art"
    const originalFileName = `original-${uuid}${detectedExtension}`;
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as any;

    // 1. Save original copy first
    await storeAsset({
      kind: "exclusive-art",
      fileName: originalFileName,
      data: originalBuffer,
      contentType: file.type || "image/*",
      access: "public"
    });

    // 2. Perform sharp optimization for display copy
    let displayBuffer = originalBuffer;
    try {
      let sharpInstance = sharp(originalBuffer);
      const metadata = await sharpInstance.metadata();

      if (metadata.width && metadata.width > 800) {
        sharpInstance = sharpInstance.resize({ width: 800, fit: "inside", withoutEnlargement: true });
      }

      const ext = detectedExtension.toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") {
        sharpInstance = sharpInstance.jpeg({ quality: 80, mozjpeg: true });
      } else if (ext === ".png") {
        sharpInstance = sharpInstance.png({ quality: 80, compressionLevel: 8 });
      } else if (ext === ".webp") {
        sharpInstance = sharpInstance.webp({ quality: 80 });
      }

      displayBuffer = (await sharpInstance.toBuffer()) as any;
    } catch (err) {
      console.error("Sharp optimization failed, using original file as display copy:", err);
    }

    // 3. Store optimized display copy
    const storedAsset = await storeAsset({
      kind: "exclusive-art",
      fileName: storedFileName,
      data: displayBuffer,
      contentType: file.type || "image/*",
      access: "public"
    });

    // 4. Clean up previous asset if replaced
    if (previousPath) {
      await deleteAsset("exclusive-art", previousPath);
    }

    const payload: ExclusiveAssetUploadResponse = {
      assetType,
      fileName: file.name,
      storedPath: storedAsset.url,
      publicUrl: storedAsset.publicUrl,
      mimeType: file.type || "image/*"
    };

    return NextResponse.json(payload);
  }
}
