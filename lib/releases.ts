import type {
  ReleaseCoverAsset,
  ReleaseRecord,
  ReleaseStageLabel,
  ReleaseStatus,
  ReleaseStreamingLinks,
  ReleaseSummary,
  ReleaseTask
} from "@/lib/types";
import {
  calculateReleaseProgress,
  getReleasePlanningStageLabel,
  getReleaseProgressTone,
  hasReleaseCoverArt,
  releaseChecklistKeys,
  type ReleaseChecklistKey
} from "@/lib/release-planning";
import {createId, slugify} from "@/lib/utils";

export {
  calculateReleaseProgress,
  getReleaseProgressTone,
  hasReleaseCoverArt,
  releaseChecklistKeys,
  type ReleaseChecklistKey
};

export const releaseStatusOptions = [
  "Concept Complete",
  "Beat Made",
  "Lyrics Finished",
  "Recorded",
  "Mix/Mastered",
  "Published"
] as const satisfies ReadonlyArray<ReleaseStatus>;

type LegacyStreamingLinksShape = Partial<ReleaseStreamingLinks> & {
  appleMusic?: string;
};

const releasePublishRequirementLabels = {
  title: "Missing public title",
  slug: "Missing public slug",
  release_date: "Missing public release date",
  cover_art: "Missing public cover art",
  public_description: "Missing public description",
  streaming_link: "Add at least one streaming link"
} as const;

function derivePublicCoverPath(url: string | null | undefined) {
  return url?.trim() || "";
}

const releaseStageEntries: Array<{
  key: ReleaseChecklistKey;
  label: ReleaseStatus;
}> = [
  {key: "concept_complete", label: "Concept Complete"},
  {key: "beat_made", label: "Beat Made"},
  {key: "lyrics_finished", label: "Lyrics Finished"},
  {key: "recorded", label: "Recorded"},
  {key: "mix_mastered", label: "Mix/Mastered"},
  {key: "published", label: "Published"}
];

type LegacyReleaseShape = Partial<ReleaseRecord> & {
  concept?: string;
  beat_ready?: boolean;
  written?: boolean;
  mixed?: boolean;
  mastered?: boolean;
  created_at?: string;
  updated_at?: string;
  cover_done?: boolean;
  visualizer_done?: boolean;
  clips_done?: boolean;
  teaser_done?: boolean;
  reel_done?: boolean;
  amv_idea?: boolean;
  release_post_ready?: boolean;
  type?: string;
  status?: string;
  UPC?: string;
  ISRC?: string;
  pinned?: boolean;
  cover_art?: Partial<ReleaseCoverAsset> | null;
  streaming_links?: Partial<ReleaseStreamingLinks> | null;
  streamingLinks?: Partial<ReleaseStreamingLinks> | null;
  spotify?: string;
  apple_music?: string;
  appleMusic?: string;
  youtube?: string;
  slug?: string;
  cover_art_path?: string;
  public_description?: string;
  public_long_description?: string;
  seoTitle?: string;
  seo_title?: string;
  metaDescription?: string;
  meta_description?: string;
  coverArtAltText?: string;
  cover_art_alt_text?: string;
  socialShareTitle?: string;
  social_share_title?: string;
  socialShareDescription?: string;
  social_share_description?: string;
  featured_video_url?: string;
  public_lyrics_enabled?: boolean;
  is_published?: boolean;
  is_featured?: boolean;
};

function normalizeReleaseType(value: string | undefined): ReleaseRecord["type"] {
  return value === "mainstream" ? "mainstream" : "nerdcore";
}

function normalizeReleaseStatus(value: string | undefined): ReleaseStatus {
  if (value === "Writing") {
    return "Lyrics Finished";
  }

  if (value === "Recording") {
    return "Recorded";
  }

  if (value === "Production") {
    return "Mix/Mastered";
  }

  if (value === "Released") {
    return "Published";
  }

  return releaseStatusOptions.includes(value as ReleaseStatus)
    ? (value as ReleaseStatus)
    : "Concept Complete";
}

