import type {
  CopyContentType,
  CopyRecord,
  CopySongSection,
  CopySummary,
  HookType
} from "@/lib/types";
import {createId} from "@/lib/utils";

export const hookTypeOptions = [
  "discovery-shock",
  "identity-callout",
  "proof-of-skill",
  "emotional-pull",
  "curiosity-gap",
  "hype-challenge"
] as const satisfies ReadonlyArray<HookType>;

export const contentTypeOptions = [
  "amv-lyric-edit",
  "studio-performance",
  "gym-clip",
  "talking-head",
  "meme-skit",
  "b-roll-stock",
  "text-only",
  "cover-art-static"
] as const satisfies ReadonlyArray<CopyContentType>;

export const songSectionOptions = [
  "intro",
  "hook",
  "verse",
  "bridge",
  "outro",
  "full-song"
] as const satisfies ReadonlyArray<CopySongSection>;

type LegacyCopyShape = Partial<CopyRecord> & {
  releaseId?: string | null;
  type?: string;
  hookType?: string;
  hook_type?: string;
  contentType?: string;
  content_type?: string;
  songSection?: string;
  song_section?: string;
  creativeNotes?: string;
  creative_notes?: string;
  archivedAt?: string | null;
  archived_at?: string | null;
  archiveReason?: string | null;
  archive_reason?: string | null;
};

export function normalizeHookType(value: string | undefined): HookType {
  if (!value) {
    return "discovery-shock";
  }

  const normalizedValue = value.trim().toLowerCase();

  if ((hookTypeOptions as readonly string[]).includes(normalizedValue)) {
    return normalizedValue as HookType;
  }

  switch (normalizedValue) {
    case "discovery shock":
    case "clickbait":
      return "discovery-shock";
    case "identity callout":
    case "relatable":
      return "identity-callout";
    case "proof of skill":
      return "proof-of-skill";
    case "emotional":
      return "emotional-pull";
    case "curiosity":
      return "curiosity-gap";
    case "hype":
    case "challenge":
      return "hype-challenge";
    default:
      return value as HookType;
  }
}

