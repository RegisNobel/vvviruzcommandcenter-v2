import {prisma} from "@/lib/db/prisma";
import {parseJson, serializeJson, toDate} from "@/lib/db/serialization";
import {
  DEFAULT_BRAND_PILLAR_ICON_FILES,
  DEFAULT_SITE_ARTIST_IMAGE_FILE,
  DEFAULT_SITE_LOGO_FILE
} from "@/lib/site-assets";
import type {
  BrandPillar,
  LinkHubItem,
  ExclusiveCommunityBenefit,
  SiteContentSettings,
  SiteSettingsRecord,
  SocialLink
} from "@/lib/types";
import {createId} from "@/lib/utils";

const SITE_SETTINGS_ID = "site-settings";

const DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS: ExclusiveCommunityBenefit[] = [
  {
    id: "commission-suggest-concepts",
    title: "Commission & Suggest Concepts",
    description:
      "Pitch song topics, anime ideas, character themes, and concepts you want to hear next."
  },
  {
    id: "submit-bars-lines",
    title: "Submit Bars & Lines",
    description:
      "Drop punchlines, hooks, or one-liners that could inspire upcoming songs."
  },
  {
    id: "vote-multiversus-matchups",
    title: "Vote on Multiversus Matchups",
    description:
      "Help choose future battles, character pairings, and theme directions."
  },
  {
    id: "feature-tournaments",
    title: "Feature Tournaments",
    description:
      "Compete in community challenges for a chance to earn a future feature opportunity."
  },
  {
    id: "early-access-test-lab",
    title: "Early Access & Test Lab",
    description:
      "Hear previews, vote on hooks, react to drafts, and help decide what hits hardest."
  },
  {
    id: "community-status",
    title: "Community Status",
    description:
      "Earn shoutouts, credits, special roles, and recognition inside the Command Center."
  }
];

const LEGACY_EXCLUSIVE_COMMUNITY_DESCRIPTIONS = new Set([
  "Compete in community challenges for a chance to earn a feature opportunity.",
  "Active members can earn shoutouts, credits, special roles, and recognition inside the Lab."
]);

