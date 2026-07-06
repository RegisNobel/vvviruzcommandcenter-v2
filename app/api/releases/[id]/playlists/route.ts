export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";

import {prisma} from "@/lib/db/prisma";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {syncReleasePlaylistMemberships} from "@/lib/repositories/playlists";

const syncReleasePlaylistsSchema = z.object({
  memberships: z.array(
    z.object({
      playlistId: z.string(),
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
    const {id: releaseId} = await params;
    const json = await request.json();
    const parsed = syncReleasePlaylistsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid release memberships payload."},
        {status: 400}
      );
    }

    const affectedPlaylistIds = await syncReleasePlaylistMemberships(
      releaseId,
      parsed.data.memberships
    );

    // Fetch and revalidate all affected playlists
    if (affectedPlaylistIds && affectedPlaylistIds.length > 0) {
      const affectedPlaylists = await prisma.playlist.findMany({
        where: {
          id: { in: affectedPlaylistIds }
        },
        include: {
          releases: { include: { release: true } }
        }
      });

      for (const playlist of affectedPlaylists) {
        revalidatePlaylist(playlist);
      }
    }

    // Also revalidate the release detail page itself (since it holds the playlists list)
    revalidatePath(`/admin/releases/${releaseId}`);

    const updated = await prisma.playlistRelease.findMany({
      where: { releaseId },
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
      updatedAt: m.updatedAt.toISOString()
    }));

    return NextResponse.json({ok: true, memberships: records});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to sync release memberships.";
    return NextResponse.json({message: msg}, {status: 500});
  }
}
