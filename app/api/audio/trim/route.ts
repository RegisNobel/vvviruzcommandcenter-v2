export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs/promises";
import path from "node:path";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {MAX_AUDIO_MS} from "@/lib/constants";
import {getAudioDurationMs} from "@/lib/ffmpeg/probe";
import {trimAudioClip} from "@/lib/ffmpeg/trim";
import {resolveAssetToLocalPath, storeAsset} from "@/lib/server/asset-storage";
import {ensureStorageDirs, uploadsDir} from "@/lib/server/storage";

const trimSchema = z
  .object({
    audioId: z.string().min(1),
    startMs: z.number().min(0),
    endMs: z.number().min(1)
  })
  .refine((value) => value.endMs > value.startMs, {
    message: "End must be after start."
  })
  .refine((value) => value.endMs - value.startMs <= MAX_AUDIO_MS, {
    message: "Trimmed clip must be 30 seconds or shorter."
  });

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  await ensureStorageDirs();

  const json = await request.json();
  const parsed = trimSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {message: parsed.error.issues[0]?.message ?? "Invalid trim payload."},
      {status: 400}
    );
  }

  const {audioId, startMs, endMs} = parsed.data;
  const inputPath = await resolveAssetToLocalPath("audio", audioId);
  const outputFileName = `${path.parse(audioId).name}-trim-${crypto.randomUUID()}.m4a`;
  const outputPath = path.join(uploadsDir, outputFileName);

  await trimAudioClip({
    inputPath,
    outputPath,
    startMs,
    endMs
  });

  const durationMs = await getAudioDurationMs(outputPath);
  const storedAsset = await storeAsset({
    kind: "audio",
    fileName: outputFileName,
    data: await fs.readFile(outputPath),
    contentType: "audio/mp4"
  });

  return NextResponse.json({
    audio: {
      id: storedAsset.id,
      fileName: outputFileName,
      url: storedAsset.url,
      durationMs,
      originalDurationMs: durationMs,
      trimmed: true
    }
  });
}
