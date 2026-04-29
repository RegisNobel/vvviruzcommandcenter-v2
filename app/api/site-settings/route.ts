export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
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

  const siteSettings = await writeSiteSettings(parsed.data);

  return NextResponse.json({siteSettings});
}



