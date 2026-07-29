import Link from "next/link";
import {notFound} from "next/navigation";

import {ArtistProfileForm} from "@/components/artist-profile-form";
import {readArtistProfileForAdmin} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export default async function ArtistEditorPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const artist = await readArtistProfileForAdmin(id);
  if (!artist) notFound();

  return (
    <div className="space-y-6">
      <Link className="text-sm font-semibold text-muted hover:text-ink" href="/admin/artists">
        ← Artists
      </Link>
      <div>
        <p className="field-label">Managed collaborator</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{artist.displayName}</h1>
      </div>
      <ArtistProfileForm initialRecord={artist} />
    </div>
  );
}