function createDefaultSiteContent(): SiteContentSettings {
  return {
    metadata: {
      site_title: "vvviruz",
      site_description:
        "Official vvviruz artist hub with music releases, artist info, and direct listening links.",
      music_page_title: "Music",
      music_page_description: "Listen through the published vvviruz discography.",
      about_page_title: "About",
      about_page_description: "Bio, press info, and contact details for vvviruz.",
      links_page_title: "Links",
      links_page_description: "Fast mobile-friendly link hub for vvviruz.",
      exclusive_page_title: "Exclusives",
      exclusive_page_description:
        "Unlock an exclusive vvviruz track by joining the list.",
      release_not_found_title: "Release Not Found",
      release_not_found_description: "This release is not available."
    },
    chrome: {
      brand_mark_text: "vvviruz mark",
      brand_mark_file: DEFAULT_SITE_LOGO_FILE,
      brand_subtitle_text: "Artist hub",
      nav_home_label: "Home",
      nav_music_label: "Music",
      nav_about_label: "About",
      nav_links_label: "Links",
      nav_exclusive_label: "Exclusives",
      footer_copyright_text: `Copyright ${new Date().getFullYear()} vvviruz. All rights reserved.`
    },
  home: {
    hero_badge_text: "Official artist hub",
    secondary_cta_label: "Explore Music",
    exclusive_cta_label: "Get the exclusive track",
    featured_releases_eyebrow: "Featured Now",
      featured_releases_empty_text:
        "Select up to three releases from Public Site settings to feature them here.",
      featured_release_ids: [],
      recent_releases_eyebrow: "Recent Releases",
      recent_releases_heading: "Latest drops",
      recent_releases_view_all_label: "View all",
      brand_pillars_eyebrow: "Brand Pillars",
      brand_pillars_heading: "What the catalog is built around",
      brand_pillars: [
        {
          id: "pillar-music",
          title: "Music",
          imageFile: DEFAULT_BRAND_PILLAR_ICON_FILES[0],
          description:
            "Songs built to land fast, replay hard, and keep the release front and center."
        },
        {
          id: "pillar-fitness",
          title: "Fitness",
          imageFile: DEFAULT_BRAND_PILLAR_ICON_FILES[1],
          description:
            "Discipline, pressure, and physical momentum feed the energy behind the work."
        },
        {
          id: "pillar-level-up",
          title: "Level Up",
          imageFile: DEFAULT_BRAND_PILLAR_ICON_FILES[2],
          description:
            "Everything is wired for momentum: sharper execution, stronger drops, cleaner focus."
        },
        {
          id: "pillar-nerdcore",
          title: "Nerdcore",
          imageFile: DEFAULT_BRAND_PILLAR_ICON_FILES[3],
          description:
            "Anime, identity, and competitive pressure turned into direct, high-impact records."
        },
        {
          id: "pillar-tech",
          title: "Tech",
          imageFile: DEFAULT_BRAND_PILLAR_ICON_FILES[4],
          description:
            "Systems, tools, and experimentation stay close to the music and the brand around it."
        }
      ]
    },
    music: {
      page_eyebrow: "Discography",
      page_heading: "Published releases",
      page_description:
        "Every public vvviruz release lives here. Use the type filter if you want to move between nerdcore and mainstream releases faster.",
      all_releases_label: "All Releases",
      nerdcore_label: "Nerdcore",
      mainstream_label: "Mainstream",
      empty_state_text: "No published releases match this filter yet."
  },
  about: {
    statement_heading: "Artist Statement",
    statement_text:
      "Gymrat - Nerd - Lyricist: The Avatar In Real Life.\nSurpassing Limits In Every Lane While Documenting The Process.",
    artist_image_file: DEFAULT_SITE_ARTIST_IMAGE_FILE,
    narrative_heading: "A structured look at the world behind the catalog.",
    intro_heading: "Intro",
    intro_text:
      "vvviruz exists at the intersection of sound, systems, and self-evolution. What started as music quickly expanded into something more deliberate.",
    philosophy_heading: "Philosophy",
    philosophy_text:
      "A space where creativity, discipline, and experimentation all operate at the same time.",
    closing_heading: "Closing Line",
    closing_text:
      "There’s the raw side. High-energy records designed for impact. Gym speakers.",
    connect_heading: "Tap into the signal.",
    connect_empty_text: "Social links coming soon.",
    contact_microcopy: "For collaborations, media, or direct inquiries, reach out here.",
    contact_empty_text: "inquiry@vvviruz.com"
  },
  analytics: {
    meta_pixel_enabled: false,
    meta_pixel_id: ""
  },
  platforms: {
    spotify_label: "Spotify",
    apple_music_label: "Apple Music",
    youtube_label: "YouTube",
    listen_on_spotify_label: "Listen on Spotify",
    listen_on_apple_music_label: "Listen on Apple Music",
    listen_on_youtube_music_label: "Listen on YouTube Music",
    watch_on_youtube_label: "Watch on YouTube"
  },
  links: {
    badge_text: "Latest Release",
    selected_release_id: "",
    exclusive_cta_label: "Unlock the exclusive track",
      empty_state_text:
        "Add featured release links, socials, or extra link-hub items from the admin command center and they will appear here automatically."
    },
  exclusive: {
    badge_text: "Exclusive Track",
    headline: "Get an exclusive vvviruz track",
    subtext: "Not available on Spotify, Apple Music, or YouTube",
    brand_line: "Unlocked from the vvviruz vault",
    cta_label: "Send Me the Track",
    name_label: "Name",
    email_label: "Email",
    consent_label: "Send me future vvviruz updates and releases.",
    success_heading: "You’re in.",
    success_message: "Your download is unlocked below.",
    duplicate_message:
      "You’re already on the list. Your exclusive download is unlocked again below.",
    download_label: "Download the track",
    unavailable_heading: "Exclusive track unavailable",
    unavailable_body:
      "The vault is closed right now. Check back soon for the next exclusive unlock.",
    exclusive_track_title: "",
    exclusive_track_description: "",
    exclusive_track_file_path: "",
    exclusive_track_art_path: "",
    exclusive_track_enabled: false,
    unlock_experience: "instant_unlock",
    private_external_url: "",
    instant_unlock_button_label: "Listen Now",
    also_email_link: true,
    email_subject: "Your Exclusive Track",
    email_body: "Thank you for joining the vvviruz Command Center.\n\nHere is your exclusive link to the vault.",
    discord_invite_url: "",
    community_badge_text: "Fan Hub",
    community_headline: "Join the vvviruz Command Center",
    community_subheadline:
      "Where fans don't just listen. They help shape what comes next.",
    community_microcopy:
      "Your access point to everything happening behind the scenes.",
    community_cta_heading: "Ready to enter the Command Center?",
    community_cta_label: "Join the vvviruz Command Center",
    community_cta_helper: "Discord invite opens in a new tab.",
    community_benefits: DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS
  },
  release: {
    back_to_music_label: "Back to music",
    lyrics_heading: "Lyrics",
    spotify_heading: "Spotify",
    video_heading: "Video",
    related_releases_eyebrow: "Related Releases",
    related_releases_heading: "Keep listening",
    related_releases_view_all_label: "View all music",
    not_found_heading: "Release not found",
    not_found_body: "This release is not available or is not published yet."
  }
  };
}

