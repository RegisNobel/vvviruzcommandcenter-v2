import type {Metadata} from "next";
import {headers} from "next/headers";
import {notFound} from "next/navigation";

import {PlaylistEditor} from "@/components/playlist-editor";
import {readPlaylistAnalytics, readPlaylistWithMemberships} from "@/lib/repositories/playlists";
import {readReleaseSummaries} from "@/lib/repositories/releases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Playlist"
};

async function getBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/g, "");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

export default async function AdminPlaylistDetailPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  const [baseUrl, playlistData, releases, analytics] = await Promise.all([
    getBaseUrl(),
    readPlaylistWithMemberships(id),
    readReleaseSummaries(),
    readPlaylistAnalytics(id)
  ]);

  if (!playlistData) {
    notFound();
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <PlaylistEditor
          baseUrl={baseUrl}
          memberships={playlistData.memberships}
          playlist={playlistData.playlist}
          releaseOptions={releases}
          analytics={analytics}
        />
      </div>
    </main>
  );
}
