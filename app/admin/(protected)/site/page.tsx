import Link from "next/link";
import {ArrowLeft, Globe2} from "lucide-react";

import {SiteSettingsEditor} from "@/components/site-settings-editor";
import {readReleaseSummaries} from "@/lib/repositories/releases";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import {
  listExclusiveArtFiles,
  listExclusiveTrackFiles,
  listSiteIconFiles
} from "@/lib/server/storage";

export default async function AdminSitePage() {
  const [
    siteSettings,
    releaseSummaries,
    siteIconOptions,
    exclusiveTrackFileOptions,
    exclusiveTrackArtOptions
  ] = await Promise.all([
    readSiteSettings(),
    readReleaseSummaries(),
    listSiteIconFiles(),
    listExclusiveTrackFiles(),
    listExclusiveArtFiles()
  ]);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel px-6 py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Globe2 size={12} />
                Public Site
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
                Public site management
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Manage the public vvviruz website separately from daily release
                operations. This page controls shared profile copy, public imagery,
                homepage content, the mobile link hub, exclusive track offer, and
                future-ready tracking settings.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin">
              <ArrowLeft size={16} />
              Back to Overview
            </Link>
          </div>
        </section>

        <SiteSettingsEditor
          exclusiveTrackArtOptions={exclusiveTrackArtOptions}
          exclusiveTrackFileOptions={exclusiveTrackFileOptions}
          initialSiteSettings={siteSettings}
          releaseOptions={releaseSummaries}
          siteIconOptions={siteIconOptions}
        />
      </div>
    </main>
  );
}