export function getSuggestedReleaseSlug(title: string) {
  return slugify(title.trim()) || "untitled-release";
}

export function getReleasePublishBlockers(release: ReleaseRecord) {
  const blockers: string[] = [];

  if (!release.title.trim()) {
    blockers.push(releasePublishRequirementLabels.title);
  }

  if (!release.slug.trim()) {
    blockers.push(releasePublishRequirementLabels.slug);
  }

  if (!release.release_date.trim()) {
    blockers.push(releasePublishRequirementLabels.release_date);
  }

  if (!release.cover_art && !release.cover_art_path.trim()) {
    blockers.push(releasePublishRequirementLabels.cover_art);
  }

  if (!release.public_description.trim()) {
    blockers.push(releasePublishRequirementLabels.public_description);
  }

  const hasStreamingLink =
    Boolean(release.streaming_links.spotify.trim()) ||
    Boolean(release.streaming_links.apple_music.trim()) ||
    Boolean(release.streaming_links.youtube.trim());

  if (!hasStreamingLink) {
    blockers.push(releasePublishRequirementLabels.streaming_link);
  }

  return blockers;
}

export function isReleasePublishReady(release: ReleaseRecord) {
  return getReleasePublishBlockers(release).length === 0;
}

export function createReleaseTask(text = "New task"): ReleaseTask {
  return {
    id: createId(),
    text,
    completed: false
  };
}

export function createEmptyRelease(
  values?: Partial<
    Pick<
      ReleaseRecord,
      | "title"
      | "slug"
      | "type"
      | "release_date"
      | "collaborator"
      | "collaborator_name"
      | "upc"
      | "isrc"
      | "streaming_links"
      | "public_description"
      | "public_long_description"
      | "seo_title"
      | "meta_description"
      | "cover_art_alt_text"
      | "social_share_title"
      | "social_share_description"
      | "featured_video_url"
      | "public_lyrics_enabled"
      | "is_published"
      | "is_featured"
    >
  >
): ReleaseRecord {
  const now = new Date().toISOString();
  const collaborator = Boolean(values?.collaborator);
  const title = values?.title?.trim() || "Untitled Release";

  return {
    id: createId(),
    title,
    slug: values?.slug?.trim() || getSuggestedReleaseSlug(title),
    pinned: false,
    collaborator,
    collaborator_name: collaborator ? values?.collaborator_name?.trim() || "" : "",
    upc: values?.upc?.trim() || "",
    isrc: values?.isrc?.trim() || "",
    cover_art: null,
    cover_art_path: "",
    streaming_links: {
      spotify: values?.streaming_links?.spotify?.trim() || "",
      apple_music: values?.streaming_links?.apple_music?.trim() || "",
      youtube: values?.streaming_links?.youtube?.trim() || ""
    },
    lyrics: "",
    type: normalizeReleaseType(values?.type),
    release_date: values?.release_date ?? "",
    concept_details: "",
    public_description: values?.public_description?.trim() || "",
    public_long_description: values?.public_long_description?.trim() || "",
    seo_title: values?.seo_title?.trim() || "",
    meta_description: values?.meta_description?.trim() || "",
    cover_art_alt_text: values?.cover_art_alt_text?.trim() || "",
    social_share_title: values?.social_share_title?.trim() || "",
    social_share_description: values?.social_share_description?.trim() || "",
    featured_video_url: values?.featured_video_url?.trim() || "",
    public_lyrics_enabled: Boolean(values?.public_lyrics_enabled),
    is_published: Boolean(values?.is_published),
    is_featured: Boolean(values?.is_featured),
    concept_complete: false,
    beat_made: false,
    lyrics_finished: false,
    recorded: false,
    mix_mastered: false,
    published: false,
    tasks: [],
    created_on: now,
    updated_on: now
  };
}

