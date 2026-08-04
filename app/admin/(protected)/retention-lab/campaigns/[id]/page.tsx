export const dynamic = "force-dynamic";
import {notFound} from "next/navigation";
import {CalendarClock} from "lucide-react";
import {CampaignTimelineEditor} from "@/components/campaign-timeline-editor";
import {readPromotionCampaign} from "@/lib/analytics/campaign-timeline-service";
export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) { try { const campaign = await readPromotionCampaign((await params).id); return <main className="px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] space-y-6"><section className="panel px-4 py-6 sm:px-8"><div className="pill"><CalendarClock size={12} />Retention Lab / Campaign detail</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{campaign.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Maintain authoritative intervals and descriptive events with explicit provenance and preserved correction history.</p></section><CampaignTimelineEditor initialCampaign={campaign} /></div></main>; } catch { notFound(); } }
