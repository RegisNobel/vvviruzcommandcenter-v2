import type {PublicReleaseAnnotation} from "@/lib/types";

export const ARTIST_THEME_FAMILIES = [
  {value: "signal-noir", label: "Signal Noir"},
  {value: "neon-circuit", label: "Neon Circuit"},
  {value: "crimson-voltage", label: "Crimson Voltage"},
  {value: "violet-haze", label: "Violet Haze"},
  {value: "golden-hour", label: "Golden Hour"},
  {value: "arctic-glass", label: "Arctic Glass"},
  {value: "forest-static", label: "Forest Static"},
  {value: "rose-chrome", label: "Rose Chrome"},
  {value: "monochrome", label: "Monochrome"},
  {value: "ocean-depth", label: "Ocean Depth"}
] as const;

export type ArtistThemeFamily = (typeof ARTIST_THEME_FAMILIES)[number]["value"];

export const DEFAULT_ARTIST_THEME_FAMILY: ArtistThemeFamily = "signal-noir";
export const MAX_ARTIST_HOMEPAGE_RELEASE_PLACEMENTS = 3;

export function normalizeArtistThemeFamily(value: string): ArtistThemeFamily {
  return ARTIST_THEME_FAMILIES.some((theme) => theme.value === value)
    ? (value as ArtistThemeFamily)
    : DEFAULT_ARTIST_THEME_FAMILY;
}

export function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

