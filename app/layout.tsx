import type {Metadata} from "next";

import "@/app/globals.css";

import {PublicMetaPixel} from "@/components/public-meta-pixel";

import {getSiteSettings} from "@/lib/repositories/public-site";
import {getPublicSiteBaseUrl} from "@/lib/public-site-url";

const publicSiteUrl = getPublicSiteBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: "vvviruz",
  description:
    "Official vvviruz artist hub with music releases, artist info, and direct listening links."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getSiteSettings();

  return (
    <html lang="en">
      <head>
        <PublicMetaPixel
          enabled={siteSettings.site_content.analytics.meta_pixel_enabled}
          pixelId={siteSettings.site_content.analytics.meta_pixel_id}
        />
      </head>
      <body className="bg-[#090b0f] text-[#f3eddf] antialiased">{children}</body>
    </html>
  );
}
