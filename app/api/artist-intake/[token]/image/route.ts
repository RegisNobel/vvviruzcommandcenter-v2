export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";

import {NextResponse} from "next/server";
import sharp from "sharp";

import {IMAGE_EXTENSIONS} from "@/lib/constants";
import {
  consumeRateLimit,
  getClientIpAddress,
  retryAfterSeconds
} from "@/lib/public-rate-limit";
import {
  readArtistIntakeByToken,
  registerArtistIntakeAsset
} from "@/lib/repositories/artist-intakes";
import {deleteAsset, storeAsset} from "@/lib/server/asset-storage";

const mimeToExtension: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export async function POST(
  request: Request,
  {params}: {params: Promise<{token: string}>}
) {
  try {
    const {token} = await params;
    const intake = await readArtistIntakeByToken(token);
    if (!intake) {
      return NextResponse.json({message: "This intake link is invalid."}, {status: 404});
    }
    if (intake.status === "EXPIRED" || intake.status === "SUBMITTED") {
      return NextResponse.json(
        {message: "This intake is no longer accepting uploads."},
        {status: 409}
      );
    }

    const throttle = await consumeRateLimit({
      bucket: "artist-intake-image",
      key: getClientIpAddress(request),
      maxAttempts: 12,
      windowMs: 60 * 60 * 1000,
      blockMs: 30 * 60 * 1000
    });
    if (!throttle.allowed) {
      return NextResponse.json(
        {message: "Too many image uploads. Try again shortly."},
        {
          status: 429,
          headers: {"Retry-After": String(retryAfterSeconds(throttle.retryAfterMs))}
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({message: "Choose an image to upload."}, {status: 400});
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        {message: "Images must be 8 MB or smaller."},
        {status: 400}
      );
    }

    const extension =
      path.extname(file.name).toLowerCase() || mimeToExtension[file.type];
    if (!extension || !IMAGE_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {message: "Choose a jpg, jpeg, png, or webp image."},
        {status: 400}
      );
    }

    const original = Buffer.from(await file.arrayBuffer());
    const optimized = await sharp(original)
      .rotate()
      .resize({width: 1600, height: 1600, fit: "inside", withoutEnlargement: true})
      .webp({quality: 86})
      .toBuffer();
    const fileName = `${crypto.randomUUID()}.webp`;
    const stored = await storeAsset({
      kind: "artist-intake-image",
      fileName,
      data: optimized,
      contentType: "image/webp"
    });
    try {
      await registerArtistIntakeAsset(token, stored.url);
    } catch (error) {
      await deleteAsset("artist-intake-image", stored.url);
      throw error;
    }

    return NextResponse.json({url: stored.url});
  } catch (error) {
    console.error("Artist intake image upload failed:", error);
    return NextResponse.json(
      {message: "The image could not be uploaded."},
      {status: 500}
    );
  }
}