export function getCountryFlagImageUrl(value: string) {
  const code = normalizeCountryCode(value);
  if (code.length !== 2) return "";
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

export type ArtistEditorialReleaseSnapshot = {
  id: string;
  slug: string;
  title: string;
  catalogScope: "VVVIRUZ" | "ARTIST";
  primaryArtistProfileId: string;
  primaryArtistName: string;
  credits: Array<{name: string; role: string}>;
  releaseDate: string;
  type: string;
  coverArtUrl: string;
  coverArtAlt: string;
  description: string;
  story: string;
  context: string;
  languages: string[];
  genres: string[];
  moods: string[];
  themes: string[];
  listenerContexts: string[];
  streamingLinks: {
    spotify: string;
    appleMusic: string;
    youtube: string;
  };
  featuredVideoUrl: string;
  lyrics: string;
  publicLyricsEnabled: boolean;
  lyricsRightsConfirmed: boolean;
  editorialEnabled: boolean;
  annotations: PublicReleaseAnnotation[];
};

export type ArtistProfileLink = {
  platform: string;
  label: string;
  url: string;
  isPrimary?: boolean;
};

export type ArtistProfileFeaturedItem = {
  placementId?: string;
  releaseId?: string;
  itemType: "track" | "single" | "ep" | "album" | "project" | "collaboration";
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  coverArtUrl: string;
  coverArtAlt: string;
  isStartHere: boolean;
  editorialRelease?: ArtistEditorialReleaseSnapshot;
};

export type ArtistProfilePageCopy = {
  signalLabel: string;
  heroEyebrow: string;
  storyLabel: string;
  storyHeading: string;
  fingerprintLabel: string;
  featuredButtonLabel: string;
  selectedLabel: string;
  selectedHeading: string;
  platformLabel: string;
};

export const DEFAULT_ARTIST_PAGE_COPY: ArtistProfilePageCopy = {
  signalLabel: "Signal",
  heroEyebrow: "Managed artist profile",
  storyLabel: "01 / Field notes",
  storyHeading: "Melody under pressure.",
  fingerprintLabel: "Creative fingerprint",
  featuredButtonLabel: "Explore the release",
  selectedLabel: "02 / Selected signals",
  selectedHeading: "More from the artist",
  platformLabel: "Follow the signal"
};

export type ArtistProfileExpansionConfig = {
  catalogEnabled: boolean;
  catalogTitle: string;
  catalogIntro: string;
  catalogCtaLabel: string;
  catalogReleaseIds: string[];
  editorialReleaseIds: string[];
  featuredStoriesEnabled: boolean;
  featuredStoriesLabel: string;
  featuredStoriesHeading: string;
};

export const DEFAULT_ARTIST_EXPANSION_CONFIG: ArtistProfileExpansionConfig = {
  catalogEnabled: false,
  catalogTitle: "Releases",
  catalogIntro: "",
  catalogCtaLabel: "View all releases",
  catalogReleaseIds: [],
  editorialReleaseIds: [],
  featuredStoriesEnabled: false,
  featuredStoriesLabel: "Featured stories",
  featuredStoriesHeading: "Go deeper"
};

export type ArtistProfileSnapshot = {
  schemaVersion: 5;
  artistProfileId: string;
  slug: string;
  displayName: string;
  location: string;
  locationCountryCode: string;
  themeFamily: ArtistThemeFamily;
  longBio: string;
  differentiator: string;
  genres: string[];
  primaryCta: {label: string; url: string};
  secondaryCta: {label: string; url: string};
  profileImage: {url: string; alt: string};
  pageCopy: ArtistProfilePageCopy;
  seo: {title: string; description: string; socialImageUrl: string};
  links: ArtistProfileLink[];
  featuredItems: ArtistProfileFeaturedItem[];
  featuredStories: ArtistProfileFeaturedItem[];
  expansion: ArtistProfileExpansionConfig;
  releaseLibrary: ArtistEditorialReleaseSnapshot[];
  updatedAt: string;
};

export type ArtistProfileEditorRecord = ArtistProfileSnapshot & {
  privateContactEmail: string;
  workflowStatus: string;
  publishedVersionId: string | null;
  latestVersion: {
    id: string;
    version: number;
    approvalStatus: string;
    createdAt: string;
    approvedAt: string | null;
    publishedAt: string | null;
    previewExpiresAt: string | null;
    previewRevokedAt: string | null;
    previewSupersededAt: string | null;
    previewIsExpired: boolean;
    approval: {
      decidedByEmail: string;
      notes: string;
      decidedAt: string;
    } | null;
  } | null;
  releaseOptions: Array<{
    id: string;
    title: string;
    slug: string;
    catalogScope: "VVVIRUZ" | "ARTIST";
    primaryArtistProfileId: string;
  }>;
};

export function getArtistFeaturedItemHref(
  profile: Pick<ArtistProfileSnapshot, "slug">,
  item: ArtistProfileFeaturedItem,
  previewToken?: string
) {
  const release = item.editorialRelease;
  if (!release) return item.url;
  if (previewToken) {
    return `/preview/artists/${encodeURIComponent(previewToken)}/music/${encodeURIComponent(release.slug)}`;
  }
  return `/artists/${encodeURIComponent(profile.slug)}/music/${encodeURIComponent(release.slug)}`;
}

export function getArtistEditorialReleaseHref(
  profile: Pick<ArtistProfileSnapshot, "slug">,
  release: ArtistEditorialReleaseSnapshot,
  previewToken?: string
) {
  if (previewToken) {
    return `/preview/artists/${encodeURIComponent(previewToken)}/music/${encodeURIComponent(release.slug)}`;
  }
  return `/artists/${encodeURIComponent(profile.slug)}/music/${encodeURIComponent(release.slug)}`;
}

export function getArtistCatalogReleaseHref(
  profile: Pick<ArtistProfileSnapshot, "slug">,
  release: ArtistEditorialReleaseSnapshot,
  previewToken?: string
) {
  if (release.editorialEnabled) {
    return getArtistEditorialReleaseHref(profile, release, previewToken);
  }
  return (
    release.streamingLinks.youtube ||
    release.streamingLinks.spotify ||
    release.streamingLinks.appleMusic ||
    "#"
  );
}

export function getArtistProfileDescription(
  profile: Pick<ArtistProfileSnapshot, "longBio" | "differentiator">,
  maxLength = 160
) {
  const description = (profile.longBio || profile.differentiator)
    .replace(/\s+/g, " ")
    .trim();
  if (description.length <= maxLength) return description;
  return `${description.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function normalizeArtistFeaturedItems(items: ArtistProfileFeaturedItem[]) {
  const limited = items.slice(0, MAX_ARTIST_HOMEPAGE_RELEASE_PLACEMENTS);
  if (!limited.length) return limited;
  const selectedIndex = limited.findIndex((item) => item.isStartHere);
  const featuredIndex =
    selectedIndex >= 0
      ? selectedIndex
      : Math.max(
          0,
          limited.findIndex((item) => Boolean(item.releaseId || item.editorialRelease))
        );
  return limited.map((item, index) => ({
    ...item,
    isStartHere: index === featuredIndex
  }));
}

export function normalizeArtistFeaturedStories(items: ArtistProfileFeaturedItem[]) {
  return items.map((item) => ({...item, isStartHere: false}));
}

export function parseArtistProfileSnapshot(value: string): ArtistProfileSnapshot | null {
  try {
    const parsed = JSON.parse(value) as Partial<ArtistProfileSnapshot> & {
      schemaVersion?: number;
      tagline?: string;
      shortBio?: string;
    };
    if (![1, 2, 3, 4, 5].includes(parsed?.schemaVersion ?? 0) || !parsed.slug || !parsed.displayName) {
      return null;
    }
    const current = {...parsed};
    delete current.tagline;
    delete current.shortBio;
    const featuredItems = normalizeArtistFeaturedItems(
      (parsed.featuredItems ?? []).map((item) => ({
        ...item,
        coverArtAlt: item.coverArtAlt || "",
        releaseId: item.releaseId || undefined,
        editorialRelease: item.editorialRelease
          ? {...item.editorialRelease, editorialEnabled: true}
          : undefined
      }))
    );
    const featuredStories = normalizeArtistFeaturedStories(parsed.featuredStories ?? []);
    const expansion = {
      ...DEFAULT_ARTIST_EXPANSION_CONFIG,
      ...parsed.expansion,
      catalogReleaseIds: parsed.expansion?.catalogReleaseIds ?? [],
      editorialReleaseIds: parsed.expansion?.editorialReleaseIds ?? []
    };
    const legacyReleaseLibrary = featuredItems.flatMap((item) =>
      item.editorialRelease ? [item.editorialRelease] : []
    );
    const releaseLibrary = Array.from(
      new Map(
        (parsed.releaseLibrary ?? legacyReleaseLibrary).map((release) => [
          release.id,
          {
            ...release,
            editorialEnabled:
              Boolean(release.editorialEnabled) ||
              expansion.editorialReleaseIds.includes(release.id) ||
              featuredItems.some((item) => item.releaseId === release.id) ||
              featuredStories.some((item) => item.releaseId === release.id)
          }
        ])
      ).values()
    );
    return {
      ...current,
      schemaVersion: 5,
      locationCountryCode: normalizeCountryCode(parsed.locationCountryCode || ""),
      themeFamily: normalizeArtistThemeFamily(parsed.themeFamily || ""),
      pageCopy: {
        ...DEFAULT_ARTIST_PAGE_COPY,
        selectedHeading: `More from ${parsed.displayName}`,
        ...parsed.pageCopy
      },
      seo: {
        title: parsed.seo?.title || "",
        description: parsed.seo?.description || "",
        socialImageUrl: parsed.seo?.socialImageUrl || ""
      },
      featuredItems,
      featuredStories,
      expansion,
      releaseLibrary
    } as ArtistProfileSnapshot;
  } catch {
    return null;
  }
}
