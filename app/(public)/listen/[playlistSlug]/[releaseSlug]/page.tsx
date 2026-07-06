import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicPlaylistCampaignView} from "@/components/public-playlist-campaign-view";
import {readPublicPlaylistCampaign} from "@/lib/repositories/playlists";
import {getSiteSettings} from "@/lib/repositories/public-site";
import {getPublicReleaseDiscoveryMetadata} from "@/lib/public-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{playlistSlug: string; releaseSlug: string}>;
}): Promise<Metadata> {
  const {playlistSlug, releaseSlug} = await params;
  const data = await readPublicPlaylistCampaign(playlistSlug, releaseSlug);

  if (!data) {
    return {};
  }

  const {playlist, focusedMembership} = data;
  const releaseMeta = getPublicReleaseDiscoveryMetadata({
    title: focusedMembership.release_title,
    public_description: focusedMembership.release_public_description,
    seo_title: focusedMembership.release_title,
    meta_description: focusedMembership.release_public_description,
    social_share_title: focusedMembership.release_title,
    social_share_description: focusedMembership.release_public_description,
    cover_art_alt_text: `${focusedMembership.release_title} Cover Art`
  });

  return {
    title: `${focusedMembership.release_title} | ${playlist.name}`,
    description: releaseMeta.metaDescription || playlist.description,
    openGraph: focusedMembership.release_cover_art_path
      ? {
          title: releaseMeta.socialShareTitle,
          description: releaseMeta.socialShareDescription,
          images: [
            {
              url: focusedMembership.release_cover_art_path,
              alt: releaseMeta.coverArtAltText
            }
          ]
        }
      : undefined,
    twitter: focusedMembership.release_cover_art_path
      ? {
          card: "summary_large_image",
          title: releaseMeta.socialShareTitle,
          description: releaseMeta.socialShareDescription,
          images: [focusedMembership.release_cover_art_path]
        }
      : undefined
  };
}

export default async function PublicPlaylistCampaignPage({
  params
}: {
  params: Promise<{playlistSlug: string; releaseSlug: string}>;
}) {
  const {playlistSlug, releaseSlug} = await params;
  const [data, siteSettings] = await Promise.all([
    readPublicPlaylistCampaign(playlistSlug, releaseSlug),
    getSiteSettings()
  ]);

  if (!data) {
    notFound();
  }

  return (
    <PublicPlaylistCampaignView
      focusedMembership={data.focusedMembership}
      playlist={data.playlist}
      previewMemberships={data.previewMemberships}
      siteSettings={siteSettings}
    />
  );
}