export function hydrateRelease(input: LegacyReleaseShape): ReleaseRecord {
  const fallback = createEmptyRelease();
  const collaborator = Boolean(input.collaborator);
  const rawStreamingLinks =
    (input.streaming_links ?? input.streamingLinks ?? null) as LegacyStreamingLinksShape | null;
  const coverArt =
    input.cover_art &&
    typeof input.cover_art.id === "string" &&
    typeof input.cover_art.fileName === "string" &&
    typeof input.cover_art.url === "string"
      ? {
          id: input.cover_art.id,
          fileName: input.cover_art.fileName,
          url: input.cover_art.url,
          mimeType: input.cover_art.mimeType || "image/*"
        }
      : null;
  const mixed = Boolean(input.mix_mastered ?? input.mixed);
  const mastered = Boolean(input.mix_mastered ?? input.mastered);
  const rawStatus = input.status as string | undefined;
  const normalizedLegacyStatus = normalizeReleaseStatus(rawStatus);
  const legacyStageIndex = releaseStageEntries.findIndex(
    (entry) => entry.label === normalizedLegacyStatus
  );
  const hasExplicitStages = releaseChecklistKeys.some((key) => Boolean(input[key]));
  const derivedLegacyStages = releaseStageEntries.reduce<Record<ReleaseChecklistKey, boolean>>(
    (accumulator, entry, index) => {
      accumulator[entry.key] = !hasExplicitStages && legacyStageIndex >= index;
      return accumulator;
    },
    {
      concept_complete: false,
      beat_made: false,
      lyrics_finished: false,
      recorded: false,
      mix_mastered: false,
      published: false
    }
  );

  return {
    ...fallback,
    ...input,
    title: input.title?.trim() || fallback.title,
    slug:
      input.slug?.trim() ||
      getSuggestedReleaseSlug(input.title?.trim() || fallback.title),
    pinned: Boolean(input.pinned),
    collaborator,
    collaborator_name: collaborator ? input.collaborator_name?.trim() || "" : "",
    upc: input.upc?.trim() || input.UPC?.trim() || "",
    isrc: input.isrc?.trim() || input.ISRC?.trim() || "",
    cover_art: coverArt,
    cover_art_path:
      input.cover_art_path?.trim() || derivePublicCoverPath(coverArt?.url) || "",
    streaming_links: {
      spotify:
        rawStreamingLinks?.spotify?.trim() || input.spotify?.trim() || "",
      apple_music:
        rawStreamingLinks?.apple_music?.trim() ||
        rawStreamingLinks?.appleMusic?.trim() ||
        input.apple_music?.trim() ||
        input.appleMusic?.trim() ||
        "",
      youtube:
        rawStreamingLinks?.youtube?.trim() || input.youtube?.trim() || ""
    },
    lyrics: input.lyrics ?? "",
    type: normalizeReleaseType(input.type),
    release_date: input.release_date ?? "",
    concept_details: input.concept_details ?? input.concept ?? "",
    public_description:
      input.public_description?.trim() ||
      input.concept_details?.trim() ||
      input.concept?.trim() ||
      "",
    public_long_description: input.public_long_description?.trim() || "",
    seo_title: input.seo_title?.trim() || input.seoTitle?.trim() || "",
    meta_description:
      input.meta_description?.trim() || input.metaDescription?.trim() || "",
    cover_art_alt_text:
      input.cover_art_alt_text?.trim() || input.coverArtAltText?.trim() || "",
    social_share_title:
      input.social_share_title?.trim() || input.socialShareTitle?.trim() || "",
    social_share_description:
      input.social_share_description?.trim() ||
      input.socialShareDescription?.trim() ||
      "",
    featured_video_url: input.featured_video_url?.trim() || "",
    public_lyrics_enabled: Boolean(input.public_lyrics_enabled),
    is_published: Boolean(input.is_published),
    is_featured: Boolean(input.is_featured),
    concept_complete: Boolean(input.concept_complete ?? derivedLegacyStages.concept_complete),
    beat_made: Boolean(input.beat_made ?? input.beat_ready ?? derivedLegacyStages.beat_made),
    lyrics_finished: Boolean(
      input.lyrics_finished ?? input.written ?? derivedLegacyStages.lyrics_finished
    ),
    recorded: Boolean(input.recorded ?? derivedLegacyStages.recorded),
    mix_mastered: mixed || mastered || derivedLegacyStages.mix_mastered,
    published: Boolean(input.published ?? derivedLegacyStages.published),
    tasks: Array.isArray(input.tasks)
      ? input.tasks.map((task) => ({
          id: task.id || createId(),
          text: task.text?.trim() || "Untitled task",
          completed: Boolean(task.completed)
        }))
      : [],
    created_on: input.created_on ?? input.created_at ?? fallback.created_on,
    updated_on: input.updated_on ?? input.updated_at ?? fallback.updated_on
  };
}

