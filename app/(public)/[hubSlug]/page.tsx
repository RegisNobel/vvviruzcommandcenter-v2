import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";

import {readLinkHubByPath} from "@/lib/repositories/link-hubs";
import {getLinksPageRelease, getSiteSettings} from "@/lib/repositories/public-site";
import {
  getPublicReleaseDiscoveryMetadata,
  createPassthroughParams,
  type LinksSearchParams
} from "@/lib/public-utils";
import {PublicLinkHubView} from "@/components/public-link-hub-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{hubSlug: string}>;
}): Promise<Metadata> {
  const {hubSlug} = await params;
  if (!/^links[0-9]*$/.test(hubSlug)) {
    return {};
  }
  const hub = await readLinkHubByPath(hubSlug);
  if (!hub || !hub.isEnabled || !hub.releaseId) {
    return {};
  }
  const siteSettings = await getSiteSettings();
  const selectedRelease = await getLinksPageRelease(hub.releaseId);
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

export default async function PublicDynamicLinkHubPage({
  params,
  searchParams
}: {
  params: Promise<{hubSlug: string}>;
  searchParams: Promise<LinksSearchParams>;
}) {
  const {hubSlug} = await params;

  // Rule 1: V1 only supports paths matching ^links[0-9]*$
  if (!/^links[0-9]*$/.test(hubSlug)) {
    notFound();
  }

  // Look up hub from database
  const hub = await readLinkHubByPath(hubSlug);

  // Unknown hub path returns notFound()
  if (!hub) {
    notFound();
  }

  // Known disabled hub redirects to /links
  if (!hub.isEnabled) {
    redirect("/links");
  }

  // Known hub with no assigned release redirects to /links
  if (!hub.releaseId) {
    redirect("/links");
  }

  const [siteSettings, rawSearchParams] = await Promise.all([
    getSiteSettings(),
    searchParams
  ]);

  const selectedRelease = await getLinksPageRelease(hub.releaseId);
  if (!selectedRelease) {
    redirect("/links");
  }

  const passthroughParams = createPassthroughParams(rawSearchParams);

  return (
    <PublicLinkHubView
      selectedRelease={selectedRelease}
      siteSettings={siteSettings}
      passthroughParams={passthroughParams}
      hubPath={`/${hub.path}`}
    />
  );
}
