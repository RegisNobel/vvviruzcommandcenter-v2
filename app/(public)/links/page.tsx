import type {Metadata} from "next";

import {getLinksPageRelease, getSiteSettings} from "@/lib/repositories/public-site";
import {readLinkHubByPath} from "@/lib/repositories/link-hubs";
import {
  getPublicReleaseDiscoveryMetadata,
  createPassthroughParams,
  type LinksSearchParams
} from "@/lib/public-utils";
import {PublicLinkHubView} from "@/components/public-link-hub-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [siteSettings, hub] = await Promise.all([
    getSiteSettings(),
    readLinkHubByPath("links")
  ]);
  const content = siteSettings.site_content.links;
  const releaseId = hub?.releaseId || content.selected_release_id || "";
  const selectedRelease = await getLinksPageRelease(releaseId);
  const releaseMetadata = selectedRelease
    ? getPublicReleaseDiscoveryMetadata(selectedRelease)
    : null;

  return {
    title: selectedRelease
      ? releaseMetadata?.seoTitle
      : siteSettings.site_content.metadata.links_page_title,
    description:
      releaseMetadata?.metaDescription ||
      siteSettings.site_content.metadata.links_page_description,
    openGraph: selectedRelease
      ? {
          title: releaseMetadata?.socialShareTitle,
          description: releaseMetadata?.socialShareDescription,
          images: selectedRelease.cover_art_path
            ? [
                {
                  url: selectedRelease.cover_art_path,
                  alt: releaseMetadata?.coverArtAltText
                }
              ]
            : []
        }
      : undefined,
    twitter: selectedRelease
      ? {
          card: selectedRelease.cover_art_path ? "summary_large_image" : "summary",
          title: releaseMetadata?.socialShareTitle,
          description: releaseMetadata?.socialShareDescription,
          images: selectedRelease.cover_art_path ? [selectedRelease.cover_art_path] : []
        }
      : undefined
  };
}

export default async function PublicLinksPage({
  searchParams
}: {
  searchParams: Promise<LinksSearchParams>;
}) {
  const [siteSettings, rawSearchParams, hub] = await Promise.all([
    getSiteSettings(),
    searchParams,
    readLinkHubByPath("links")
  ]);
  const content = siteSettings.site_content.links;
  const passthroughParams = createPassthroughParams(rawSearchParams);
  const releaseId = hub?.releaseId || content.selected_release_id || "";
  const selectedRelease = await getLinksPageRelease(releaseId);

  return (
    <PublicLinkHubView
      selectedRelease={selectedRelease}
      siteSettings={siteSettings}
      passthroughParams={passthroughParams}
      hubPath="/links"
    />
  );
}