function mergeSiteContentDefaults(input?: Partial<SiteContentSettings> | null): SiteContentSettings {
  const defaults = createDefaultSiteContent();
  const normalizedLinksBadgeText = input?.links?.badge_text?.trim();
  const normalizedBrandMarkFile = input?.chrome?.brand_mark_file?.trim();
  const normalizedArtistImageFile = input?.about?.artist_image_file?.trim();
  const normalizedExclusiveNavLabel = input?.chrome?.nav_exclusive_label?.trim();
  const normalizedExclusivePageTitle = input?.metadata?.exclusive_page_title?.trim();
  const normalizedCommunityHeadline = input?.exclusive?.community_headline?.trim();
  const normalizedCommunityCtaLabel = input?.exclusive?.community_cta_label?.trim();

  return {
    metadata: {
      ...defaults.metadata,
      ...input?.metadata,
      exclusive_page_title:
        !normalizedExclusivePageTitle ||
        normalizedExclusivePageTitle.toLowerCase() === "exclusive"
          ? defaults.metadata.exclusive_page_title
          : normalizedExclusivePageTitle
    },
    chrome: {
      ...defaults.chrome,
      ...input?.chrome,
      brand_mark_file: normalizedBrandMarkFile || defaults.chrome.brand_mark_file,
      nav_exclusive_label:
        !normalizedExclusiveNavLabel ||
        normalizedExclusiveNavLabel.toLowerCase() === "exclusive"
          ? defaults.chrome.nav_exclusive_label
          : normalizedExclusiveNavLabel
    },
    home: {
      ...defaults.home,
      ...input?.home,
      featured_release_ids:
        input?.home?.featured_release_ids
          ?.map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 3) || defaults.home.featured_release_ids,
      brand_pillars: defaults.home.brand_pillars.map((defaultPillar, index) => {
        const inputPillar = input?.home?.brand_pillars?.[index];

        if (!inputPillar) {
          return defaultPillar;
        }

        return {
          id: inputPillar.id || defaultPillar.id || createId(),
          title: inputPillar.title || defaultPillar.title,
          description: inputPillar.description || defaultPillar.description,
          imageFile: inputPillar.imageFile?.trim() || defaultPillar.imageFile
        };
      })
    },
    music: {
      ...defaults.music,
      ...input?.music
    },
    about: {
      ...defaults.about,
      ...input?.about,
      artist_image_file: normalizedArtistImageFile || defaults.about.artist_image_file
    },
    analytics: {
      ...defaults.analytics,
      ...input?.analytics
    },
    platforms: {
      ...defaults.platforms,
      ...input?.platforms
    },
    links: {
      ...defaults.links,
      ...input?.links,
      badge_text:
        !normalizedLinksBadgeText ||
        normalizedLinksBadgeText.toLowerCase() === "link hub"
          ? defaults.links.badge_text
          : normalizedLinksBadgeText
    },
    exclusive: {
      ...defaults.exclusive,
      ...input?.exclusive,
      unlock_experience: input?.exclusive?.unlock_experience || defaults.exclusive.unlock_experience,
      instant_unlock_button_label: input?.exclusive?.instant_unlock_button_label || defaults.exclusive.instant_unlock_button_label,
      email_subject: input?.exclusive?.email_subject || defaults.exclusive.email_subject,
      email_body: input?.exclusive?.email_body || defaults.exclusive.email_body,
      community_headline:
        !normalizedCommunityHeadline ||
        normalizedCommunityHeadline === "Join the vvviruz command center"
          ? defaults.exclusive.community_headline
          : normalizedCommunityHeadline,
      community_cta_label:
        !normalizedCommunityCtaLabel ||
        normalizedCommunityCtaLabel === "Join the command center"
          ? defaults.exclusive.community_cta_label
          : normalizedCommunityCtaLabel,
      community_benefits:
        input?.exclusive?.community_benefits?.length
          ? input.exclusive.community_benefits.map((benefit, index) => {
              const defaultBenefit =
                DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS[index] ??
                DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS[0];

              return {
                id: benefit.id || defaultBenefit.id || createId(),
                title: benefit.title || defaultBenefit.title,
                description:
                  !benefit.description ||
                  LEGACY_EXCLUSIVE_COMMUNITY_DESCRIPTIONS.has(benefit.description)
                    ? defaultBenefit.description
                    : benefit.description
              };
            })
          : DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS
    },
    release: {
      ...defaults.release,
      ...input?.release
    }
  };
}

