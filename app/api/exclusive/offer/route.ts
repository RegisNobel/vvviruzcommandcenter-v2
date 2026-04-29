export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  readExclusiveOfferSettings,
  writeExclusiveOfferSettings
} from "@/lib/repositories/exclusive-offer";
import {readAssetBuffer} from "@/lib/server/asset-storage";

const exclusiveCommunityBenefitSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default("")
});

const exclusiveOfferSchema = z.object({
  badge_text: z.string().default(""),
  headline: z.string().default(""),
  subtext: z.string().default(""),
  brand_line: z.string().default(""),
  cta_label: z.string().default(""),
  name_label: z.string().default(""),
  email_label: z.string().default(""),
  consent_label: z.string().default(""),
  success_heading: z.string().default(""),
  success_message: z.string().default(""),
  duplicate_message: z.string().default(""),
  download_label: z.string().default(""),
  unavailable_heading: z.string().default(""),
  unavailable_body: z.string().default(""),
  exclusive_track_title: z.string().default(""),
  exclusive_track_description: z.string().default(""),
  exclusive_track_file_path: z.string().default(""),
  exclusive_track_art_path: z.string().default(""),
  exclusive_track_enabled: z.boolean().default(false),
  discord_invite_url: z.string().default(""),
  community_badge_text: z.string().default(""),
  community_headline: z.string().default(""),
  community_subheadline: z.string().default(""),
  community_microcopy: z.string().default(""),
  community_cta_heading: z.string().default(""),
  community_cta_label: z.string().default(""),
  community_cta_helper: z.string().default(""),
  community_benefits: z.array(exclusiveCommunityBenefitSchema).default([])
});

async function validateExclusiveAssets(values: z.infer<typeof exclusiveOfferSchema>) {
  const trackPath = values.exclusive_track_file_path.trim();
  const artPath = values.exclusive_track_art_path.trim();

  if (values.exclusive_track_enabled) {
    if (!values.exclusive_track_title.trim()) {
      throw new Error("Add an exclusive track title before enabling the offer.");
    }

    if (!trackPath) {
      throw new Error("Upload or select the exclusive track file before enabling the offer.");
    }
  }

  if (trackPath) {
    await readAssetBuffer("exclusive-track", trackPath, "private");
  }

  if (artPath) {
    await readAssetBuffer("exclusive-art", artPath, "public");
  }
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const {exclusive} = await readExclusiveOfferSettings();

  return NextResponse.json({exclusive});
}

export async function PUT(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const payload = exclusiveOfferSchema.parse(await request.json());

    await validateExclusiveAssets(payload);

    const siteSettings = await writeExclusiveOfferSettings(payload);

    return NextResponse.json({
      exclusive: siteSettings.site_content.exclusive,
      message: "Exclusive offer updated."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid exclusive offer settings."},
        {status: 400}
      );
    }

    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to update the offer."},
      {status: 400}
    );
  }
}
