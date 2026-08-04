export const dynamic = "force-dynamic";

import {GitMerge} from "lucide-react";

import {RetentionMappingCenter} from "@/components/retention-mapping-center";
import {readImportCenterOptions} from "@/lib/analytics/import-center-data";
import {listMappingQueue, listReleaseAliases} from "@/lib/analytics/release-mapping-service";

export default async function RetentionLabMappingsPage({searchParams}: {searchParams: Promise<{import_id?: string}>}) {
  const {import_id: importId} = await searchParams;
  const [options, queue, aliases] = await Promise.all([readImportCenterOptions(), listMappingQueue({pageSize: 25, importId}), listReleaseAliases({pageSize: 25, status: "ACTIVE"})]);
  return <main className="px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><section className="panel px-4 py-6 sm:px-8"><div className="pill"><GitMerge size={12} />Promo / Retention Lab</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Mapping Queue</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Resolve valid imported rows that still need catalog identity. Unmatched rows are not rejected; their normalized source history remains intact.</p></section><RetentionMappingCenter aliases={aliases} artists={options.artists} initialImportId={importId || ""} queue={queue} releases={options.releases} /></div></main>;
}
