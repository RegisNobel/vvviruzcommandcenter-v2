export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";

import {AdsBatchDashboard} from "@/components/ads-batch-dashboard";
import {readAdImportBatchDetail} from "@/lib/repositories/ads";

export default async function AdminAdBatchPage({
  params
}: {
  params: Promise<{batchId: string}>;
}) {
  try {
    const {batchId} = await params;
    const detail = await readAdImportBatchDetail(batchId);

    return <AdsBatchDashboard detail={detail} />;
  } catch {
    notFound();
  }
}
