export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {createEmptyRelease, summarizeRelease, touchRelease} from "@/lib/releases";
import {readReleaseSummaries, saveRelease} from "@/lib/server/releases";

const createReleaseSchema = z.object({
  title: z.string().trim().min(1),
  type: z.enum(["nerdcore", "mainstream"]).default("nerdcore"),
  release_date: z.string().default(""),
  collaborator: z.boolean().default(false),
  collaborator_name: z.string().default(""),
  upc: z.string().default(""),
  isrc: z.string().default(""),
  streaming_links: z
    .object({
      spotify: z.string().default(""),
      apple_music: z.string().default(""),
      youtube: z.string().default("")
    })
    .default({
      spotify: "",
      apple_music: "",
      youtube: ""
    })
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const releases = await readReleaseSummaries();

  return NextResponse.json({releases});
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const json = await request.json();
  const parsed = createReleaseSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {message: parsed.error.issues[0]?.message ?? "Invalid release payload."},
      {status: 400}
    );
  }

  const release = touchRelease(createEmptyRelease(parsed.data));

  await saveRelease(release);

  revalidateTag(PUBLIC_CACHE_TAGS.releases);
  revalidateTag(PUBLIC_CACHE_TAGS.releaseCategories);

  return NextResponse.json({
    release,
    summary: summarizeRelease(release)
  });
}