export function touchRelease(release: ReleaseRecord): ReleaseRecord {
  return {
    ...release,
    updated_on: new Date().toISOString()
  };
}

export function getReleaseStageLabel(release: ReleaseRecord): ReleaseStageLabel {
  return getReleasePlanningStageLabel(release);
}

export function summarizeRelease(release: ReleaseRecord): ReleaseSummary {
  const discoveryChecklist = getDiscoveryChecklist(release);
  const passed = discoveryChecklist.filter((item) => item.status === "passed").length;
  const warning = discoveryChecklist.filter((item) => item.status === "warning").length;
  const missing = discoveryChecklist.filter((item) => item.status === "missing").length;
  const label = getDiscoveryReadinessLabel(discoveryChecklist);

  return {
    id: release.id,
    title: release.title,
    slug: release.slug,
    cover_art_path: release.cover_art_path,
    is_published: release.is_published,
    pinned: release.pinned,
    type: release.type,
    status: getReleaseStageLabel(release),
    release_date: release.release_date,
    collaborator_name: release.collaborator_name,
    upc: release.upc,
    isrc: release.isrc,
    progress_percentage: calculateReleaseProgress(release),
    updated_on: release.updated_on,
    discovery_status: label,
    discovery_passed: passed,
    discovery_warning: warning,
    discovery_missing: missing
  };
}

export type DiscoveryChecklistStatus = "passed" | "warning" | "missing";
export type DiscoveryChecklistPriority = "essential" | "polish" | "bonus";

export type DiscoveryChecklistItem = {
  detail: string;
  label: string;
  priority: DiscoveryChecklistPriority;
  status: DiscoveryChecklistStatus;
};

export function createDiscoveryChecklistItem({
  detail,
  hasFallback = false,
  hasValue,
  label,
  priority
}: {
  detail: string;
  hasFallback?: boolean;
  hasValue: boolean;
  label: string;
  priority: DiscoveryChecklistPriority;
}): DiscoveryChecklistItem {
  return {
    detail,
    label,
    priority,
    status: hasValue ? "passed" : hasFallback ? "warning" : "missing"
  };
}

