export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs/promises";
import path from "node:path";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {AUDIO_EXTENSIONS, MAX_AUDIO_MS} from "@/lib/constants";
import {getAudioDurationMs} from "@/lib/ffmpeg/probe";
import {storeAsset} from "@/lib/server/asset-storage";
import {ensureStorageDirs, uploadsDir} from "@/lib/server/storage";
import type {UploadResponse} from "@/lib/types";

const mimeToExtension: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/m4a": ".m4a",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a"
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  await ensureStorageDirs();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({message: "Audio file is required."}, {status: 400});
  }

  const detectedExtension =
    path.extname(file.name).toLowerCase() || mimeToExtension[file.type];

  if (!detectedExtension || !AUDIO_EXTENSIONS.has(detectedExtension)) {
    return NextResponse.json(
      {message: "Only mp3, wav, and m4a uploads are supported."},
      {status: 400}
    );
  }

  const storedFileName = `${crypto.randomUUID()}${detectedExtension}`;
  const filePath = path.join(uploadsDir, storedFileName);
  const data = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(filePath, data);

  const durationMs = await getAudioDurationMs(filePath);
  const storedAsset = await storeAsset({
    kind: "audio",
    fileName: storedFileName,
    data,
    contentType: file.type || "audio/*"
  });
  const payload: UploadResponse = {
    audio: {
      id: storedAsset.id,
      fileName: file.name,
      url: storedAsset.url,
      durationMs,
      originalDurationMs: durationMs,
      trimmed: false
    },
    requiresTrim: durationMs > MAX_AUDIO_MS
  };

  return NextResponse.json(payload);
}