export function formatHookType(value: HookType) {
  switch (value) {
    case "discovery-shock":
      return "Discovery Shock";
    case "identity-callout":
      return "Identity Callout";
    case "proof-of-skill":
      return "Proof of Skill";
    case "emotional-pull":
      return "Emotional Pull";
    case "curiosity-gap":
      return "Curiosity Gap";
    case "hype-challenge":
      return "Hype / Challenge";
    default:
      return value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

export function normalizeContentType(value: string | undefined): CopyContentType {
  if (!value) {
    return "amv-lyric-edit";
  }

  const normalizedValue = value.trim().toLowerCase();

  if ((contentTypeOptions as readonly string[]).includes(normalizedValue)) {
    return normalizedValue as CopyContentType;
  }

  switch (normalizedValue) {
    case "amv / lyric edit":
    case "amv lyric edit":
    case "lyric edit":
    case "amv":
      return "amv-lyric-edit";
    case "performance clip":
    case "performance":
      return "studio-performance";
    case "b-roll / stock clip":
    case "b-roll stock clip":
    case "b-roll":
    case "stock clip":
    case "b-roll-stock-clip":
      return "b-roll-stock";
    default:
      return value as CopyContentType;
  }
}

export function formatContentType(value: CopyContentType) {
  switch (value) {
    case "amv-lyric-edit":
      return "AMV / Lyric Edit";
    case "studio-performance":
      return "Studio Performance";
    case "gym-clip":
      return "Gym Clip";
    case "talking-head":
      return "Talking Head";
    case "meme-skit":
      return "Meme / Skit";
    case "b-roll-stock":
      return "B-roll / Stock";
    case "text-only":
      return "Text-only";
    case "cover-art-static":
      return "Cover Art / Static";
    default:
      return value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

export function normalizeSongSection(value: string | undefined): CopySongSection {
  if (!value) {
    return "hook";
  }

  const normalizedValue = value.trim().toLowerCase();

  if ((songSectionOptions as readonly string[]).includes(normalizedValue)) {
    return normalizedValue as CopySongSection;
  }

  switch (normalizedValue) {
    case "verse 1":
    case "verse one":
    case "verse-1":
    case "verse 2":
    case "verse two":
    case "verse-2":
      return "verse";
    case "chorus":
      return "hook";
    default:
      return value as CopySongSection;
  }
}

export function formatSongSection(value: CopySongSection) {
  switch (value) {
    case "intro":
      return "Intro";
    case "hook":
      return "Hook";
    case "verse":
      return "Verse";
    case "bridge":
      return "Bridge";
    case "outro":
      return "Outro";
    case "full-song":
      return "Full Song / General";
    default:
      return value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

export function getCopyHeading(copy: Pick<CopyRecord, "hook">) {
  const normalizedHook = copy.hook.trim();

  return normalizedHook || "Untitled Copy";
}

export function createEmptyCopy(
  values?: Partial<
    Pick<
      CopyRecord,
      | "hook"
      | "caption"
      | "hook_type"
      | "content_type"
      | "song_section"
      | "creative_notes"
      | "release_id"
      | "archived_at"
      | "archive_reason"
    >
  > & {type?: string}
): CopyRecord {
  const now = new Date().toISOString();

  return {
    id: createId(),
    release_id: values?.release_id ?? null,
    hook: values?.hook?.trim() || "",
    caption: values?.caption?.trim() || "",
    hook_type: normalizeHookType(values?.hook_type ?? values?.type),
    content_type: normalizeContentType(values?.content_type),
    song_section: normalizeSongSection(values?.song_section),
    creative_notes: values?.creative_notes?.trim() || "",
    created_on: now,
    updated_on: now,
    archived_at: values?.archived_at ?? null,
    archive_reason: values?.archive_reason ?? null
  };
}

export function hydrateCopy(input: LegacyCopyShape): CopyRecord {
  const fallback = createEmptyCopy();
  const releaseId =
    typeof input.release_id === "string"
      ? input.release_id
      : typeof input.releaseId === "string"
        ? input.releaseId
        : null;
  const hookType =
    typeof input.hook_type === "string"
      ? input.hook_type
      : typeof input.hookType === "string"
        ? input.hookType
        : typeof input.type === "string"
          ? input.type
          : undefined;
  const contentType =
    typeof input.content_type === "string"
      ? input.content_type
      : typeof input.contentType === "string"
        ? input.contentType
        : undefined;
  const songSection =
    typeof input.song_section === "string"
      ? input.song_section
      : typeof input.songSection === "string"
        ? input.songSection
        : undefined;
  const creativeNotes =
    typeof input.creative_notes === "string"
      ? input.creative_notes
      : typeof input.creativeNotes === "string"
        ? input.creativeNotes
        : "";
  const archivedAt =
    typeof input.archived_at === "string" || input.archived_at === null
      ? input.archived_at
      : typeof input.archivedAt === "string" || input.archivedAt === null
        ? input.archivedAt
        : null;
  const archiveReason =
    typeof input.archive_reason === "string" || input.archive_reason === null
      ? input.archive_reason
      : typeof input.archiveReason === "string" || input.archiveReason === null
        ? input.archiveReason
        : null;

  return {
    ...fallback,
    ...input,
    id: input.id?.trim() || fallback.id,
    release_id: releaseId,
    hook: input.hook?.trim() || "",
    caption: input.caption?.trim() || "",
    hook_type: normalizeHookType(hookType),
    content_type: normalizeContentType(contentType),
    song_section: normalizeSongSection(songSection),
    creative_notes: creativeNotes.trim(),
    created_on: input.created_on ?? fallback.created_on,
    updated_on: input.updated_on ?? fallback.updated_on,
    archived_at: archivedAt,
    archive_reason: archiveReason
  };
}

export function touchCopy(copy: CopyRecord): CopyRecord {
  return {
    ...copy,
    updated_on: new Date().toISOString()
  };
}

export function summarizeCopy(copy: CopyRecord): CopySummary {
  const normalizedCopy = hydrateCopy(copy);

  return {
    id: normalizedCopy.id,
    release_id: normalizedCopy.release_id,
    hook: normalizedCopy.hook,
    caption: normalizedCopy.caption,
    hook_type: normalizedCopy.hook_type,
    content_type: normalizedCopy.content_type,
    song_section: normalizedCopy.song_section,
    creative_notes: normalizedCopy.creative_notes,
    created_on: normalizedCopy.created_on,
    updated_on: normalizedCopy.updated_on,
    archived_at: normalizedCopy.archived_at,
    archive_reason: normalizedCopy.archive_reason
  };
}
