import {createHash} from "node:crypto";

import {
  parseCanonicalLyrics,
  type CanonicalLyricDocument,
  type CanonicalLyricSection
} from "@/lib/lyrics";

export const RELEASE_ANNOTATION_ANCHOR_VERSION = 1;
export const RELEASE_ANNOTATION_MAX_RANGE = 16;

export type ReleaseAnnotationAnchor = {
  anchorVersion: number;
  sectionKey: string;
  sectionOccurrence: number;
  startLineIndex: number;
  endLineIndex: number;
  excerptSnapshot: string;
  excerptHash: string;
  lyricDocumentHash: string;
};

type StoredAnchor = {
  anchorVersion?: number | null;
  sectionKey?: string | null;
  sectionOccurrence?: number | null;
  startLineIndex?: number | null;
  endLineIndex?: number | null;
  excerptSnapshot?: string | null;
  excerptHash?: string | null;
  lyricDocumentHash?: string | null;
  lyricExcerpt?: string | null;
};

export type AnchorValidationResult =
  | {valid: true; anchor: ReleaseAnnotationAnchor; rebased: boolean}
  | {valid: false; reason: string};

export function hashAnnotationText(value: string) {
  return createHash("sha256").update(value.normalize("NFC"), "utf8").digest("hex");
}

export function hashLyricDocument(document: CanonicalLyricDocument) {
  return hashAnnotationText(document.normalizedLyrics);
}

function findSection(
  document: CanonicalLyricDocument,
  sectionKey: string,
  sectionOccurrence: number
) {
  return document.sections.find(
    (section) =>
      section.key === sectionKey && section.occurrence === sectionOccurrence
  );
}

function excerptFromSection(
  section: CanonicalLyricSection | undefined,
  startLineIndex: number,
  endLineIndex: number
) {
  if (
    !section ||
    startLineIndex < 0 ||
    endLineIndex < startLineIndex ||
    endLineIndex >= section.lines.length
  ) {
    return null;
  }

  return section.lines
    .slice(startLineIndex, endLineIndex + 1)
    .map((line) => line.text)
    .join("\n");
}

export function createReleaseAnnotationAnchor(input: {
  lyrics: string;
  sectionKey: string;
  sectionOccurrence: number;
  startLineIndex: number;
  endLineIndex: number;
}): ReleaseAnnotationAnchor {
  const document = parseCanonicalLyrics(input.lyrics);
  const rangeLength = input.endLineIndex - input.startLineIndex + 1;

  if (rangeLength < 1 || rangeLength > RELEASE_ANNOTATION_MAX_RANGE) {
    throw new Error(
      `Select between 1 and ${RELEASE_ANNOTATION_MAX_RANGE} consecutive lyric lines.`
    );
  }

  const excerptSnapshot = excerptFromSection(
    findSection(document, input.sectionKey, input.sectionOccurrence),
    input.startLineIndex,
    input.endLineIndex
  );

  if (!excerptSnapshot) {
    throw new Error("The selected lyric range no longer exists.");
  }

  return {
    anchorVersion: RELEASE_ANNOTATION_ANCHOR_VERSION,
    sectionKey: input.sectionKey,
    sectionOccurrence: input.sectionOccurrence,
    startLineIndex: input.startLineIndex,
    endLineIndex: input.endLineIndex,
    excerptSnapshot,
    excerptHash: hashAnnotationText(excerptSnapshot),
    lyricDocumentHash: hashLyricDocument(document)
  };
}

function readStoredAnchor(anchor: StoredAnchor): ReleaseAnnotationAnchor | null {
  if (
    anchor.anchorVersion !== RELEASE_ANNOTATION_ANCHOR_VERSION ||
    !anchor.sectionKey ||
    !Number.isInteger(anchor.sectionOccurrence) ||
    !Number.isInteger(anchor.startLineIndex) ||
    !Number.isInteger(anchor.endLineIndex) ||
    !anchor.excerptSnapshot ||
    !anchor.excerptHash
  ) {
    return null;
  }

  return {
    anchorVersion: anchor.anchorVersion,
    sectionKey: anchor.sectionKey,
    sectionOccurrence: anchor.sectionOccurrence as number,
    startLineIndex: anchor.startLineIndex as number,
    endLineIndex: anchor.endLineIndex as number,
    excerptSnapshot: anchor.excerptSnapshot,
    excerptHash: anchor.excerptHash,
    lyricDocumentHash: anchor.lyricDocumentHash ?? ""
  };
}

