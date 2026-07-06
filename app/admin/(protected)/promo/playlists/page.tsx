import type {Metadata} from "next";
import {headers} from "next/headers";

import {PlaylistsDashboard} from "@/components/playlists-dashboard";
import {readPlaylists} from "@/lib/repositories/playlists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playlists"
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

export default async function AdminPlaylistsPage({
  searchParams
}: {
  searchParams: Promise<{status?: string | string[]}>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusFilter = rawStatus === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  const [baseUrl, playlists] = await Promise.all([
    getBaseUrl(),
    readPlaylists({ archiveStatus: statusFilter === "ARCHIVED" ? "archived" : "active" })
  ]);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <PlaylistsDashboard
          baseUrl={baseUrl}
          initialPlaylists={playlists}
          initialStatusFilter={statusFilter}
        />
      </div>
    </main>
  );
}
