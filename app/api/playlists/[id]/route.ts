export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";

import {prisma} from "@/lib/db/prisma";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  archivePlaylist,
  restorePlaylist,
  updatePlaylist
} from "@/lib/repositories/playlists";
import {validatePrimaryPlatform} from "@/lib/validation";

const updatePlaylistSchema = z.object({
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
  isArchived: z.boolean().optional(),
  sortOrder: z.number().default(0),
  featuredReleaseId: z.string().nullish()
});

function revalidatePlaylist(playlist: any, slugOverride?: string) {
  const slugVal = slugOverride || playlist.slug;
  revalidatePath("/admin/promo/playlists");
  revalidatePath(`/admin/promo/playlists/${playlist.id}`);
  revalidatePath(`/listen/${slugVal}`);
  revalidatePath("/admin/site");

  if (playlist.releases) {
    for (const rel of playlist.releases) {
      if (rel.release?.slug) {
        revalidatePath(`/listen/${slugVal}/${rel.release.slug}`);
      }
    }
  }
}

export async function PUT(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const json = await request.json();
    const parsed = updatePlaylistSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid update payload."},
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

    // Fetch before state for old slug revalidation
    const oldPlaylist = await prisma.playlist.findUnique({
      where: { id },
      include: { releases: { include: { release: true } } }
    });

    if (!oldPlaylist) {
      return NextResponse.json({message: "Playlist not found."}, {status: 404});
    }

    // Handle soft archiving lifecycle switches
    let updated;
    let summary;
    if (data.isArchived !== undefined && data.isArchived !== oldPlaylist.isArchived) {
      if (data.isArchived) {
        updated = await archivePlaylist(id);
      } else {
        updated = await restorePlaylist(id);
      }
    } else {
      const res = await updatePlaylist(id, {
        name: data.name,
        slug: data.slug,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        spotifyPlaylistUrl: data.spotifyPlaylistUrl,
        applePlaylistUrl: data.applePlaylistUrl,
        youtubePlaylistUrl: data.youtubePlaylistUrl,
        primaryPlatform: data.primaryPlatform,
        isPublic: data.isPublic,
        sortOrder: data.sortOrder,
        featuredReleaseId: data.featuredReleaseId ?? null
      });
      updated = res.playlist;
      summary = res.summary;
    }

    // Fetch final state for revalidation
    const newPlaylist = await prisma.playlist.findUnique({
      where: { id },
      include: { releases: { include: { release: true } } }
    });

    if (oldPlaylist) {
      revalidatePlaylist(oldPlaylist);
    }
    if (newPlaylist) {
      revalidatePlaylist(newPlaylist);
      // Revalidate old slug route if it was changed
      if (oldPlaylist && oldPlaylist.slug !== newPlaylist.slug) {
        revalidatePlaylist(oldPlaylist, oldPlaylist.slug);
      }
    }

    return NextResponse.json({playlist: updated, summary});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update playlist.";
    return NextResponse.json({message: msg}, {status: 500});
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const oldPlaylist = await prisma.playlist.findUnique({
      where: { id },
      include: { releases: { include: { release: true } } }
    });

    if (!oldPlaylist) {
      return NextResponse.json({message: "Playlist not found."}, {status: 404});
    }

    const playlist = await archivePlaylist(id);

    if (oldPlaylist) {
      revalidatePlaylist(oldPlaylist);
    }

    return NextResponse.json({playlist});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to archive playlist.";
    return NextResponse.json({message: msg}, {status: 500});
  }
}