export function validateReleaseAnnotationAnchor(
  lyrics: string,
  stored: StoredAnchor
): AnchorValidationResult {
  const anchor = readStoredAnchor(stored);

  if (!anchor) {
    return {valid: false, reason: "This annotation does not have a complete v1 anchor."};
  }

  if (hashAnnotationText(anchor.excerptSnapshot) !== anchor.excerptHash) {
    return {valid: false, reason: "The saved excerpt integrity check failed."};
  }

  const document = parseCanonicalLyrics(lyrics);
  const currentExcerpt = excerptFromSection(
    findSection(document, anchor.sectionKey, anchor.sectionOccurrence),
    anchor.startLineIndex,
    anchor.endLineIndex
  );

  if (
    currentExcerpt !== anchor.excerptSnapshot ||
    hashAnnotationText(currentExcerpt ?? "") !== anchor.excerptHash
  ) {
    return {valid: false, reason: "The selected lyric range no longer matches."};
  }

  return {
    valid: true,
    rebased: false,
    anchor: {...anchor, lyricDocumentHash: hashLyricDocument(document)}
  };
}

function findExactCandidates(
  document: CanonicalLyricDocument,
  sectionKey: string,
  sectionOccurrence: number,
  excerptLines: string[]
) {
  const candidates: Array<{
    sectionKey: string;
    sectionOccurrence: number;
    startLineIndex: number;
    endLineIndex: number;
  }> = [];

  for (const section of document.sections) {
    if (section.key !== sectionKey || section.occurrence !== sectionOccurrence) continue;
    const lines = section.lines.map((line) => line.text);

    for (let start = 0; start <= lines.length - excerptLines.length; start += 1) {
      const matches = excerptLines.every((line, offset) => lines[start + offset] === line);
      if (matches) {
        candidates.push({
          sectionKey,
          sectionOccurrence: section.occurrence,
          startLineIndex: start,
          endLineIndex: start + excerptLines.length - 1
        });
      }
    }
  }

  return candidates;
}

export function rebaseReleaseAnnotationAnchor(input: {
  oldLyrics: string;
  newLyrics: string;
  anchor: StoredAnchor;
}): AnchorValidationResult {
  const anchor = readStoredAnchor(input.anchor);
  if (!anchor) {
    return {valid: false, reason: "This annotation does not have a complete v1 anchor."};
  }

  const oldDocument = parseCanonicalLyrics(input.oldLyrics);
  const newDocument = parseCanonicalLyrics(input.newLyrics);
  const oldExcerpt = excerptFromSection(
    findSection(oldDocument, anchor.sectionKey, anchor.sectionOccurrence),
    anchor.startLineIndex,
    anchor.endLineIndex
  );

  if (
    oldExcerpt !== anchor.excerptSnapshot ||
    hashAnnotationText(oldExcerpt ?? "") !== anchor.excerptHash
  ) {
    return {valid: false, reason: "The previous lyrics no longer match the saved anchor."};
  }

  if (oldDocument.normalizedLyrics === newDocument.normalizedLyrics) {
    return {
      valid: true,
      rebased: false,
      anchor: {...anchor, lyricDocumentHash: hashLyricDocument(newDocument)}
    };
  }

  const candidates = findExactCandidates(
    newDocument,
    anchor.sectionKey,
    anchor.sectionOccurrence,
    anchor.excerptSnapshot.split("\n")
  );

  if (candidates.length !== 1) {
    return {
      valid: false,
      reason:
        candidates.length === 0
          ? "The exact lyric excerpt could not be found after the edit."
          : "The exact lyric excerpt appears in more than one possible location."
    };
  }

  const candidate = candidates[0];
  return {
    valid: true,
    rebased: true,
    anchor: {
      anchorVersion: RELEASE_ANNOTATION_ANCHOR_VERSION,
      ...candidate,
      excerptSnapshot: anchor.excerptSnapshot,
      excerptHash: anchor.excerptHash,
      lyricDocumentHash: hashLyricDocument(newDocument)
    }
  };
}
