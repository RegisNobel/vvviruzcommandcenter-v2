export const dynamic = "force-dynamic";

import type {Metadata} from "next";

import {getSiteSettings} from "@/lib/repositories/public-site";

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
  const siteSettings = await getSiteSettings();

  return (
    <PublicSiteChrome siteSettings={siteSettings}>{children}</PublicSiteChrome>
  );
}
