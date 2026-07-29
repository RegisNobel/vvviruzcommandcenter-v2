export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistEditorialRelease} from "@/components/public-artist-editorial-release";
import {getArtistProfileDescription} from "@/lib/artist-profiles";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {readPublishedArtistEditorialRelease} from "@/lib/repositories/artist-profiles";

type Params = {slug: string; releaseSlug: string};

export async function generateMetadata({
  params
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const {slug, releaseSlug} = await params;
  const result = await readPublishedArtistEditorialRelease(slug, releaseSlug);
  if (!result) return {};
  const title = `${result.release.title} · ${result.profile.displayName}`;
  const description =
    result.release.description ||
    result.release.story ||
    getArtistProfileDescription(result.profile);
  const canonical = getPublicSiteUrl(
    `/artists/${result.profile.slug}/music/${result.release.slug}`
  );
  return {
    title,
    description,
    alternates: {canonical},
    openGraph: {
      title,
      description,
      url: canonical,
      images: result.release.coverArtUrl
        ? [
            {
              url: result.release.coverArtUrl,
              alt:
                result.release.coverArtAlt ||
                `${result.release.title} cover artwork`
            }
          ]
        : []
    }
  };
}

export default async function ArtistEditorialReleasePage({
  params
}: {
  params: Promise<Params>;
}) {
  const {slug, releaseSlug} = await params;
  const result = await readPublishedArtistEditorialRelease(slug, releaseSlug);
  if (!result) notFound();
  return (
    <PublicArtistEditorialRelease
      profile={result.profile}
      release={result.release}
    />
  );
}
