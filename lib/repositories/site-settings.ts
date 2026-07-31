import {prisma} from "@/lib/db/prisma";
import {parseJson, serializeJson, toDate} from "@/lib/db/serialization";
import {
  DEFAULT_BRAND_PILLAR_ICON_FILES,
  DEFAULT_SITE_ARTIST_IMAGE_FILE,
  DEFAULT_SITE_LOGO_FILE,
  resolveBrandPillarImageFile
} from "@/lib/site-assets";
import {PUBLIC_PROJECT_SLUGS, normalizeApprovedPublicProjectSlugs} from "@/lib/public-projects";
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

const DEFAULT_EXCLUSIVE_SUCCESS_HEADING = "Insider Access Unlocked";
const DEFAULT_EXCLUSIVE_SUCCESS_MESSAGE =
  "You're in. Your Insider Access is unlocked.";
const DEFAULT_EXCLUSIVE_DUPLICATE_MESSAGE =
  "You're already on the list. Your Insider Access is unlocked.";
const LEGACY_ABOUT_INTRO =
  "vvviruz is an artist and creator blending music, fitness, nerd culture, languages and self-improvement into one evolving brand.";
const LEGACY_ABOUT_PHILOSOPHY =
  "The goal is simple: Create consistently, improve publicly, and build something that does not fit in one box.";

function hasLegacyEncoding(value: string) {
  return value.includes("â");
}

