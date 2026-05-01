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
  "proof-of-skill"
] as const satisfies ReadonlyArray<HookType>;

export const contentTypeOptions = [
  "amv-lyric-edit",
  "performance-clip",
  "b-roll-stock-clip"
] as const satisfies ReadonlyArray<CopyContentType>;

export const songSectionOptions = [
  "hook",
  "verse-1",
  "verse-2"
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
};

export function normalizeHookType(value: string | undefined): HookType {
  if (!value) {
    return "discovery-shock";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (hookTypeOptions.includes(normalizedValue as HookType)) {
    return normalizedValue as HookType;
  }

  switch (normalizedValue) {
    case "discovery shock":
    case "curiosity":
    case "clickbait":
    case "listicle-numbered":
    case "mistake-regret":
    case "before-after-result":
    case "storytelling":
    case "aspirational":
      return "discovery-shock";
    case "identity callout":
    case "relatable":
    case "relatable-pain":
    case "emotional":
    case "negative":
    case "ragebait":
    case "contrarian-opinion":
    case "neutral":
      return "identity-callout";
    case "proof of skill":
    case "direct-actionable":
      return "proof-of-skill";
    default:
      return "discovery-shock";
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
    default:
      return "Discovery Shock";
  }
}

export function normalizeContentType(value: string | undefined): CopyContentType {
  if (!value) {
    return "amv-lyric-edit";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (contentTypeOptions.includes(normalizedValue as CopyContentType)) {
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
      return "performance-clip";
    case "b-roll / stock clip":
    case "b-roll stock clip":
    case "b-roll":
    case "stock clip":
      return "b-roll-stock-clip";
    default:
      return "amv-lyric-edit";
  }
}

export function formatContentType(value: CopyContentType) {
  switch (value) {
    case "amv-lyric-edit":
      return "AMV / Lyric Edit";
    case "performance-clip":
      return "Performance Clip";
    case "b-roll-stock-clip":
      return "B-Roll / Stock Clip";
    default:
      return "AMV / Lyric Edit";
  }
}

export function normalizeSongSection(value: string | undefined): CopySongSection {
  if (!value) {
    return "hook";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (songSectionOptions.includes(normalizedValue as CopySongSection)) {
    return normalizedValue as CopySongSection;
  }

  switch (normalizedValue) {
    case "verse 1":
    case "verse one":
      return "verse-1";
    case "verse 2":
    case "verse two":
      return "verse-2";
    default:
      return "hook";
  }
}

export function formatSongSection(value: CopySongSection) {
  switch (value) {
    case "hook":
      return "Hook";
    case "verse-1":
      return "Verse 1";
    case "verse-2":
      return "Verse 2";
    default:
      return "Hook";
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
    updated_on: now
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
    updated_on: input.updated_on ?? fallback.updated_on
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
    updated_on: normalizedCopy.updated_on
  };
}
