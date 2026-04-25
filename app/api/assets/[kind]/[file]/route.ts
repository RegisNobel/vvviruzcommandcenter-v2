export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import {Readable} from "node:stream";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {canPubliclyReadCoverAsset} from "@/lib/repositories/public-site";
import {canPubliclyReadExclusiveArtAsset} from "@/lib/repositories/exclusive-offer";
import {resolveAssetPath} from "@/lib/server/storage";

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

function parseByteRangeHeader(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const [startToken, endToken] = rangeHeader.replace("bytes=", "").split("-", 2);
  const hasStart = startToken !== undefined && startToken !== "";
  const hasEnd = endToken !== undefined && endToken !== "";

  if (!hasStart && !hasEnd) {
    return null;
  }

  if (!hasStart && hasEnd) {
    const suffixLength = Number(endToken);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return "invalid";
    }

    const start = Math.max(0, fileSize - suffixLength);

    return {
      start,
      end: fileSize - 1
    };
  }

  const start = Number(startToken);
  const end = hasEnd ? Number(endToken) : fileSize - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return "invalid";
  }

  return {
    start,
    end: Math.min(end, fileSize - 1)
  };
}

export async function GET(
  request: Request,
  {
    params
  }: {
    params: Promise<{kind: string; file: string}>;
  }
) {
  try {
    const {kind, file} = await params;

    if (
      kind !== "audio" &&
      kind !== "background" &&
      kind !== "cover" &&
      kind !== "export" &&
      kind !== "site-icon" &&
      kind !== "exclusive-art"
    ) {
      return NextResponse.json({message: "Invalid asset type."}, {status: 400});
    }

    const isPublicAsset =
      kind === "site-icon" ||
      (kind === "cover" && (await canPubliclyReadCoverAsset(file))) ||
      (kind === "exclusive-art" && (await canPubliclyReadExclusiveArtAsset(file)));

    if (!isPublicAsset) {
      const auth = await requireAuthenticatedApiRequest(request);

      if (auth instanceof Response) {
        return auth;
      }
    }

    const filePath = await resolveAssetPath(kind, file);
    const stats = await fsPromises.stat(filePath);
    const contentDisposition =
      kind === "export"
        ? `attachment; filename="${file}"`
        : `inline; filename="${file}"`;
    const range = parseByteRangeHeader(request.headers.get("range"), stats.size);

    if (range === "invalid") {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stats.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store"
        }
      });
    }

    const headers = {
      "Content-Type": getContentType(file),
      "Content-Disposition": contentDisposition,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store"
    };

    if (range) {
      const stream = fs.createReadStream(filePath, {
        start: range.start,
        end: range.end
      });
      const chunkSize = range.end - range.start + 1;

      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`
        }
      });
    }

    const stream = fs.createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        ...headers,
        "Content-Length": stats.size.toString()
      }
    });
  } catch {
    return NextResponse.json({message: "Asset not found."}, {status: 404});
  }
}