function normalizeModeSafeExclusiveMessage(
  value: string | undefined,
  fallback: string,
  unlockExperience: string
) {
  const normalizedValue = (value ?? "").trim();
  if (
    unlockExperience !== "instant_unlock" &&
    /\b(download|unlock|unlocked)\b/i.test(normalizedValue)
  ) {
    return fallback;
  }

  return normalizedValue;
}

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
      nav_links_label: "On Repeat",
      nav_exclusive_label: "Exclusives",
      nav_projects_label: "Projects",
      nav_artists_label: "Artist Profiles",
      nav_commissions_label: "Commissions",
      nav_vault_label: "Vault",
      nav_more_label: "More",
      desktop_more_hrefs: ["/about", "/artists", "/commissions", "/vault"],
      footer_copyright_text: `Copyright ${new Date().getFullYear()} vvviruz. All rights reserved.`
    },
  home: {
    hero_badge_text: "Official artist hub",
    secondary_cta_label: "Explore Music",
    exclusive_cta_label: "Get the exclusive track",
    exclusive_cta_heading: "Hear what is coming before the public drop",
    exclusive_cta_description:
      "Get Insider Access for unreleased previews, early updates, and the private vvviruz community.",
    featured_releases_eyebrow: "Featured Now",
      featured_releases_empty_text:
        "Select up to three releases from Public Site settings to feature them here.",
      featured_release_ids: [],
      built_for_motion_enabled: true,
      built_for_motion_release_id: "",
      built_for_motion_release_ids: [],
      built_for_motion_heading: "Lock-In Rotation",
      built_for_motion_description:
        "High-energy tracks for training, focus, and full-send playlists.",
      lock_in_spotlight_release_id: "",
      lock_in_spotlight_eyebrow: "5:00 AM PROTOCOL",
      lock_in_spotlight_headline: "SURPASS YOUR LIMITS",
      lock_in_spotlight_statement: "IGNORE THE NOISE. LOCK IN.",
      lock_in_spotlight_cta_label: "GO BEAST MODE",
      recent_releases_eyebrow: "Recent Releases",
      recent_releases_heading: "Pick A Poison",
      recent_releases_description:
        "Three random tracks from the vvviruz catalog. Refresh for a new signal.",
      recent_releases_view_all_label: "View all",
      exclusive_cta_eyebrow: "From the vault",
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
    projects: {
      approved_slugs: [...PUBLIC_PROJECT_SLUGS],
      homepage_eyebrow: "Explore projects",
      homepage_heading: "The worlds inside the catalog",
      homepage_description:
        "Recurring series and connected releases, organized by the ideas that keep evolving.",
      homepage_card_cta_label: "View project",
      index_meta_title: "Projects",
      index_meta_description:
        "Explore the recurring series and creative worlds behind vvviruz releases.",
      index_heading: "Projects",
      index_description:
        "Explore the recurring series and creative worlds behind vvviruz releases.",
      index_browse_label: "Browse all music",
      index_card_cta_label: "Explore",
      empty_heading: "The projects are taking shape.",
      empty_description:
        "Explore the full catalog while the next recurring series is prepared.",
      empty_cta_label: "Explore music",
      not_found_eyebrow: "Project unavailable",
      not_found_heading: "That project is not public.",
      not_found_description:
        "It may still be taking shape. The complete public catalog is available now.",
      not_found_cta_label: "Explore music"
    },
    artist_directory: {
      metadata_title: "Artist Profiles",
      metadata_description:
        "Explore independent artist profiles, selected releases, creative context, and official listening links.",
      eyebrow: "Independent signals",
      heading: "Artist Profiles",
      description:
        "Meet the artists behind the music through focused profiles, selected releases, editorial context, and direct links to their wider catalog.",
      card_eyebrow: "Artist profile",
      empty_eyebrow: "Profiles in progress",
      empty_heading: "The first published artist profile will appear here.",
      empty_description:
        "Approved profiles remain private until their final published version is confirmed."
    },
    intel: {
      rail_label: "Latest Intel",
      cta_label: "Read update"
    },
    music: {
      page_eyebrow: "Discography",
      page_heading: "Published releases",
      page_description:
        "Every public vvviruz release lives here. Use the type filter if you want to move between nerdcore and mainstream releases faster.",
      all_releases_label: "All Releases",
      nerdcore_label: "Nerdcore",
      mainstream_label: "Mainstream",
      empty_state_text: "No published releases match this filter yet.",
      releases_tab_label: "Releases",
      appears_on_tab_label: "Appears On",
      browse_projects_label: "Browse Projects",
      showing_label: "Showing",
      open_project_label: "Open project hub",
      clear_filter_label: "Clear filter",
      appears_on_empty_text: "No collaborations or features published yet.",
      search_label: "Search Releases",
      search_placeholder: "Find a release by title, type, or description",
      search_empty_text:
        "No releases match that search yet. Try a title, type, or keyword."
  },
  about: {
    hero_cta_label: "Explore the music",
    statement_heading: "Artist Statement",
    statement_text:
      "Gymrat - Nerd - Lyricist: The Avatar In Real Life.\nSurpassing Limits In Every Lane While Documenting The Process.",
    artist_image_file: DEFAULT_SITE_ARTIST_IMAGE_FILE,
    narrative_heading: "A structured look at the world behind the catalog.",
    intro_heading: "Intro",
    intro_text:
      "vvviruz is a high-energy music artist blending bilingual and trilingual rap with anime, gaming, ambition, and pressure-tested performance.",
    philosophy_heading: "Philosophy",
    philosophy_text:
      "Nerd culture shapes the stories. Fitness shapes the discipline and performance. Every lane feeds back into the music.",
    closing_heading: "Closing Line",
    closing_text:
      "There is the raw side: high-energy records designed for impact, movement, and repeat plays.",
    connect_heading: "Tap into the signal.",
    connect_empty_text: "Social links coming soon.",
    contact_microcopy: "For collaborations, media, or direct inquiries, reach out here.",
    contact_empty_text: "inquiry@vvviruz.com",
    catalog_eyebrow: "Start here",
    catalog_heading: "The clearest introduction is the music",
    catalog_description:
      "Explore the releases, recurring projects, and latest records shaping the vvviruz sound.",
    catalog_primary_cta_label: "Explore music",
    catalog_secondary_cta_label: "Play the latest release"
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
    badge_text: "Insider Access",
    headline: "Join Insider Access",
    subtext: "Join the private list for early access to unreleased previews, work-in-progress drafts, and our Discord community.",
    brand_line: "Insider Access",
    cta_label: "Join Insider Access",
    name_label: "Name",
    email_label: "Email",
    consent_label:
      "By signing up, you'll receive this preview and future vvviruz updates. You can unsubscribe anytime.",
    success_heading: "Insider Access Unlocked",
    success_message: "You're in. Your Insider Access is unlocked.",
    duplicate_message:
      "You're already on the list. Your Insider Access is unlocked.",
    download_label: "Download the preview",
    unavailable_heading: "Insider Access unavailable",
    unavailable_body:
      "Insider Access is currently closed. Check back soon for the next update.",
    exclusive_track_title: "",
    exclusive_track_description: "",
    exclusive_track_file_path: "",
    exclusive_track_art_path: "",
    exclusive_track_enabled: true,
    release_id: null,
    unlock_experience: "instant_unlock",
    private_external_url: "",
    instant_unlock_button_label: "Access the Current Preview",
    also_email_link: true,
    email_subject: "Insider Access Unlocked",
    email_body: "Your Insider Access is ready. Use the button below to access the current private preview.\n\nNote that previews rotate as new songs release, so check back often to hear the latest unreleased material!",
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
    community_benefits: DEFAULT_EXCLUSIVE_COMMUNITY_BENEFITS,
    preview_private_notice:
      "This private preview is unlisted. Please check back often as previews rotate out when commercial releases occur.",
    preview_status_label: "Preview Status",
    activated_heading: "Insider Access Activated",
    activated_body:
      "You are signed up! There is no active preview right now, but you will receive an email notice when the next track is uploaded.",
    discord_unavailable_label: "Coming Soon",
    discord_unavailable_helper: "Discord invite coming soon."
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
  },
  vault: {
    is_enabled: false,
    badge_text: "DIGITAL-ONLY VAULT DROP",
    title: "THE VAULT: DROP 001",
    subtitle: "Five tracks that will never hit streaming.",
    body: "A direct-to-fan bundle built outside the release calendar. The songs stay in the Vault and arrive as digital files when the drop opens.",
    cta_label: "Get the Drop Notice",
    cta_url: "/exclusives",
    benefits: [
      {
        id: "vault-benefit-1",
        title: "Five Vault Tracks",
        description: "One complete digital bundle made for direct listeners."
      },
      {
        id: "vault-benefit-2",
        title: "Never on Streaming",
        description: "These songs will not be released to Spotify, Apple Music, or YouTube Music."
      },
      {
        id: "vault-benefit-3",
        title: "Digital Delivery",
        description: "Gumroad will handle secure checkout and access to the finished files."
      },
      {
        id: "vault-benefit-4",
        title: "",
        description: ""
      }
    ],
    waitlist_consent_label:
      "Send me this Vault drop notice and future vvviruz updates. I can unsubscribe anytime.",
    waitlist_success_heading: "Signal received",
    waitlist_note:
      "No payment is being collected yet. This only adds you to the Vault update list.",
    future_updates_heading: "Get notified about future Vault drops",
    future_updates_description:
      "Optional. Gumroad checkout stays separate and direct.",
    future_updates_consent_label:
      "Send me future vvviruz Vault drops and updates. I can unsubscribe anytime.",
    future_updates_cta_label: "Notify Me About the Next Drop",
    more_eyebrow: "More from the Vault",
    more_heading: "Other direct-to-fan drops",
    preview_cta_label: "Preview",
    item_purchase_cta_label: "Get it"
  },
  commissions: {
    is_enabled: true,
    metadata_title: "Commissions",
    metadata_open_description:
      "Request custom hooks, verses, full custom songs, or collab features from vvviruz.",
    metadata_closed_description:
      "Commission requests from vvviruz are currently closed. Check the page for availability updates.",
    page_eyebrow: "Work With vvviruz",
    page_title: "Custom hooks, verses, and songs from vvviruz.",
    page_subtitle: "Need bilingual bars, anime-level energy, or a custom track built around your idea? Submit a request and I’ll review the fit.",
    card_title: "Custom Hook / Verse",
    card_price: "Custom quote",
    card_description: "Need a catchy hook, a custom verse, or both for your track? Send the beat, topic, and direction. I’ll review the fit, then write and record a part tailored to your song.",
    card_button_text: "Request Hook / Verse",
    closed_message: "Commissions are currently closed. Check back soon.",
    closed_eyebrow: "Commissions",
    closed_heading: "Requests are currently closed",
    closed_cta_label: "Explore the catalog",
    services: [
      {
        id: "service-hook-verse",
        title: "Custom Hook / Verse",
        description:
          "Need a catchy hook, a custom verse, or both for your track? Send the beat, topic, and direction. I’ll review the fit, then write and record a part tailored to your song."
      },
      {
        id: "service-custom-song",
        title: "Full Custom Song",
        description:
          "A custom song built around your topic, character, story, brand, or concept. Final quote depends on length, deadline, and usage."
      },
      {
        id: "service-collab-feature",
        title: "Collab / Feature Inquiry",
        description:
          "For artists looking to collaborate, co-release, or get a vvviruz feature. Splits, credits, and release terms must be agreed before delivery."
      }
    ],
    quote_eyebrow: "Custom quote",
    quote_description:
      "Pricing depends on the request type, scope, deadline, usage, revisions, and required deliverables. Submit your brief and you will receive a quote before work begins.",
    terms_primary:
      "Custom dedications or supporter mentions can be requested, but placement depends on creative fit and is not guaranteed on any specific release unless agreed directly.",
    terms_secondary:
      "Submitting a request does not guarantee acceptance. Custom work is reviewed before approval. Pricing, rights, credits, splits, turnaround time, and delivery details must be agreed before work begins. Payment is handled externally through PayPal for now.",
    form_heading: "Start a Request",
    form_success_heading: "Request Received",
    form_disclaimer:
      "Submitting a request does not guarantee acceptance. Custom work is reviewed before approval. Payment is handled externally through PayPal for now.",
    name_label: "Name",
    name_placeholder: "Your name or artist name",
    email_label: "Email",
    email_placeholder: "For communication & quote",
    request_type_label: "Request Type",
    request_type_placeholder: "Select a service...",
    other_service_label: "Other",
    budget_label: "Budget Range",
    budget_placeholder: "Select a range...",
    usage_label: "Usage Intent",
    usage_placeholder: "Select intent...",
    deadline_label: "Deadline",
    deadline_placeholder: "Select deadline...",
    specific_date_label: "Specific Date (Optional)",
    specific_date_placeholder: "e.g., Oct 31st",
    topic_label: "Topic / Concept",
    topic_placeholder:
      "What is the song about? Describe the story, character, or vibe you want.",
    beat_link_label: "Beat Link (Optional)",
    beat_link_placeholder: "YouTube, Soundcloud, Drive, etc.",
    reference_link_label: "Reference Link (Optional)",
    reference_link_placeholder: "A song with a similar vibe",
    notes_label: "Additional Notes (Optional)",
    notes_placeholder: "Any extra details or requests?",
    submit_label: "Submit Request",
    submitting_label: "Submitting...",
    budget_options: [
      "Under $100",
      "$100 - $250",
      "$250 - $500",
      "$500+",
      "Not sure yet"
    ],
    usage_options: [
      "Personal",
      "Commercial release",
      "YouTube / social content",
      "Gift",
      "Brand / project",
      "Not sure yet"
    ],
    deadline_options: [
      "No rush",
      "1 week",
      "2 weeks",
      "1 month",
      "Specific date"
    ]
  }
};
}