function createDefaultSiteSettings(): SiteSettingsRecord {
  const now = new Date().toISOString();

  return {
    artist_name: "vvviruz",
    tagline: "Nerdcore focus. Level-up energy. Zero filler.",
    short_bio:
      "vvviruz is a high-energy artist building release-driven worlds around anime, ambition, and pressure-tested bars.",
    long_bio:
      "vvviruz blends nerdcore storytelling, mainstream-ready energy, and focused release execution into a catalog built for replay. The sound pulls from anime, identity, ambition, and competitive drive while keeping the delivery sharp, direct, and built for impact.",
    contact_email: "inquiry@vvviruz.com",
    booking_email: "",
    social_links: [],
    hero_text: "Built for replay. Engineered for impact.",
    about_content:
      "vvviruz is building a catalog where music, identity, and execution move together. The focus is sharp releases, strong world-building, and a direct connection between the song and the visual brand around it.",
    links_page_items: [],
    site_content: createDefaultSiteContent(),
    created_on: now,
    updated_on: now
  };
}

function resolveAboutTextValue(
  currentValue: string,
  fallbacks: string[],
  defaultValue: string
) {
  const normalizedCurrentValue = currentValue.trim();

  if (normalizedCurrentValue) {
    return normalizedCurrentValue;
  }

  for (const fallback of fallbacks) {
    const normalizedFallback = fallback.trim();

    if (normalizedFallback) {
      return normalizedFallback;
    }
  }

  return defaultValue;
}

