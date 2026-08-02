export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {prisma} from "@/lib/db/prisma";
import {normalizeExclusiveDeliverySettings} from "@/lib/exclusive-offer-safety";
import {PUBLIC_PROJECT_SLUGS} from "@/lib/public-projects";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {readSiteSettings, writeSiteSettings} from "@/lib/repositories/site-settings";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
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

function spotlightTextSchema(maxLength: number, defaultValue: string) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => !/[<>\r\n]/.test(value), {
      message: "Spotlight copy must be plain text on one line."
    })
    .default(defaultValue);
}

const exclusiveCommunityBenefitSchema = z.object({
  id: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || createId()),
  title: z.string().trim().default(""),
  description: z.string().trim().default("")
});

const commissionServiceSchema = z.object({
  id: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || createId()),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(600).default("")
});

const uniqueTextOptionsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(20)
  .default([])
  .superRefine((values, ctx) => {
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Option lists cannot contain duplicates."
      });
    }
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
      nav_projects_label: z.string().default("Projects"),
      nav_artists_label: z.string().default("Artist Profiles"),
      nav_commissions_label: z.string().default("Commissions"),
      nav_vault_label: z.string().default("Vault"),
      nav_breaking_barz_label: z.string().default("Breaking Barz"),
      nav_more_label: z.string().default("More"),
      desktop_more_hrefs: z
        .array(
          z.enum([
            "/projects",
            "/artists",
            "/commissions",
            "/vault",
            "/breaking-barz",
            "/about",
            "/exclusives",
            "/links",
            "/music"
          ])
        )
        .max(9)
        .default(["/about", "/artists", "/commissions", "/vault"]),
      footer_copyright_text: z.string().default("")
    }),
    home: z.object({
      hero_badge_text: z.string().default(""),
      secondary_cta_label: z.string().default(""),
      exclusive_cta_label: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .default("Get the exclusive track"),
      exclusive_cta_heading: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .default("Hear what is coming before the public drop"),
      exclusive_cta_description: z
        .string()
        .trim()
        .min(1)
        .max(360)
        .default(
          "Get Insider Access for unreleased previews, early updates, and the private vvviruz community."
        ),
      featured_releases_eyebrow: z.string().default(""),
      featured_releases_empty_text: z.string().default(""),
      featured_release_ids: z
        .array(z.string().trim().min(1))
        .max(3)
        .default([])
        .superRefine((values, ctx) => {
          if (new Set(values).size !== values.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Homepage featured releases cannot contain duplicates."
            });
          }
        }),
      built_for_motion_enabled: z.boolean().default(true),
      built_for_motion_release_id: z.string().trim().default(""),
      built_for_motion_release_ids: z
        .array(z.string().trim().min(1))
        .max(6)
        .default([])
        .superRefine((values, ctx) => {
          if (new Set(values).size !== values.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Lock-In Rotation cannot contain duplicate releases."
            });
          }
        }),
      built_for_motion_heading: z.string().trim().min(1).max(80).default("Lock-In Rotation"),
      built_for_motion_description: z.string().trim().min(1).max(240).default(
        "High-energy tracks for training, focus, and full-send playlists."
      ),
      lock_in_spotlight_release_id: z.string().trim().default(""),
      lock_in_spotlight_eyebrow: spotlightTextSchema(40, "5:00 AM PROTOCOL"),
      lock_in_spotlight_headline: spotlightTextSchema(64, "SURPASS YOUR LIMITS"),
      lock_in_spotlight_statement: spotlightTextSchema(120, "IGNORE THE NOISE. LOCK IN."),
      lock_in_spotlight_cta_label: spotlightTextSchema(32, "GO BEAST MODE"),
      recent_releases_eyebrow: z.string().default(""),
      recent_releases_heading: z.string().default(""),
      recent_releases_description: z.string().default(""),
      recent_releases_view_all_label: z.string().default(""),
      exclusive_cta_eyebrow: z.string().default(""),
      brand_pillars_eyebrow: z.string().default(""),
      brand_pillars_heading: z.string().default(""),
      brand_pillars: z.array(brandPillarSchema).default([])
    }),
    projects: z
      .object({
        approved_slugs: z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(80)
              .regex(
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "Project slugs must use lowercase letters, numbers, and hyphens."
              )
          )
          .max(24)
          .default([...PUBLIC_PROJECT_SLUGS])
          .superRefine((values, ctx) => {
            if (new Set(values).size !== values.length) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Approved public projects cannot contain duplicate slugs."
              });
            }
          }),
        homepage_eyebrow: z.string().default(""),
        homepage_heading: z.string().default(""),
        homepage_description: z.string().default(""),
        homepage_card_cta_label: z.string().default(""),
        index_meta_title: z.string().default(""),
        index_meta_description: z.string().default(""),
        index_heading: z.string().default(""),
        index_description: z.string().default(""),
        index_browse_label: z.string().default(""),
        index_card_cta_label: z.string().default(""),
        empty_heading: z.string().default(""),
        empty_description: z.string().default(""),
        empty_cta_label: z.string().default(""),
        not_found_eyebrow: z.string().default(""),
        not_found_heading: z.string().default(""),
        not_found_description: z.string().default(""),
        not_found_cta_label: z.string().default("")
      })
      .default({
        approved_slugs: [...PUBLIC_PROJECT_SLUGS],
        homepage_eyebrow: "",
        homepage_heading: "",
        homepage_description: "",
        homepage_card_cta_label: "",
        index_meta_title: "",
        index_meta_description: "",
        index_heading: "",
        index_description: "",
        index_browse_label: "",
        index_card_cta_label: "",
        empty_heading: "",
        empty_description: "",
        empty_cta_label: "",
        not_found_eyebrow: "",
        not_found_heading: "",
        not_found_description: "",
        not_found_cta_label: ""
      }),
    artist_directory: z.object({
      metadata_title: z.string().default(""),
      metadata_description: z.string().default(""),
      eyebrow: z.string().default(""),
      heading: z.string().default(""),
      description: z.string().default(""),
      card_eyebrow: z.string().default(""),
      empty_eyebrow: z.string().default(""),
      empty_heading: z.string().default(""),
      empty_description: z.string().default("")
    }),
    intel: z.object({
      rail_label: z.string().default(""),
      cta_label: z.string().default("")
    }),
    music: z.object({
      page_eyebrow: z.string().default(""),
      page_heading: z.string().default(""),
      page_description: z.string().default(""),
      all_releases_label: z.string().default(""),
      nerdcore_label: z.string().default(""),
      mainstream_label: z.string().default(""),
      empty_state_text: z.string().default(""),
      releases_tab_label: z.string().default(""),
      appears_on_tab_label: z.string().default(""),
      browse_projects_label: z.string().default(""),
      showing_label: z.string().default(""),
      open_project_label: z.string().default(""),
      clear_filter_label: z.string().default(""),
      appears_on_empty_text: z.string().default(""),
      search_label: z.string().default(""),
      search_placeholder: z.string().default(""),
      search_empty_text: z.string().default("")
    }),
    about: z.object({
      hero_cta_label: z.string().default(""),
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
      contact_empty_text: z.string().default(""),
      catalog_eyebrow: z.string().default(""),
      catalog_heading: z.string().default(""),
      catalog_description: z.string().default(""),
      catalog_primary_cta_label: z.string().default(""),
      catalog_secondary_cta_label: z.string().default("")
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
      community_benefits: z.array(exclusiveCommunityBenefitSchema).default([]),
      preview_private_notice: z.string().default(""),
      preview_status_label: z.string().default(""),
      activated_heading: z.string().default(""),
      activated_body: z.string().default(""),
      discord_unavailable_label: z.string().default(""),
      discord_unavailable_helper: z.string().default("")
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
    breaking_barz: z.object({
      is_enabled: z.boolean().default(true),
      show_in_nav: z.boolean().default(true),
      submissions_enabled: z.boolean().default(true),
      metadata_title: z.string().trim().max(120).default("Breaking Barz"),
      metadata_description: z.string().trim().max(320).default(""),
      eyebrow: z.string().trim().max(80).default("Lyric Discovery"),
      heading: z.string().trim().max(120).default("Breaking Barz"),
      description: z.string().trim().max(500).default(""),
      suggestion_cta_label: z.string().trim().max(80).default("Suggest a bar")
    }),
    vault: z.object({
      is_enabled: z.boolean().default(false),
      badge_text: z.string().default(""),
      title: z.string().default(""),
      subtitle: z.string().default(""),
      body: z.string().default(""),
      cta_label: z.string().default(""),
      cta_url: z.string().default(""),
      benefits: z.array(exclusiveCommunityBenefitSchema).default([]),
      waitlist_consent_label: z.string().default(""),
      waitlist_success_heading: z.string().default(""),
      waitlist_note: z.string().default(""),
      future_updates_heading: z.string().default(""),
      future_updates_description: z.string().default(""),
      future_updates_consent_label: z.string().default(""),
      future_updates_cta_label: z.string().default(""),
      more_eyebrow: z.string().default(""),
      more_heading: z.string().default(""),
      preview_cta_label: z.string().default(""),
      item_purchase_cta_label: z.string().default("")
    }),
    commissions: z.object({
      is_enabled: z.boolean().default(true),
      metadata_title: z.string().default(""),
      metadata_open_description: z.string().default(""),
      metadata_closed_description: z.string().default(""),
      page_eyebrow: z.string().default(""),
      page_title: z.string().default(""),
      page_subtitle: z.string().default(""),
      card_title: z.string().default(""),
      card_price: z.string().default(""),
      card_description: z.string().default(""),
      card_button_text: z.string().default(""),
      closed_message: z.string().default(""),
      closed_eyebrow: z.string().default(""),
      closed_heading: z.string().default(""),
      closed_cta_label: z.string().default(""),
      services: z.array(commissionServiceSchema).max(8).default([]),
      quote_eyebrow: z.string().default(""),
      quote_description: z.string().default(""),
      terms_primary: z.string().default(""),
      terms_secondary: z.string().default(""),
      form_heading: z.string().default(""),
      form_success_heading: z.string().default(""),
      form_disclaimer: z.string().default(""),
      name_label: z.string().default(""),
      name_placeholder: z.string().default(""),
      email_label: z.string().default(""),
      email_placeholder: z.string().default(""),
      request_type_label: z.string().default(""),
      request_type_placeholder: z.string().default(""),
      other_service_label: z.string().default(""),
      budget_label: z.string().default(""),
      budget_placeholder: z.string().default(""),
      usage_label: z.string().default(""),
      usage_placeholder: z.string().default(""),
      deadline_label: z.string().default(""),
      deadline_placeholder: z.string().default(""),
      specific_date_label: z.string().default(""),
      specific_date_placeholder: z.string().default(""),
      topic_label: z.string().default(""),
      topic_placeholder: z.string().default(""),
      beat_link_label: z.string().default(""),
      beat_link_placeholder: z.string().default(""),
      reference_link_label: z.string().default(""),
      reference_link_placeholder: z.string().default(""),
      notes_label: z.string().default(""),
      notes_placeholder: z.string().default(""),
      submit_label: z.string().default(""),
      submitting_label: z.string().default(""),
      budget_options: uniqueTextOptionsSchema,
      usage_options: uniqueTextOptionsSchema,
      deadline_options: uniqueTextOptionsSchema
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

  const builtForMotionReleaseIds =
    parsed.data.site_content.home.built_for_motion_release_ids.length > 0
      ? parsed.data.site_content.home.built_for_motion_release_ids
      : [parsed.data.site_content.home.built_for_motion_release_id].filter(Boolean);
  const referencedReleaseIds = [
    parsed.data.site_content.home.lock_in_spotlight_release_id
  ].filter(Boolean);

  if (referencedReleaseIds.length > 0) {
    const releases = await prisma.release.findMany({
      where: {id: {in: referencedReleaseIds}},
      select: {id: true}
    });
    const foundIds = new Set(releases.map((release) => release.id));
    const missingId = referencedReleaseIds.find((releaseId) => !foundIds.has(releaseId));

    if (missingId) {
      return NextResponse.json(
        {message: `A selected homepage release no longer exists (${missingId}).`},
        {status: 400}
      );
    }
  }

  const approvedProjectSlugs = parsed.data.site_content.projects.approved_slugs;
  if (approvedProjectSlugs.length > 0) {
    const categories = await prisma.releaseCategory.findMany({
      where: {slug: {in: approvedProjectSlugs}},
      select: {slug: true}
    });
    const foundSlugs = new Set(categories.map((category) => category.slug));
    const missingSlug = approvedProjectSlugs.find((slug) => !foundSlugs.has(slug));

    if (missingSlug) {
      return NextResponse.json(
        {message: `Public project category \"${missingSlug}\" no longer exists.`},
        {status: 400}
      );
    }
  }

  // Exclusives Associated Release validation
  const exclusive = parsed.data.site_content.exclusive;
  if (exclusive.release_id) {
    const { readRelease } = await import("@/lib/repositories/releases");

    try {
      const releaseRecord = await readRelease(exclusive.release_id);
      // Exclude Vault content
      const vaultAssignment = await prisma.releaseCategoryAssignment.findFirst({
        where: {
          releaseId: exclusive.release_id,
          category: { slug: "vault" }
        }
      });
      if (vaultAssignment) {
        return NextResponse.json(
          {message: `Release "${releaseRecord.title}" belongs to the Vault and cannot be used for Insider Access.`},
          {status: 400}
        );
      }
    } catch (err) {
      return NextResponse.json(
        {message: `Associated release ${exclusive.release_id} was not found.`},
        {status: 400}
      );
    }
  }

  try {
    const siteSettings = await writeSiteSettings({
      ...parsed.data,
      site_content: {
        ...parsed.data.site_content,
        home: {
          ...parsed.data.site_content.home,
          built_for_motion_release_id: builtForMotionReleaseIds[0] ?? "",
          built_for_motion_release_ids: builtForMotionReleaseIds
        },
        exclusive: normalizeExclusiveDeliverySettings(parsed.data.site_content.exclusive)
      }
    });

    revalidateTag(PUBLIC_CACHE_TAGS.siteSettings);
    revalidateTag(PUBLIC_CACHE_TAGS.exclusiveOffer);

    return NextResponse.json({siteSettings});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "site-settings.update",
      fallbackMessage: "Public Site settings could not be saved."
    });
  }
}
