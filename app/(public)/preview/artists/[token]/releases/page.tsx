import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistCatalog} from "@/components/public-artist-catalog";
import {readArtistPreviewByToken} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private artist catalog preview",
  robots: {index: false, follow: false, nocache: true},
  referrer: "no-referrer"
};

export default async function ArtistCatalogPreviewPage({
  params
}: {
  params: Promise<{token: string}>;
}) {
  const {token} = await params;
  const preview = await readArtistPreviewByToken(token);
  if (
    !preview?.profile.expansion.catalogEnabled ||
    !preview.profile.expansion.catalogReleaseIds.length
  ) {
    notFound();
  }
  return <PublicArtistCatalog previewToken={token} profile={preview.profile} />;
}
