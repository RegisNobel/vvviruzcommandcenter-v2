import {notFound, redirect} from "next/navigation";
import {readPublicPlaylistLanding} from "@/lib/repositories/playlists";

export const dynamic = "force-dynamic";

export default async function PublicPlaylistLandingPage({
  params
}: {
  params: Promise<{playlistSlug: string}>;
}) {
  const {playlistSlug} = await params;
  const data = await readPublicPlaylistLanding(playlistSlug);

  if (!data || !data.playlist) {
    notFound();
  }

  // Redirect to first active release membership if available
  const firstMember = data.memberships[0];
  if (firstMember && firstMember.release_slug) {
    redirect(`/listen/${playlistSlug}/${firstMember.release_slug}`);
  }

  // Fallback to home/links hub if no active members
  redirect("/links");
}
