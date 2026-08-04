export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";
import {FileClock} from "lucide-react";

import {RetentionImportDetail, type ImportDetailRecord} from "@/components/retention-import-detail";
import {readImportCenterOptions} from "@/lib/analytics/import-center-data";
import {readSpotifyImportDetail} from "@/lib/analytics/spotify-import-service";
import {AdminError} from "@/lib/server/admin-error-response";

export default async function RetentionImportDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  let detail;
  try { detail = await readSpotifyImportDetail(id); }
  catch (error) { if (error instanceof AdminError && error.code === "NOT_FOUND") notFound(); throw error; }
  const options = await readImportCenterOptions();
  const serialized = JSON.parse(JSON.stringify(detail)) as ImportDetailRecord;
  return <main className="px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><section className="panel px-4 py-6 sm:px-8"><div className="pill"><FileClock size={12} />Retention Lab / Import detail</div><h1 className="mt-4 break-words text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{serialized.originalFilename}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Immutable import provenance, coverage, validation, reconciliation, and lifecycle controls.</p></section><RetentionImportDetail artists={options.artists} canonicalArtistId={options.canonicalArtistId} initialImport={serialized} releases={options.releases} /></div></main>;
}
