import type {
  ReleaseCoverAsset,
  ReleaseRecord,
  ReleaseStageLabel,
  ReleaseStatus,
  ReleaseStreamingLinks,
  ReleaseSummary,
  ReleaseTask
} from "@/lib/types";
import {createId, slugify} from "@/lib/utils";

export const releaseStatusOptions = [
  "Concept Complete",
  "Beat Made",
  "Lyrics Finished",
  "Recorded",
  "Mix/Mastered",
  "Published"
] as const satisfies ReadonlyArray<ReleaseStatus>;

export const releaseChecklistKeys = [
  "concept_complete",
  "beat_made",
  "lyrics_finished",
  "recorded",
  "mix_mastered",
  "published"
] as const;

export type ReleaseChecklistKey = (typeof releaseChecklistKeys)[number];

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

export function hasReleaseCoverArt(release: Pick<ReleaseRecord, "cover_art" | "cover_art_path">) {
  return Boolean(release.cover_art || release.cover_art_path.trim());
}

function getReleaseFieldCompletionChecks(release: ReleaseRecord) {
  return [
    Boolean(release.title.trim()),
    Boolean(release.release_date.trim()),
    Boolean(release.concept_details.trim()),
    Boolean(release.lyrics.trim()),
    Boolean(release.upc.trim()),
    Boolean(release.isrc.trim()),
    hasReleaseCoverArt(release),
    Boolean(release.streaming_links.spotify.trim()),
    Boolean(release.streaming_links.apple_music.trim()),
    Boolean(release.streaming_links.youtube.trim()),
    release.collaborator ? Boolean(release.collaborator_name.trim()) : true
  ];
}

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

export function calculateReleaseProgress(release: ReleaseRecord) {
  const fieldChecks = getReleaseFieldCompletionChecks(release);
  const completedFieldChecks = fieldChecks.filter(Boolean).length;
  const totalFieldChecks = fieldChecks.length;
  const completedChecklistItems = releaseChecklistKeys.filter((key) => release[key]).length;
  const completedTasks = release.tasks.filter((task) => task.completed).length;
  const totalItems =
    totalFieldChecks + releaseChecklistKeys.length + release.tasks.length;

  if (totalItems === 0) {
    return 0;
  }

  const completedItems =
    completedFieldChecks + completedChecklistItems + completedTasks;

  return Math.round((completedItems / totalItems) * 100);
}

export function getReleaseProgressTone(progress: number) {
  if (progress === 100) {
    return "bg-emerald-500";
  }

  if (progress >= 50) {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

export function getReleaseStageLabel(release: ReleaseRecord): ReleaseStageLabel {
  if (!release.concept_complete) {
    return "Concept";
  }

  if (!hasReleaseCoverArt(release)) {
    return "Cover Art";
  }

  if (!release.beat_made) {
    return "Beat Made";
  }

  if (!release.lyrics_finished) {
    return "Lyrics";
  }

  if (!release.recorded) {
    return "Recorded";
  }

  if (!release.mix_mastered) {
    return "Mix/Mastered";
  }

  if (!release.published) {
    return "Published";
  }

  return "Published";
}

export function summarizeRelease(release: ReleaseRecord): ReleaseSummary {
  return {
    id: release.id,
    title: release.title,
    pinned: release.pinned,
    type: release.type,
    status: getReleaseStageLabel(release),
    release_date: release.release_date,
    progress_percentage: calculateReleaseProgress(release),
    updated_on: release.updated_on
  };
}
