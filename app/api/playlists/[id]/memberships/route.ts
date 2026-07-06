export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";

import {prisma} from "@/lib/db/prisma";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {syncPlaylistMemberships} from "@/lib/repositories/playlists";

const syncMembershipsSchema = z.object({
  memberships: z.array(
    z.object({
      releaseId: z.string(),
      position: z.number(),
      spotifyTargetUrl: z.string().default(""),
      spotifyTrackUrl: z.string().default(""),
      spotifyTargetMode: z.string().default("manual"),
      appleTargetUrl: z.string().default(""),
      youtubeTargetUrl: z.string().default(""),
      isActive: z.boolean().default(true)
    })
  )
});

function revalidatePlaylist(playlist: any) {
  revalidatePath("/admin/promo/playlists");
  revalidatePath(`/admin/promo/playlists/${playlist.id}`);
  revalidatePath(`/listen/${playlist.slug}`);
  revalidatePath("/admin/site");

  if (playlist.releases) {
    for (const rel of playlist.releases) {
      if (rel.release?.slug) {
        revalidatePath(`/listen/${playlist.slug}/${rel.release.slug}`);
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
    const {id: playlistId} = await params;
    const json = await request.json();
    const parsed = syncMembershipsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid memberships payload."},
        {status: 400}
      );
    }

    await syncPlaylistMemberships(playlistId, parsed.data.memberships);

    const newPlaylist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: { releases: { include: { release: true } } }
    });

    if (newPlaylist) {
      revalidatePlaylist(newPlaylist);
    }

    const updated = await prisma.playlistRelease.findMany({
      where: { playlistId },
      include: { release: true },
      orderBy: { position: "asc" }
    });

    const records = updated.map((m) => ({
      playlistId: m.playlistId,
      releaseId: m.releaseId,
      position: m.position,
      spotifyTargetUrl: m.spotifyTargetUrl,
      spotifyTrackUrl: m.spotifyTrackUrl,
      spotifyTargetMode: m.spotifyTargetMode,
      appleTargetUrl: m.appleTargetUrl,
      youtubeTargetUrl: m.youtubeTargetUrl,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      release_title: m.release?.title ?? undefined,
      release_slug: m.release?.slug ?? undefined,
      release_cover_art_path: m.release?.coverArtPath ?? undefined,
      release_type: m.release?.type ?? undefined,
      release_collaborator: m.release?.collaborator ?? undefined,
      release_collaborator_name: m.release?.collaboratorName ?? undefined,
      release_public_description: m.release?.publicDescription ?? undefined,
      release_is_published: m.release?.isPublished ?? undefined
    }));

    return NextResponse.json({ok: true, memberships: records});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to sync memberships.";
    return NextResponse.json({message: msg}, {status: 500});
  }
}
