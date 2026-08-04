export const dynamic = "force-dynamic";

import {RetentionDashboardView} from "@/components/retention-dashboard-view";
import {readRetentionDashboard} from "@/lib/analytics/retention-dashboard";

type DashboardSearchParams = {
  releaseId?: string;
  campaignId?: string;
  range?: string;
  comparisonStatus?: string;
  comparisonConfidence?: string;
  comparisonRelease?: string;
  comparisonCampaign?: string;
  comparisonDateFrom?: string;
  comparisonDateTo?: string;
};

export default async function RetentionLabPage({searchParams}: {searchParams: Promise<DashboardSearchParams>}) {
  const query = await searchParams;
  const data = await readRetentionDashboard(query);
  return <RetentionDashboardView data={data} />;
}
