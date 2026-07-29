import Link from "next/link";

import {ArtistProfileForm} from "@/components/artist-profile-form";

export const dynamic = "force-dynamic";

export default function NewArtistPage() {
  return (
    <div className="space-y-6">
      <Link className="text-sm font-semibold text-muted hover:text-ink" href="/admin/artists">
        ← Artists
      </Link>
      <div>
        <p className="field-label">Managed collaborator</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">New artist</h1>
      </div>
      <ArtistProfileForm />
    </div>
  );
}
