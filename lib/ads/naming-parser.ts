function isVisual(token: string): boolean {
  const t = token.toLowerCase();
  return (
    /^amv\d*$/.test(t) ||
    t === "2screens" ||
    t === "perf" ||
    t === "performance" ||
    t === "cover" ||
    t === "static"
  );
}

function getSongSection(token: string): string | null {
  const t = token.toLowerCase();
  if (t === "chorus") return "chorus";
  if (t === "hook") return "hook";
  if (t === "verse1" || t === "v1") return "verse1";
  if (t === "verse2" || t === "v2") return "verse2";
  if (t === "verse3" || t === "v3") return "verse3";
  if (t === "verse4" || t === "v4") return "verse4";
  if (t === "intro") return "intro";
  if (t === "bridge") return "bridge";
  if (t === "outro") return "outro";
  return null;
}

function isRevision(token: string): boolean {
  const t = token.toLowerCase();
  return (
    /^rev\d+$/.test(t) ||
    /^edit\d+$/.test(t)
  );
}

export interface ParsedAdName {
  release: string;
  visual: string;
  songSection: string;
  revision: string;
}

export function parseAdName(adName: string): ParsedAdName {
  if (!adName) {
    return {
      release: "Unparsed",
      visual: "Unparsed",
      songSection: "Unparsed",
      revision: "Unparsed"
    };
  }

  const normalized = adName.trim();
  // Split using primary delimiters: _ and | and spaces. Keep hyphens intact.
  const tokens = normalized.split(/[ _|]+/).map((t) => t.trim()).filter(Boolean);

  // Fallback Check: if the name suffix matches the convention: ..._visual_songsection_revision
  if (tokens.length >= 4) {
    const lastToken = tokens[tokens.length - 1];
    const secondToLastToken = tokens[tokens.length - 2];
    const thirdToLastToken = tokens[tokens.length - 3];

    if (isRevision(lastToken) && getSongSection(secondToLastToken)) {
      const resolvedSongSection = getSongSection(secondToLastToken)!;
      return {
        release: tokens.slice(0, tokens.length - 3).join("_"),
        visual: thirdToLastToken,
        songSection: resolvedSongSection,
        revision: lastToken
      };
    }
  }

  let visual = "Unparsed";
  let songSection = "Unparsed";
  let revision = "Unparsed";
  let firstComponentIndex = -1;

  // Search for parsed components
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isVisual(token)) {
      visual = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    } else if (isRevision(token)) {
      revision = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    }
  }

  // Handle songSection with ambiguity check
  const foundSongSections: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const mapped = getSongSection(token);
    if (mapped) {
      foundSongSections.push(mapped);
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    }
  }

  const uniqueSongSections = Array.from(new Set(foundSongSections));
  if (uniqueSongSections.length > 1) {
    songSection = "Ambiguous";
  } else if (uniqueSongSections.length === 1) {
    songSection = uniqueSongSections[0];
  }

  let release = "Unparsed";
  if (firstComponentIndex > 0) {
    release = tokens.slice(0, firstComponentIndex).join("_");
  }

  return {
    release,
    visual,
    songSection,
    revision
  };
}
