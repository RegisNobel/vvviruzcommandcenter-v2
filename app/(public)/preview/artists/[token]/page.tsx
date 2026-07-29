import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicArtistProfile} from "@/components/public-artist-profile";
import {readArtistPreviewByToken} from "@/lib/repositories/artist-profiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private artist profile preview",
  robots: {index: false, follow: false, nocache: true},
  referrer: "no-referrer"
};

export default async function ArtistPreviewPage({params}: {params: Promise<{token: string}>}) {
  const {token} = await params;
  const preview = await readArtistPreviewByToken(token);
  if (!preview) notFound();

  return (
    <PublicArtistProfile
      preview={{version: preview.version, approvalStatus: preview.approvalStatus, token}}
      profile={preview.profile}
    />
  );
}
