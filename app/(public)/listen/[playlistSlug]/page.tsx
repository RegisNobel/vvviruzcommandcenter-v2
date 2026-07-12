import {notFound, redirect} from "next/navigation";
import {readPublicPlaylistLanding} from "@/lib/repositories/playlists";
import {withApprovedAttribution} from "@/lib/playlist-analytics";

export const dynamic = "force-dynamic";

export default async function PublicPlaylistLandingPage({
  params,
  searchParams
}: {
  params: Promise<{playlistSlug: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {playlistSlug} = await params;
  const incoming = await searchParams;
  const approvedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) approvedParams.set(key, firstValue);
  }
  const data = await readPublicPlaylistLanding(playlistSlug);

  if (!data || !data.playlist) {
    notFound();
  }

  // Redirect to first active release membership if available
  const firstMember = data.memberships[0];
  if (firstMember && firstMember.release_slug) {
    redirect(
      withApprovedAttribution(
        `/listen/${playlistSlug}/${firstMember.release_slug}`,
        approvedParams
      )
    );
  }

  // Fallback to home/links hub if no active members
  redirect(withApprovedAttribution("/links", approvedParams));
}
