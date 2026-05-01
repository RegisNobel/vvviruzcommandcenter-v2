import {AdsImportForm} from "@/components/ads-import-form";
import {readReleaseSummaries} from "@/lib/server/releases";

export default async function AdminAdsImportPage() {
  const releases = await readReleaseSummaries();

  return <AdsImportForm releases={releases} />;
}
