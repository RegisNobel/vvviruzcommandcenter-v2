import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistCatalog} from "@/components/public-artist-catalog";
import {getArtistProfileDescription} from "@/lib/artist-profiles";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {readPublishedArtistProfile} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{slug: string}>;
}): Promise<Metadata> {
  const {slug} = await params;
  const profile = await readPublishedArtistProfile(slug);
  if (!profile?.expansion.catalogEnabled) return {};
  const title = `${profile.expansion.catalogTitle} · ${profile.displayName}`;
  const description =
    profile.expansion.catalogIntro || getArtistProfileDescription(profile);
  return {
    title,
    description,
    alternates: {
      canonical: getPublicSiteUrl(`/artists/${profile.slug}/releases`)
    }
  };
}

export default async function ArtistCatalogPage({
  params
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  const profile = await readPublishedArtistProfile(slug);
  if (
    !profile?.expansion.catalogEnabled ||
    !profile.expansion.catalogReleaseIds.length
  ) {
    notFound();
  }
  return <PublicArtistCatalog profile={profile} />;
}
