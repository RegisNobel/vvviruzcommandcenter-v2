export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowLeft, MailPlus} from "lucide-react";

import {AudienceAdminPage} from "@/components/audience-admin-page";
import {listCampaigns, listEmailSendLogs, listSubscribers, readAudienceOverview} from "@/lib/repositories/audience";
import {readExclusiveOfferSettings} from "@/lib/repositories/exclusive-offer";
import {listExclusiveArtFiles, listExclusiveTrackFiles} from "@/lib/server/storage";

export default async function AdminAudiencePageRoute() {
  const [
    overview,
    subscribers,
    exclusiveOfferState,
    campaigns,
    sendLogs,
    trackFileOptions,
    artFileOptions
  ] = await Promise.all([
    readAudienceOverview(),
    listSubscribers({status: "all"}),
    readExclusiveOfferSettings(),
    listCampaigns(),
    listEmailSendLogs(),
    listExclusiveTrackFiles(),
    listExclusiveArtFiles()
  ]);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <MailPlus size={12} />
                Audience
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
                Email capture and outreach
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
                Manage exclusive-track signups, subscribers, and lean campaign sends
                from one protected workspace. Public capture lives on <code>/exclusive</code>;
                audience operations stay here.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin">
              <ArrowLeft size={16} />
              Back to Overview
            </Link>
          </div>
        </section>

        <AudienceAdminPage
          initialCampaigns={campaigns}
          initialExclusiveOffer={exclusiveOfferState.exclusive}
          initialOverview={overview}
          initialSendLogs={sendLogs}
          initialSubscribers={subscribers}
          initialTrackArtOptions={artFileOptions}
          initialTrackFileOptions={trackFileOptions}
        />
      </div>
    </main>
  );
}
