export type LyricsToken =
  | {
      type: "heading";
      text: string;
      key: string;
    }
  | {
      type: "line";
      text: string;
      key: string;
    }
  | {
      type: "spacer";
      key: string;
    };

function isBlankLine(value: string) {
  return value.trim().length === 0;
}

export function normalizeLyrics(value: string | null | undefined) {
  const normalizedLines = (value ?? "")
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

  return normalizedLyrics.split("\n").map((line, index) => {
    const key = `${index}`;
    const heading = getSectionHeading(line);

    if (heading) {
      return {
        type: "heading" as const,
        text: heading,
        key: `${key}-heading`
      };
    }

    if (!line) {
      return {
        type: "spacer" as const,
        key: `${key}-spacer`
      };
    }

    return {
      type: "line" as const,
      text: line,
      key: `${key}-line`
    };
  });
}
