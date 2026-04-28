export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {resolveAssetToLocalPath} from "@/lib/server/asset-storage";
import {transcribeAudioToLyrics} from "@/lib/transcription";

const transcriptionSchema = z.object({
  audioId: z.string().min(1),
  language: z.enum(["auto", "en", "fr", "es"]).default("auto")
});

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const json = await request.json();
  const parsed = transcriptionSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({message: "Audio asset is required."}, {status: 400});
  }

  try {
    const audioPath = await resolveAssetToLocalPath("audio", parsed.data.audioId);
    const result = await transcribeAudioToLyrics(audioPath, parsed.data.language);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Transcription failed unexpectedly."
      },
      {status: 500}
    );
  }
}
