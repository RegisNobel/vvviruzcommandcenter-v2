import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistProfile} from "@/components/public-artist-profile";
import {getArtistProfileDescription} from "@/lib/artist-profiles";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {readPublishedArtistProfile} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
  const {slug} = await params;
  const profile = await readPublishedArtistProfile(slug);
  if (!profile) return {};
  const title = profile.seo.title || `${profile.displayName} — Artist Profile`;
  const description = profile.seo.description || getArtistProfileDescription(profile);
  const socialImage = profile.seo.socialImageUrl || profile.profileImage.url;
  return {
    title,
    description,
    alternates: {canonical: getPublicSiteUrl(`/artists/${profile.slug}`)},
    openGraph: {
      title,
      description,
      type: "profile",
      images: socialImage ? [{url: socialImage, alt: profile.profileImage.alt}] : []
    }
  };
}

export default async function ArtistProfilePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const profile = await readPublishedArtistProfile(slug);
  if (!profile) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "@id": getPublicSiteUrl(`/artists/${profile.slug}#artist`),
    name: profile.displayName,
    description: getArtistProfileDescription(profile),
    image: profile.profileImage.url,
    url: getPublicSiteUrl(`/artists/${profile.slug}`),
    genre: profile.genres,
    sameAs: profile.links.map((link) => link.url)
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replaceAll("<", "\\u003c")}} type="application/ld+json" />
      <PublicArtistProfile profile={profile} />
    </>
  );
}
