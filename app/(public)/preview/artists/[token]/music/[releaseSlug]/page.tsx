export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistEditorialRelease} from "@/components/public-artist-editorial-release";
import {readArtistPreviewEditorialRelease} from "@/lib/repositories/artist-profiles";

export const metadata: Metadata = {
  title: "Private artist release preview",
  robots: {index: false, follow: false, nocache: true},
  referrer: "origin"
};

export default async function ArtistEditorialReleasePreviewPage({
  params
}: {
  params: Promise<{token: string; releaseSlug: string}>;
}) {
  const {token, releaseSlug} = await params;
  const result = await readArtistPreviewEditorialRelease(token, releaseSlug);
  if (!result) notFound();
  return (
    <PublicArtistEditorialRelease
      preview={{
        token,
        version: result.version,
        approvalStatus: result.approvalStatus
      }}
      profile={result.profile}
      release={result.release}
    />
  );
}
