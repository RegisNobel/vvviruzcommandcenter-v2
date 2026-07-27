import "server-only";

import type {SiteSettingsRecord} from "@/lib/types";
import {getPublicHttpUrl, getPublicSiteUrl} from "@/lib/public-site-url";
import {getSiteIconUrl} from "@/lib/site-assets";

export const PUBLIC_ARTIST_ID = `${getPublicSiteUrl("/")}#artist`;
export const PUBLIC_WEBSITE_ID = `${getPublicSiteUrl("/")}#website`;

function uniquePublicUrls(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => getPublicHttpUrl(value)).filter(Boolean))
  );
}

export function buildPublicSiteJsonLd(siteSettings: SiteSettingsRecord) {
  const siteUrl = getPublicSiteUrl("/");
  const description =
    siteSettings.long_bio.trim() ||
    siteSettings.short_bio.trim() ||
    siteSettings.site_content.metadata.site_description.trim();
  const sameAs = uniquePublicUrls(
    siteSettings.social_links.map((socialLink) => socialLink.url)
  );
  const image = getPublicHttpUrl(
    getSiteIconUrl(siteSettings.site_content.about.artist_image_file)
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": PUBLIC_ARTIST_ID,
        name: siteSettings.artist_name,
        alternateName: "vvviruz",
        url: siteUrl,
        description,
        image: image || undefined,
        jobTitle: "Music artist",
        sameAs
      },
      {
        "@type": "WebSite",
        "@id": PUBLIC_WEBSITE_ID,
        url: siteUrl,
        name: siteSettings.site_content.metadata.site_title || siteSettings.artist_name,
        description: siteSettings.site_content.metadata.site_description,
        publisher: {"@id": PUBLIC_ARTIST_ID},
        inLanguage: "en"
      }
    ]
  };
}
