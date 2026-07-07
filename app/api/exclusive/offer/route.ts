export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {normalizeExclusiveDeliverySettings} from "@/lib/exclusive-offer-safety";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
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
  release_id: z.string().nullish().transform(val => val?.trim() || null),
  unlock_experience: z.enum(["instant_unlock", "email_only", "signup_notify"]).default("instant_unlock"),
  private_external_url: z.string().default(""),
  instant_unlock_button_label: z.string().default("Access the Current Preview"),
  also_email_link: z.boolean().default(true),
  email_subject: z.string().default("Insider Access Unlocked"),
  email_body: z.string().default("Your Insider Access is ready. Use the button below to access the current private preview.\n\nNote that previews rotate as new songs release, so check back often to hear the latest unreleased material!"),
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
  if (values.exclusive_track_enabled) {
    if (!values.private_external_url.trim()) {
      throw new Error("Provide a private external URL before enabling the preview.");
    }
  }

  if (values.release_id) {
    const { prisma } = await import("@/lib/db/prisma");
    const releaseRecord = await prisma.release.findUnique({
      where: { id: values.release_id }
    });
    if (!releaseRecord) {
      throw new Error(`Associated release ${values.release_id} was not found.`);
    }

    // Exclude Vault content
    const vaultAssignment = await prisma.releaseCategoryAssignment.findFirst({
      where: {
        releaseId: values.release_id,
        category: { slug: "vault" }
      }
    });
    if (vaultAssignment) {
      throw new Error(`Release "${releaseRecord.title}" belongs to the Vault and cannot be used for Insider Access.`);
    }
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
    const payload = normalizeExclusiveDeliverySettings(
      exclusiveOfferSchema.parse(await request.json())
    );

    await validateExclusiveAssets(payload);

    const siteSettings = await writeExclusiveOfferSettings(payload);

    revalidateTag(PUBLIC_CACHE_TAGS.siteSettings);
    revalidateTag(PUBLIC_CACHE_TAGS.exclusiveOffer);

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
