function isVisual(token: string): boolean {
  const t = token.toLowerCase();
  return (
    /^amv\d*$/.test(t) ||
    t === "2screens" ||
    t === "perf" ||
    t === "performance"
  );
}

function getSongSection(token: string): string | null {
  const t = token.toLowerCase();
  if (t === "chorus") return "chorus";
  if (t === "hook") return "hook";
  if (t === "verse1" || t === "v1") return "verse1";
  if (t === "verse2" || t === "v2") return "verse2";
  if (t === "verse3" || t === "v3") return "verse3";
  if (t === "intro") return "intro";
  if (t === "bridge") return "bridge";
  if (t === "outro") return "outro";
  return null;
}

function isRevision(token: string): boolean {
  const t = token.toLowerCase();
  return (
    t === "rev1" ||
    t === "rev2" ||
    t === "rev3" ||
    t === "edit1" ||
    t === "edit2"
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
