export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import {Readable} from "node:stream";

import {NextResponse} from "next/server";

import {readSubscriberByDownloadToken} from "@/lib/repositories/audience";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";
import {resolveAssetPath} from "@/lib/server/storage";
import {slugify} from "@/lib/utils";

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({message: "Invalid download token."}, {status: 400});
  }

  const [subscriber, {offer, isAvailable}] = await Promise.all([
    readSubscriberByDownloadToken(token),
    readPublicExclusiveOffer()
  ]);

  if (!subscriber || !isAvailable) {
    return NextResponse.json({message: "Download unavailable."}, {status: 404});
  }

  try {
    const storedFileName = path.basename(offer.exclusive_track_file_path.trim());
    const filePath = await resolveAssetPath("exclusive-track", storedFileName);
    const stats = await fsPromises.stat(filePath);
    const safeTitle =
      slugify(offer.exclusive_track_title) || "vvviruz-exclusive-track";
    const downloadFileName = `${safeTitle}${path.extname(storedFileName)}`;
    const stream = fs.createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": getContentType(storedFileName),
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({message: "Download unavailable."}, {status: 404});
  }
}

