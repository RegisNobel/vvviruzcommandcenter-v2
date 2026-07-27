export const dynamic = "force-dynamic";

import type {Metadata} from "next";

import {getSiteSettings} from "@/lib/repositories/public-site";
import {listPublicFanUpdates} from "@/lib/repositories/fan-content";
import {stringifyJsonLd} from "@/lib/json-ld";
import {buildPublicSiteJsonLd} from "@/lib/public-site-schema";

import {PublicSiteChrome} from "@/components/public-site-chrome";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const metadata = siteSettings.site_content.metadata;

  return {
    title: {
      default: `${metadata.site_title || siteSettings.artist_name} | Home`,
      template: `${metadata.site_title || siteSettings.artist_name} | %s`
    },
    description: metadata.site_description
  };
}

export default async function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [siteSettings, latestIntel] = await Promise.all([
    getSiteSettings(),
    listPublicFanUpdates().catch(() => {
      console.error("[latest-intel] Public Intel query failed; the rail was omitted.");
      return [];
    })
  ]);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLd(buildPublicSiteJsonLd(siteSettings))
        }}
        type="application/ld+json"
      />
      <PublicSiteChrome latestIntel={latestIntel} siteSettings={siteSettings}>
        {children}
      </PublicSiteChrome>
    </>
  );
}