function toSiteSettingsRecord(settings: {
  artistName: string;
  tagline: string;
  shortBio: string;
  longBio: string;
  contactEmail: string;
  bookingEmail: string;
  socialLinks: string;
  heroText: string;
  aboutContent: string;
  linksPageItems: string;
  siteContent: string;
  createdOn: Date;
  updatedOn: Date;
}): SiteSettingsRecord {
  return {
    artist_name: settings.artistName,
    tagline: settings.tagline,
    short_bio: settings.shortBio,
    long_bio: settings.longBio,
    contact_email: settings.contactEmail,
    booking_email: settings.bookingEmail,
    social_links: parseJson<SocialLink[]>(settings.socialLinks, []),
    hero_text: settings.heroText,
    about_content: settings.aboutContent,
    links_page_items: parseJson<LinkHubItem[]>(settings.linksPageItems, []),
    site_content: mergeSiteContentDefaults(
      parseJson<Partial<SiteContentSettings>>(settings.siteContent, {})
    ),
    created_on: settings.createdOn.toISOString(),
    updated_on: settings.updatedOn.toISOString()
  };
}

export async function readSiteSettings(): Promise<SiteSettingsRecord> {
  const existing = await prisma.siteSettings.findUnique({
    where: {
      id: SITE_SETTINGS_ID
    }
  });

  if (!existing) {
    const defaults = createDefaultSiteSettings();

    await writeSiteSettings(defaults);

    return defaults;
  }

  const record = toSiteSettingsRecord(existing);
  const defaults = createDefaultSiteSettings();

  return {
    ...record,
    site_content: {
      ...record.site_content,
      about: {
        ...record.site_content.about,
        statement_text: resolveAboutTextValue(
          record.site_content.about.statement_text,
          [record.hero_text, record.about_content, record.tagline],
          defaults.site_content.about.statement_text
        ),
        intro_text: resolveAboutTextValue(
          record.site_content.about.intro_text,
          [record.short_bio, record.long_bio, record.tagline],
          defaults.site_content.about.intro_text
        ),
        philosophy_text: resolveAboutTextValue(
          record.site_content.about.philosophy_text,
          [record.about_content, record.long_bio, record.hero_text],
          defaults.site_content.about.philosophy_text
        ),
        closing_text: resolveAboutTextValue(
          record.site_content.about.closing_text,
          [record.hero_text, record.tagline, record.short_bio],
          defaults.site_content.about.closing_text
        )
      }
    }
  };
}

export async function writeSiteSettings(input: SiteSettingsRecord) {
  const defaults = createDefaultSiteSettings();
  const normalized = {
    ...defaults,
    ...input,
    site_content: mergeSiteContentDefaults(input.site_content),
    updated_on: new Date().toISOString()
  };

  await prisma.siteSettings.upsert({
    where: {
      id: SITE_SETTINGS_ID
    },
    create: {
      id: SITE_SETTINGS_ID,
      artistName: normalized.artist_name,
      tagline: normalized.tagline,
      shortBio: normalized.short_bio,
      longBio: normalized.long_bio,
      contactEmail: normalized.contact_email,
      bookingEmail: normalized.booking_email,
      socialLinks: serializeJson(normalized.social_links),
      heroText: normalized.hero_text,
      aboutContent: normalized.about_content,
      linksPageItems: serializeJson(normalized.links_page_items),
      siteContent: serializeJson(normalized.site_content),
      createdOn: toDate(normalized.created_on),
      updatedOn: toDate(normalized.updated_on)
    },
    update: {
      artistName: normalized.artist_name,
      tagline: normalized.tagline,
      shortBio: normalized.short_bio,
      longBio: normalized.long_bio,
      contactEmail: normalized.contact_email,
      bookingEmail: normalized.booking_email,
      socialLinks: serializeJson(normalized.social_links),
      heroText: normalized.hero_text,
      aboutContent: normalized.about_content,
      linksPageItems: serializeJson(normalized.links_page_items),
      siteContent: serializeJson(normalized.site_content),
      createdOn: toDate(normalized.created_on),
      updatedOn: toDate(normalized.updated_on)
    }
  });

  return normalized;
}