function normalizeStringOptions(
  values: string[] | undefined,
  fallback: string[]
) {
  if (!values?.length) {
    return fallback;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .slice(0, 20);

  return normalized.length ? normalized : fallback;
}

function mergeSiteContentDefaults(input?: Partial<SiteContentSettings> | null): SiteContentSettings {
  const defaults = createDefaultSiteContent();
  const allowedMoreHrefs = new Set([
    "/projects",
    "/artists",
    "/commissions",
    "/vault",
    "/about",
    "/exclusives",
    "/links",
    "/music"
  ]);
  const normalizedLinksBadgeText = input?.links?.badge_text?.trim();
  const normalizedBrandMarkFile = input?.chrome?.brand_mark_file?.trim();
  const normalizedArtistImageFile = input?.about?.artist_image_file?.trim();
  const normalizedExclusiveNavLabel = input?.chrome?.nav_exclusive_label?.trim();
  const normalizedLinksNavLabel = input?.chrome?.nav_links_label?.trim();
  const normalizedExclusivePageTitle = input?.metadata?.exclusive_page_title?.trim();
  const normalizedCommunityHeadline = input?.exclusive?.community_headline?.trim();
  const normalizedCommunityCtaLabel = input?.exclusive?.community_cta_label?.trim();
  const normalizedExclusiveConsentLabel = input?.exclusive?.consent_label?.trim();
  const normalizedExclusiveCtaDescription = input?.home?.exclusive_cta_description?.trim();
  const exclusiveUnlockExperience =
    input?.exclusive?.unlock_experience || defaults.exclusive.unlock_experience;
  const normalizedAboutIntro = input?.about?.intro_text?.trim();
  const normalizedAboutPhilosophy = input?.about?.philosophy_text?.trim();

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
      desktop_more_hrefs: (
        input?.chrome?.desktop_more_hrefs ?? defaults.chrome.desktop_more_hrefs
      )
        .map((value) => value.trim())
        .filter((value, index, values) => {
          return allowedMoreHrefs.has(value) && values.indexOf(value) === index;
        }),
      nav_exclusive_label:
        !normalizedExclusiveNavLabel ||
        normalizedExclusiveNavLabel.toLowerCase() === "exclusive"
          ? defaults.chrome.nav_exclusive_label
          : normalizedExclusiveNavLabel,
      nav_links_label:
        !normalizedLinksNavLabel ||
        ["links", "new release", "latest release"].includes(
          normalizedLinksNavLabel.toLowerCase()
        )
          ? defaults.chrome.nav_links_label
          : normalizedLinksNavLabel
    },
    home: {
      ...defaults.home,
      ...input?.home,
      exclusive_cta_description:
        !normalizedExclusiveCtaDescription ||
        normalizedExclusiveCtaDescription ===
          "Join Insider Access for unreleased previews, early updates, and the private vvviruz community."
          ? defaults.home.exclusive_cta_description
          : normalizedExclusiveCtaDescription,
      featured_release_ids:
        input?.home?.featured_release_ids
          ?.map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 3) || defaults.home.featured_release_ids,
      built_for_motion_release_ids: (
        input?.home?.built_for_motion_release_ids?.length
          ? input.home.built_for_motion_release_ids
          : input?.home?.built_for_motion_release_id
            ? [input.home.built_for_motion_release_id]
            : defaults.home.built_for_motion_release_ids
      )
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 6),
      built_for_motion_heading:
        input?.home?.built_for_motion_heading?.trim() ||
        defaults.home.built_for_motion_heading,
      built_for_motion_description:
        input?.home?.built_for_motion_description?.trim() ||
        defaults.home.built_for_motion_description,
      lock_in_spotlight_release_id:
        input?.home?.lock_in_spotlight_release_id?.trim() || "",
      lock_in_spotlight_eyebrow:
        input?.home?.lock_in_spotlight_eyebrow?.trim() ||
        defaults.home.lock_in_spotlight_eyebrow,
      lock_in_spotlight_headline:
        input?.home?.lock_in_spotlight_headline?.trim() ||
        defaults.home.lock_in_spotlight_headline,
      lock_in_spotlight_statement:
        input?.home?.lock_in_spotlight_statement?.trim() ||
        defaults.home.lock_in_spotlight_statement,
      lock_in_spotlight_cta_label:
        input?.home?.lock_in_spotlight_cta_label?.trim() ||
        defaults.home.lock_in_spotlight_cta_label,
      recent_releases_heading:
        !input?.home?.recent_releases_heading ||
        ["latest drops", "pick a glitch"].includes(
          input.home.recent_releases_heading.trim().toLowerCase()
        )
          ? defaults.home.recent_releases_heading
          : input.home.recent_releases_heading,
      brand_pillars: defaults.home.brand_pillars.map((defaultPillar, index) => {
        const inputPillar = input?.home?.brand_pillars?.[index];

        if (!inputPillar) {
          return defaultPillar;
        }

        return {
          id: inputPillar.id || defaultPillar.id || createId(),
          title: inputPillar.title || defaultPillar.title,
          description: inputPillar.description || defaultPillar.description,
          imageFile: resolveBrandPillarImageFile(
            inputPillar.imageFile || defaultPillar.imageFile,
            index
          )
        };
      })
    },
    projects: {
      ...defaults.projects,
      ...input?.projects,
      approved_slugs: normalizeApprovedPublicProjectSlugs(
        input?.projects?.approved_slugs ?? defaults.projects.approved_slugs
      )
    },
    artist_directory: {
      ...defaults.artist_directory,
      ...input?.artist_directory
    },
    intel: {
      ...defaults.intel,
      ...input?.intel
    },
    music: {
      ...defaults.music,
      ...input?.music
    },
    about: {
      ...defaults.about,
      ...input?.about,
      artist_image_file: normalizedArtistImageFile || defaults.about.artist_image_file,
      intro_text:
        normalizedAboutIntro === LEGACY_ABOUT_INTRO
          ? defaults.about.intro_text
          : normalizedAboutIntro || defaults.about.intro_text,
      philosophy_text:
        normalizedAboutPhilosophy === LEGACY_ABOUT_PHILOSOPHY
          ? defaults.about.philosophy_text
          : normalizedAboutPhilosophy || defaults.about.philosophy_text
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
      release_id: input?.exclusive?.release_id !== undefined ? (input.exclusive.release_id?.trim() || null) : null,
      unlock_experience: exclusiveUnlockExperience,
      instant_unlock_button_label: input?.exclusive?.instant_unlock_button_label || defaults.exclusive.instant_unlock_button_label,
      success_heading:
        !input?.exclusive?.success_heading?.trim() ||
        hasLegacyEncoding(input.exclusive.success_heading)
          ? DEFAULT_EXCLUSIVE_SUCCESS_HEADING
          : input.exclusive.success_heading.trim(),
      success_message: normalizeModeSafeExclusiveMessage(
        input?.exclusive?.success_message,
        DEFAULT_EXCLUSIVE_SUCCESS_MESSAGE,
        exclusiveUnlockExperience
      ),
      duplicate_message: normalizeModeSafeExclusiveMessage(
        input?.exclusive?.duplicate_message,
        DEFAULT_EXCLUSIVE_DUPLICATE_MESSAGE,
        exclusiveUnlockExperience
      ),
      also_email_link:
        exclusiveUnlockExperience === "instant_unlock"
          ? input?.exclusive?.also_email_link ?? defaults.exclusive.also_email_link
          : false,
      consent_label:
        !normalizedExclusiveConsentLabel ||
        normalizedExclusiveConsentLabel === "Send me future vvviruz updates and previews."
          ? defaults.exclusive.consent_label
          : normalizedExclusiveConsentLabel,
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
    },
    vault: {
      ...defaults.vault,
      ...input?.vault,
      benefits: input?.vault?.benefits?.length
        ? input.vault.benefits.map((benefit, index) => {
            const defaultBenefit = defaults.vault.benefits[index] ?? defaults.vault.benefits[0];
            return {
              id: benefit.id || defaultBenefit.id,
              title: benefit.title || defaultBenefit.title,
              description: benefit.description || defaultBenefit.description
            };
          })
        : defaults.vault.benefits
    },
    commissions: {
      ...defaults.commissions,
      ...input?.commissions,
      services: input?.commissions?.services?.length
        ? input.commissions.services
            .map((service) => ({
              id: service.id?.trim() || createId(),
              title: service.title?.trim() || "",
              description: service.description?.trim() || ""
            }))
            .filter((service) => service.title)
            .slice(0, 8)
        : defaults.commissions.services,
      budget_options: normalizeStringOptions(
        input?.commissions?.budget_options,
        defaults.commissions.budget_options
      ),
      usage_options: normalizeStringOptions(
        input?.commissions?.usage_options,
        defaults.commissions.usage_options
      ),
      deadline_options: normalizeStringOptions(
        input?.commissions?.deadline_options,
        defaults.commissions.deadline_options
      )
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
    nav_hubs: [],
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

  const hubs = await prisma.linkHub.findMany({
    where: {
      isEnabled: true,
      showInPublicNav: true
    },
    orderBy: [
      { sortOrder: "asc" },
      { path: "asc" }
    ]
  });

  const hasLinks = hubs.some((h) => h.path === "links");
  let finalHubs = hubs;
  if (!hasLinks) {
    const { readLinkHubs } = await import("./link-hubs");
    await readLinkHubs();
    finalHubs = await prisma.linkHub.findMany({
      where: {
        isEnabled: true,
        showInPublicNav: true
      },
      orderBy: [
        { sortOrder: "asc" },
        { path: "asc" }
      ]
    });
  }

  const nav_hubs = finalHubs.map((h) => ({
    path: h.path,
    label: h.label || "Links"
  }));

  if (!existing) {
    const defaults = createDefaultSiteSettings();

    await writeSiteSettings(defaults);

    return {
      ...defaults,
      nav_hubs
    };
  }

  const record = toSiteSettingsRecord(existing);
  const defaults = createDefaultSiteSettings();

  return {
    ...record,
    nav_hubs,
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
