export type LyricsToken =
  | {
      type: "heading";
      text: string;
      key: string;
      sourceIndex: number;
      sectionKey: string;
      sectionOccurrence: number;
    }
  | {
      type: "line";
      text: string;
      key: string;
      sourceIndex: number;
      sectionKey: string;
      sectionOccurrence: number;
      lineIndex: number;
    }
  | {
      type: "spacer";
      key: string;
      sourceIndex: number;
      sectionKey: string;
      sectionOccurrence: number;
    };

export type CanonicalLyricLine = Extract<LyricsToken, {type: "line"}>;

export type CanonicalLyricSection = {
  key: string;
  occurrence: number;
  heading: string | null;
  lines: CanonicalLyricLine[];
};

export type CanonicalLyricDocument = {
  normalizedLyrics: string;
  tokens: LyricsToken[];
  sections: CanonicalLyricSection[];
  lines: CanonicalLyricLine[];
};

function isBlankLine(value: string) {
  return value.trim().length === 0;
}

export function normalizeLyrics(value: string | null | undefined) {
  const normalizedLines = (value ?? "")
    .normalize("NFC")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  while (normalizedLines.length > 0 && isBlankLine(normalizedLines[0])) {
    normalizedLines.shift();
  }

  while (
    normalizedLines.length > 0 &&
    isBlankLine(normalizedLines[normalizedLines.length - 1])
  ) {
    normalizedLines.pop();
  }

  const compactedLines: string[] = [];

  for (const line of normalizedLines) {
    if (isBlankLine(line)) {
      if (compactedLines.at(-1) !== "") {
        compactedLines.push("");
      }

      continue;
    }

    compactedLines.push(line);
  }

  return compactedLines.join("\n");
}

export function normalizeLyricSectionKey(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "root";
}

function getSectionHeading(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("[") || !trimmedLine.endsWith("]")) {
    return null;
  }

  const heading = trimmedLine.slice(1, -1).trim();

  return heading || null;
}

export function parseLyrics(value: string | null | undefined): LyricsToken[] {
  const normalizedLyrics = normalizeLyrics(value);

  if (!normalizedLyrics) {
    return [];
  }

  const sectionCounts = new Map<string, number>();
  let sectionKey = "root";
  let sectionOccurrence = 0;
  let sectionLineIndex = 0;

  return normalizedLyrics.split("\n").map((line, index) => {
    const key = `${index}`;
    const heading = getSectionHeading(line);

    if (heading) {
      sectionKey = normalizeLyricSectionKey(heading);
      sectionOccurrence = sectionCounts.get(sectionKey) ?? 0;
      sectionCounts.set(sectionKey, sectionOccurrence + 1);
      sectionLineIndex = 0;

      return {
        type: "heading" as const,
        text: heading,
        key: `${key}-heading`,
        sourceIndex: index,
        sectionKey,
        sectionOccurrence
      };
    }

    if (!line) {
      return {
        type: "spacer" as const,
        key: `${key}-spacer`,
        sourceIndex: index,
        sectionKey,
        sectionOccurrence
      };
    }

    const token = {
      type: "line" as const,
      text: line,
      key: `${key}-line`,
      sourceIndex: index,
      sectionKey,
      sectionOccurrence,
      lineIndex: sectionLineIndex
    };
    sectionLineIndex += 1;
    return token;
  });
}

export function parseCanonicalLyrics(
  value: string | null | undefined
): CanonicalLyricDocument {
  const normalizedLyrics = normalizeLyrics(value);
  const tokens = parseLyrics(normalizedLyrics);
  const sections: CanonicalLyricSection[] = [];
  const sectionMap = new Map<string, CanonicalLyricSection>();

  for (const token of tokens) {
    const id = `${token.sectionKey}:${token.sectionOccurrence}`;
    let section = sectionMap.get(id);

    if (!section) {
      section = {
        key: token.sectionKey,
        occurrence: token.sectionOccurrence,
        heading: token.type === "heading" ? token.text : null,
        lines: []
      };
      sectionMap.set(id, section);
      sections.push(section);
    } else if (token.type === "heading") {
      section.heading = token.text;
    }

    if (token.type === "line") {
      section.lines.push(token);
    }
  }

  return {
    normalizedLyrics,
    tokens,
    sections,
    lines: tokens.filter((token): token is CanonicalLyricLine => token.type === "line")
  };
}
