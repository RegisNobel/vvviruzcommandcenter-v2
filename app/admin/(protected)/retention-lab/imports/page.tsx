export const dynamic = "force-dynamic";

import {DatabaseZap} from "lucide-react";

import {RetentionImportCenter} from "@/components/retention-import-center";
import {readImportCenterOptions} from "@/lib/analytics/import-center-data";
import {listSpotifyImports} from "@/lib/analytics/spotify-import-service";

export default async function RetentionLabImportsPage() {
  const [options, imports] = await Promise.all([readImportCenterOptions(), listSpotifyImports({pageSize: 25})]);
  return <main className="px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><section className="panel px-4 py-6 sm:px-8"><div className="pill"><DatabaseZap size={12} />Promo / Retention Lab</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Spotify Import Center</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Safely validate, map, commit, and audit private Spotify for Artists exports. This workspace is an intake and provenance surface—not an analytics dashboard.</p></section><RetentionImportCenter artists={options.artists} canonicalArtistId={options.canonicalArtistId} imports={imports} releases={options.releases} /></div></main>;
}