export function getDiscoveryChecklist(release: ReleaseRecord): DiscoveryChecklistItem[] {
  const hasStreamingLink =
    Boolean(release.streaming_links.spotify.trim()) ||
    Boolean(release.streaming_links.apple_music.trim()) ||
    Boolean(release.streaming_links.youtube.trim());
  const hasTitle = Boolean(release.title.trim());
  const hasSeoTitle = Boolean(release.seo_title.trim());
  const hasPublicSummary = Boolean(release.public_description.trim());
  const hasMetaDescription = Boolean(release.meta_description.trim());
  const hasSocialShareTitle = Boolean(release.social_share_title.trim());
  const hasSocialShareDescription = Boolean(release.social_share_description.trim());
  const hasCoverArtAltText = Boolean(release.cover_art_alt_text.trim());
  const hasLyrics = Boolean(release.lyrics.trim());

  return [
    createDiscoveryChecklistItem({
      detail: hasSeoTitle
        ? "Dedicated SEO title is saved."
        : "Using the release title as the search title.",
      hasFallback: hasTitle,
      hasValue: hasSeoTitle,
      label: "SEO Title",
      priority: "polish"
    }),
    createDiscoveryChecklistItem({
      detail: hasMetaDescription
        ? "Dedicated search description is saved."
        : "Using the public summary as the search description.",
      hasFallback: hasPublicSummary,
      hasValue: hasMetaDescription,
      label: "Meta Description",
      priority: "essential"
    }),
    createDiscoveryChecklistItem({
      detail: hasCoverArtAltText
        ? "Cover art has a custom image description."
        : "Using the generated cover art description.",
      hasFallback: hasTitle,
      hasValue: hasCoverArtAltText,
      label: "Cover Art Alt Text",
      priority: "polish"
    }),
    createDiscoveryChecklistItem({
      detail: hasSocialShareTitle
        ? "Dedicated social title is saved."
        : "Using the SEO title or release title for shares.",
      hasFallback: hasSeoTitle || hasTitle,
      hasValue: hasSocialShareTitle,
      label: "Social Share Title",
      priority: "polish"
    }),
    createDiscoveryChecklistItem({
      detail: hasSocialShareDescription
        ? "Dedicated social description is saved."
        : "Using the meta description or public summary for shares.",
      hasFallback: hasMetaDescription || hasPublicSummary,
      hasValue: hasSocialShareDescription,
      label: "Social Share Description",
      priority: "polish"
    }),
    {
      detail: release.slug.trim()
        ? "Public release URL is ready."
        : "Add a URL slug so the public page has a stable address.",
      label: "Public URL",
      priority: "essential",
      status: release.slug.trim() ? "passed" : "missing"
    },
    {
      detail: hasPublicSummary
        ? "Short public summary is ready for cards and snippets."
        : "Add a short summary for music cards, previews, and search snippets.",
      label: "Public Summary",
      priority: "essential",
      status: hasPublicSummary ? "passed" : "missing"
    },
    {
      detail: release.public_long_description.trim()
        ? "Extended story is ready for the release page."
        : "Add a deeper release story when this page needs more context.",
      label: "Release Story",
      priority: "polish",
      status: release.public_long_description.trim() ? "passed" : "warning"
    },
    {
      detail: hasReleaseCoverArt(release)
        ? "Cover art is available for cards and share previews."
        : "Upload cover art before relying on public discovery.",
      label: "Cover Art",
      priority: "essential",
      status: hasReleaseCoverArt(release) ? "passed" : "missing"
    },
    {
      detail: hasStreamingLink
        ? "At least one listening destination is available."
        : "Add at least one streaming link so listeners have somewhere to go.",
      label: "Streaming Link",
      priority: "essential",
      status: hasStreamingLink ? "passed" : "missing"
    },
    {
      detail: hasLyrics
        ? release.public_lyrics_enabled
          ? "Lyrics exist and are included publicly."
          : "Lyrics exist but are currently hidden from the public page."
        : "No lyrics are saved, so public lyric visibility is not needed yet.",
      label: "Lyrics Visibility",
      priority: "polish",
      status: hasLyrics ? (release.public_lyrics_enabled ? "passed" : "warning") : "passed"
    },
    {
      detail: release.is_published
        ? "This release is visible on public surfaces."
        : "Release is still hidden from public discovery surfaces.",
      label: "Public Visibility",
      priority: "essential",
      status: release.is_published ? "passed" : "warning"
    },
    {
      detail: release.featured_video_url.trim()
        ? "Featured video is available as an extra discovery asset."
        : "Optional bonus: add a featured video when one is ready.",
      label: "Featured Video",
      priority: "bonus",
      status: release.featured_video_url.trim() ? "passed" : "warning"
    }
  ];
}

export function getDiscoveryReadinessLabel(items: DiscoveryChecklistItem[]) {
  const hasMissingEssential = items.some(
    (item) => item.priority === "essential" && item.status === "missing"
  );

  if (hasMissingEssential) {
    return "Missing essentials";
  }

  const hasPolishWarning = items.some(
    (item) => item.priority !== "bonus" && item.status === "warning"
  );

  return hasPolishWarning ? "Needs polish" : "Ready";
}
