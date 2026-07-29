import Link from "next/link";

import {listArtistProfiles} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  const artists = await listArtistProfiles();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="field-label">Managed collaborators</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Artists</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Shape private drafts, collect approval on a versioned preview, then publish a stable
            profile and connect credits across the catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="action-button-secondary" href="/admin/artists/intake">
            Artist intake
          </Link>
          <Link className="action-button-primary" href="/admin/artists/new">
            New artist
          </Link>
        </div>
      </header>

      <section className="command-surface overflow-hidden">
        {artists.length ? (
          <div className="divide-y divide-edge">
            {artists.map((artist) => (
              <Link
                className="grid gap-3 px-5 py-5 transition hover:bg-surface-hover sm:grid-cols-[1fr_auto] sm:items-center"
                href={`/admin/artists/${artist.id}`}
                key={artist.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{artist.displayName}</h2>
                    <span className="status-badge-neutral">{artist.workflowStatus}</span>
                    {artist.publishedAt ? (
                      <span className="status-badge-ready">LIVE VERSION</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    /artists/{artist.slug}
                    {artist.location ? ` · ${artist.location}` : ""}
                    {` · ${artist.themeFamily}`}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {artist._count.versions} version{artist._count.versions === 1 ? "" : "s"} ·{" "}
                  {artist._count.releaseCredits + artist._count.appearsOnCredits} linked credit
                  {artist._count.releaseCredits + artist._count.appearsOnCredits === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold text-ink">No managed artists yet.</p>
            <p className="mt-2 text-sm text-muted">Create the first collaborator profile to begin.</p>
          </div>
        )}
      </section>
    </div>
  );
}
