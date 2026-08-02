export const runtime = "nodejs";

import {NextResponse} from "next/server";
import {z} from "zod";

import {createBreakingBarzSubmission} from "@/lib/repositories/breaking-barz";
import {readSiteSettings} from "@/lib/repositories/site-settings";

const submissionSchema = z.object({
  songTitle: z.string().trim().min(1).max(160),
  artistNames: z.string().trim().min(1).max(300),
  lyricExcerpt: z.string().trim().min(1).max(600),
  summary: z.string().trim().max(300).optional().default(""),
  breakdown: z.string().trim().max(4000).optional().default(""),
  songUrl: z.string().trim().max(2000).optional().default(""),
  submitterName: z.string().trim().max(120).optional().default(""),
  submitterEmail: z.union([z.literal(""), z.string().trim().email().max(320)]).optional().default(""),
  website: z.string().max(0).optional().default("")
});

export async function POST(request: Request) {
  const settings = await readSiteSettings();
  const feature = settings.site_content.breaking_barz;
  if (!feature.is_enabled || !feature.submissions_enabled) {
    return NextResponse.json({message: "Suggestions are not open right now."}, {status: 404});
  }

  const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({message: parsed.error.issues[0]?.message || "Check the form and try again."}, {status: 400});
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || request.headers.get("x-real-ip") || "unknown";
  try {
    await createBreakingBarzSubmission({
      ...parsed.data,
      artistNames: parsed.data.artistNames.split(","),
      ipAddress
    });
    return NextResponse.json(
      {message: "Suggestion received. It will stay private until reviewed."},
      {status: 201}
    );
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Suggestion could not be sent."},
      {status: 400}
    );
  }
}
