export const dynamic = "force-dynamic";
import {redirect} from "next/navigation";
import {readPromotionCampaign} from "@/lib/analytics/campaign-timeline-service";
export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const campaign = await readPromotionCampaign(id);
  redirect(`/admin/releases/${campaign.release.id}?manageCampaignId=${campaign.id}#campaign-management`);
}
