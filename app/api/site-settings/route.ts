export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {normalizeExclusiveDeliverySettings} from "@/lib/exclusive-offer-safety";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {readSiteSettings, writeSiteSettings} from "@/lib/repositories/site-settings";
import {createId} from "@/lib/utils";

const looseLinkItemSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().optional(),
  url: z.string().trim().optional()
});

const brandPillarSchema = z.object({
  id: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || createId()),
  title: z.string().trim().default(""),
  description: z.string().trim().default(""),
  imageFile: z.string().trim().default("")
});

const exclusiveCommunityBenefitSchema = z.object({
  id: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || createId()),
  title: z.string().trim().default(""),
  description: z.string().trim().default("")
});

function normalizeLinkItems(
  value: Array<{
    id?: string;
    label?: string;
    url?: string;
  }>,
  ctx: z.RefinementCtx,
  fieldLabel: string
) {
  return value.flatMap((item, index) => {
    const label = item.label?.trim() ?? "";
    const url = item.url?.trim() ?? "";

    if (!label && !url) {
      return [];
    }

    if (!label || !url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldLabel} row ${index + 1} needs both a label and a URL. Blank lines in the bio fields are fine.`,
        path: [index]
      });

      return [];
    }

    return [
      {
        id: item.id?.trim() || createId(),
        label,
        url
      }
    ];
  });
}

const upcomingPreviewTrackSchema = z.object({
  id: z.string().trim().default(""),
  releaseId: z.string().trim().optional(),
  titleOverride: z.string().trim().optional(),
  artworkUrlOverride: z.string().trim().optional(),
  audioUrl: z.string().trim().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0)
});

const previewPlayerSchema = z.object({
  is_enabled: z.boolean().default(false),
  tracks: z.array(upcomingPreviewTrackSchema).default([])
});

const siteSettingsSchema = z.object({
  artist_name: z.string().default("vvviruz"),
  tagline: z.string().default(""),
  short_bio: z.string().default(""),
  long_bio: z.string().default(""),
  contact_email: z.string().default(""),
  booking_email: z.string().default(""),
  social_links: z
    .array(looseLinkItemSchema)
    .default([])
    .transform((value, ctx) => normalizeLinkItems(value, ctx, "Social links")),
  hero_text: z.string().default(""),
  about_content: z.string().default(""),
  links_page_items: z
    .array(looseLinkItemSchema)
    .default([])
    .transform((value, ctx) => normalizeLinkItems(value, ctx, "Links page items")),
  site_content: z.object({
    preview_player: previewPlayerSchema,
    metadata: z.object({
      site_title: z.string().default(""),
      site_description: z.string().default(""),
      music_page_title: z.string().default(""),
      music_page_description: z.string().default(""),
      about_page_title: z.string().default(""),
      about_page_description: z.string().default(""),
      links_page_title: z.string().default(""),
      links_page_description: z.string().default(""),
      exclusive_page_title: z.string().default("Exclusives"),
      exclusive_page_description: z.string().default(""),
      release_not_found_title: z.string().default(""),
      release_not_found_description: z.string().default("")
    }),
    chrome: z.object({
      brand_mark_text: z.string().default(""),
      brand_mark_file: z.string().default(""),
      brand_subtitle_text: z.string().default(""),
      nav_home_label: z.string().default(""),
      nav_music_label: z.string().default(""),
      nav_about_label: z.string().default(""),
      nav_links_label: z.string().default(""),
      nav_exclusive_label: z.string().default("Exclusives"),
      footer_copyright_text: z.string().default("")
    }),
    home: z.object({
      hero_badge_text: z.string().default(""),
      secondary_cta_label: z.string().default(""),
      exclusive_cta_label: z.string().default(""),
      featured_releases_eyebrow: z.string().default(""),
      featured_releases_empty_text: z.string().default(""),
      featured_release_ids: z.array(z.string().trim()).max(3).default([]),
      recent_releases_eyebrow: z.string().default(""),
      recent_releases_heading: z.string().default(""),
      recent_releases_view_all_label: z.string().default(""),
      brand_pillars_eyebrow: z.string().default(""),
      brand_pillars_heading: z.string().default(""),
      brand_pillars: z.array(brandPillarSchema).default([])
    }),
    music: z.object({
      page_eyebrow: z.string().default(""),
      page_heading: z.string().default(""),
      page_description: z.string().default(""),
      all_releases_label: z.string().default(""),
      nerdcore_label: z.string().default(""),
      mainstream_label: z.string().default(""),
      empty_state_text: z.string().default("")
    }),
    about: z.object({
      statement_heading: z.string().default(""),
      statement_text: z.string().default(""),
      artist_image_file: z.string().default(""),
      narrative_heading: z.string().default(""),
      intro_heading: z.string().default(""),
      intro_text: z.string().default(""),
      philosophy_heading: z.string().default(""),
      philosophy_text: z.string().default(""),
      closing_heading: z.string().default(""),
      closing_text: z.string().default(""),
      connect_heading: z.string().default(""),
      connect_empty_text: z.string().default(""),
      contact_microcopy: z.string().default(""),
      contact_empty_text: z.string().default("")
    }),
    analytics: z.object({
      meta_pixel_enabled: z.boolean().default(false),
      meta_pixel_id: z.string().default("")
    }),
    platforms: z.object({
      spotify_label: z.string().default(""),
      apple_music_label: z.string().default(""),
      youtube_label: z.string().default(""),
      listen_on_spotify_label: z.string().default(""),
      listen_on_apple_music_label: z.string().default(""),
      listen_on_youtube_music_label: z.string().default(""),
      watch_on_youtube_label: z.string().default("")
    }),
    links: z.object({
      badge_text: z.string().default(""),
      selected_release_id: z.string().default(""),
      exclusive_cta_label: z.string().default(""),
      empty_state_text: z.string().default("")
    }),
    exclusive: z.object({
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
      unlock_experience: z.enum(["instant_unlock", "email_only", "signup_notify"]).default("instant_unlock"),
      private_external_url: z.string().default(""),
      instant_unlock_button_label: z.string().default("Listen Now"),
      also_email_link: z.boolean().default(true),
      email_subject: z.string().default("Your Exclusive Track"),
      email_body: z.string().default("Thank you for joining the vvviruz Command Center.\n\nHere is your exclusive link to the vault."),
      discord_invite_url: z.string().default(""),
      community_badge_text: z.string().default(""),
      community_headline: z.string().default(""),
      community_subheadline: z.string().default(""),
      community_microcopy: z.string().default(""),
      community_cta_heading: z.string().default(""),
      community_cta_label: z.string().default(""),
      community_cta_helper: z.string().default(""),
      community_benefits: z.array(exclusiveCommunityBenefitSchema).default([])
    }),
    release: z.object({
      back_to_music_label: z.string().default(""),
      lyrics_heading: z.string().default(""),
      spotify_heading: z.string().default(""),
      video_heading: z.string().default(""),
      related_releases_eyebrow: z.string().default(""),
      related_releases_heading: z.string().default(""),
      related_releases_view_all_label: z.string().default(""),
      not_found_heading: z.string().default(""),
      not_found_body: z.string().default("")
    }),
    vault: z.object({
      is_enabled: z.boolean().default(false),
      badge_text: z.string().default(""),
      title: z.string().default(""),
      subtitle: z.string().default(""),
      body: z.string().default(""),
      cta_label: z.string().default(""),
      cta_url: z.string().default(""),
      benefits: z.array(exclusiveCommunityBenefitSchema).default([])
    }),
    commissions: z.object({
      is_enabled: z.boolean().default(true),
      page_eyebrow: z.string().default(""),
      page_title: z.string().default(""),
      page_subtitle: z.string().default(""),
      card_title: z.string().default(""),
      card_price: z.string().default(""),
      card_description: z.string().default(""),
      card_button_text: z.string().default(""),
      closed_message: z.string().default("")
    })
  }),
  created_on: z.string().default(""),
  updated_on: z.string().default("")
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const siteSettings = await readSiteSettings();

  return NextResponse.json({siteSettings});
}

export async function PUT(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const parsed = siteSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {message: parsed.error.issues[0]?.message ?? "Invalid site settings payload."},
      {status: 400}
    );
  }

  // Preview Player validation
  const previewPlayer = parsed.data.site_content.preview_player;
  const activeTracks = previewPlayer.tracks.filter(t => t.isActive);

  // 1. Max 5 active tracks
  if (activeTracks.length > 5) {
    return NextResponse.json(
      {message: "You can have a maximum of 5 active preview tracks."},
      {status: 400}
    );
  }

  // 2. Unique track IDs
  const trackIds = previewPlayer.tracks.map(t => t.id);
  if (new Set(trackIds).size !== trackIds.length) {
    return NextResponse.json(
      {message: "Preview track IDs must be unique."},
      {status: 400}
    );
  }

  // 3. Unique linked releases (if non-empty)
  const linkedReleaseIds = activeTracks.map(t => t.releaseId).filter(Boolean) as string[];
  if (new Set(linkedReleaseIds).size !== linkedReleaseIds.length) {
    return NextResponse.json(
      {message: "Each active preview track must link to a unique release."},
      {status: 400}
    );
  }

  // 4. Valid media URLs
  const isValidMediaUrl = (url: string) => {
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) || /^\/api\/assets\//i.test(trimmed);
  };
  for (const track of activeTracks) {
    if (!isValidMediaUrl(track.audioUrl)) {
      return NextResponse.json(
        {message: `Invalid audio URL for track: ${track.titleOverride || "Untitled"}`},
        {status: 400}
      );
    }
    if (track.artworkUrlOverride && !isValidMediaUrl(track.artworkUrlOverride)) {
      return NextResponse.json(
        {message: `Invalid artwork URL for track: ${track.titleOverride || "Untitled"}`},
        {status: 400}
      );
    }
  }

  // 5. Fallback metadata
  for (const track of activeTracks) {
    if (!track.releaseId) {
      if (!track.titleOverride?.trim()) {
        return NextResponse.json(
          {message: "Active preview tracks without a linked release must specify a Title override."},
          {status: 400}
        );
      }
      if (!track.artworkUrlOverride?.trim()) {
        return NextResponse.json(
          {message: "Active preview tracks without a linked release must specify an Artwork override."},
          {status: 400}
        );
      }
    }
  }

  // 6. DB Eligibility Checks (only for active tracks with a linked release)
  if (linkedReleaseIds.length > 0) {
    const { prisma } = await import("@/lib/db/prisma");
    const { readRelease } = await import("@/lib/repositories/releases");
    const { isReleaseEligibleForPreview } = await import("@/lib/release-planning");

    for (const track of activeTracks) {
      if (!track.releaseId) continue;
      try {
        const releaseRecord = await readRelease(track.releaseId);
        // Exclude released content
        if (!isReleaseEligibleForPreview(releaseRecord)) {
          return NextResponse.json(
            {message: `Release "${releaseRecord.title}" is already commercially released and cannot be used as an upcoming preview.`},
            {status: 400}
          );
        }
        // Exclude Vault content
        const vaultAssignment = await prisma.releaseCategoryAssignment.findFirst({
          where: {
            releaseId: track.releaseId,
            category: { slug: "vault" }
          }
        });
        if (vaultAssignment) {
          return NextResponse.json(
            {message: `Release "${releaseRecord.title}" belongs to the Vault and cannot be used as a public upcoming preview.`},
            {status: 400}
          );
        }
      } catch (err) {
        return NextResponse.json(
          {message: `Linked release ${track.releaseId} was not found.`},
          {status: 400}
        );
      }
    }
  }

  try {
    const siteSettings = await writeSiteSettings({
      ...parsed.data,
      site_content: {
        ...parsed.data.site_content,
        exclusive: normalizeExclusiveDeliverySettings(parsed.data.site_content.exclusive)
      }
    });

    revalidateTag(PUBLIC_CACHE_TAGS.siteSettings);
    revalidateTag(PUBLIC_CACHE_TAGS.exclusiveOffer);

    return NextResponse.json({siteSettings});
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to update site settings."},
      {status: 400}
    );
  }
}



