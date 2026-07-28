export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {createPlaylist, readPlaylists} from "@/lib/repositories/playlists";
import {validatePrimaryPlatform} from "@/lib/validation";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and dashes."),
  description: z.string().default(""),
  coverImageUrl: z.string().default(""),
  spotifyPlaylistUrl: z.string().default(""),
  applePlaylistUrl: z.string().default(""),
  youtubePlaylistUrl: z.string().default(""),
  primaryPlatform: z.string().default("spotify"),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().default(0)
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const playlists = await readPlaylists({ archiveStatus: "active" });
    return NextResponse.json({playlists});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "playlist.list",
      fallbackMessage: "Playlists could not be loaded. Refresh the page and try again."
    });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const json = await request.json();
    const parsed = createPlaylistSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid playlist payload."},
        {status: 400}
      );
    }

    const data = parsed.data;

    if (!validatePrimaryPlatform(data.primaryPlatform)) {
      return NextResponse.json(
        {message: "Primary platform must be 'spotify', 'apple', or 'youtube'."},
        {status: 400}
      );
    }

    const playlist = await createPlaylist(data);

    revalidatePath("/admin/promo/playlists");
    revalidatePath("/admin/site");
    revalidatePath(`/listen/${playlist.slug}`);

    return NextResponse.json({playlist});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "playlist.create",
      fallbackMessage: "The playlist could not be created."
    });
  }
}
