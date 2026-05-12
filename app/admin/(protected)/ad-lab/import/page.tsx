import {AdsImportForm} from "@/components/ads-import-form";
import {readReleaseSummaries} from "@/lib/server/releases";

export default async function AdminAdLabImportPage() {
  const releases = await readReleaseSummaries();

  return <AdsImportForm releases={releases} />;
}
