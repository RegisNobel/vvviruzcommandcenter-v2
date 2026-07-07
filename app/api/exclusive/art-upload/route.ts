export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";

import sharp from "sharp";
import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {IMAGE_EXTENSIONS} from "@/lib/constants";
import {storeAsset, deleteAsset} from "@/lib/server/asset-storage";

const mimeToExtension: Record<string, string> = {
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
  const previousPath = formData.get("previousPath") as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({message: "Artwork file is required."}, {status: 400});
  }

  const detectedExtension =
    path.extname(file.name).toLowerCase() || mimeToExtension[file.type];

  if (!detectedExtension || !IMAGE_EXTENSIONS.has(detectedExtension)) {
    return NextResponse.json(
      {message: "Choose a jpg, jpeg, png, or webp image for the artwork."},
      {status: 400}
    );
  }

  const uuid = crypto.randomUUID();
  const originalFileName = `original-${uuid}${detectedExtension}`;
  const storedFileName = `${uuid}${detectedExtension}`;

  const originalBuffer = Buffer.from(await file.arrayBuffer()) as any;

  // 1. Save original copy first
  await storeAsset({
    kind: "exclusive-art",
    fileName: originalFileName,
    data: originalBuffer,
    contentType: file.type || "image/*"
  });

  // 2. Perform sharp optimization for display copy
  let displayBuffer = originalBuffer;
  try {
    let sharpInstance = sharp(originalBuffer);
    const metadata = await sharpInstance.metadata();

    if (metadata.width && metadata.width > 1200) {
      sharpInstance = sharpInstance.resize({ width: 1200, fit: "inside", withoutEnlargement: true });
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
    contentType: file.type || "image/*"
  });

  // 4. Clean up previous asset if replaced
  if (previousPath) {
    try {
      await deleteAsset("exclusive-art", previousPath);
    } catch (err) {
      console.error("Failed to delete previous exclusive art asset:", err);
    }
  }

  return NextResponse.json({
    asset: {
      id: storedAsset.id,
      fileName: file.name,
      url: storedAsset.url,
      mimeType: file.type || "image/*"
    }
  });
}
