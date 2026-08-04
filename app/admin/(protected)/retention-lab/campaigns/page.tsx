export const dynamic = "force-dynamic";
import {CalendarRange} from "lucide-react";
import {CampaignTimelineCenter} from "@/components/campaign-timeline-center";
import {listPromotionCampaigns} from "@/lib/analytics/campaign-timeline-service";
import {readImportCenterOptions} from "@/lib/analytics/import-center-data";
export default async function CampaignsPage() { const [options, campaigns] = await Promise.all([readImportCenterOptions(), listPromotionCampaigns({pageSize: 50})]); return <main className="px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><section className="panel px-4 py-6 sm:px-8"><div className="pill"><CalendarRange size={12} />Promo / Retention Lab</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Campaign Timeline</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Record confirmed paid-promotion intervals, pauses, resumptions, descriptive events, evidence, and overlap context. No listener-retention calculations are performed here.</p></section><CampaignTimelineCenter artists={options.artists} initialData={campaigns} releases={options.releases} /></div></main>; }
