import "server-only";

import {prisma} from "@/lib/db/prisma";
import type {ArtistOption, RetentionReleaseOption} from "@/lib/analytics/import-center-types";

export async function readImportCenterOptions(): Promise<{
  artists: ArtistOption[];
  releases: RetentionReleaseOption[];
  canonicalArtistId: string | null;
}> {
  const [artists, releases] = await Promise.all([
    prisma.artistProfile.findMany({
      orderBy: [{displayName: "asc"}],
      select: {id: true, displayName: true, slug: true}
    }),
    prisma.release.findMany({
      orderBy: [{releaseDate: "desc"}, {title: "asc"}],
      select: {
        id: true,
        title: true,
        slug: true,
        releaseDate: true,
        isPublished: true,
        type: true,
        upc: true,
        isrc: true,
        primaryArtistProfileId: true,
        collaboratorName: true
      }
    })
  ]);

  return {
    artists,
    releases: releases.map((release) => ({
      id: release.id,
      title: release.title,
      slug: release.slug,
      release_date: release.releaseDate?.toISOString().slice(0, 10),
      collaborator_name: release.collaboratorName || undefined,
      status: release.isPublished ? "Published" : "Draft",
      type: release.type,
      upc: release.upc || undefined,
      isrc: release.isrc || undefined,
      artistProfileId: release.primaryArtistProfileId || ""
    })),
    canonicalArtistId: artists.find((artist) => artist.slug === "vvviruz")?.id ?? null
  };
}
