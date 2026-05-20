function isVisual(token: string): boolean {
  const t = token.toLowerCase();
  return /^video\d+$/.test(t) || /^visual\d+$/.test(t) || t === "amv" || t === "2screens" || t === "performance";
}

function isHook(token: string): boolean {
  const t = token.toLowerCase();
  return /^hook\d+$/.test(t);
}

function isFormat(token: string): boolean {
  const t = token.toLowerCase();
  return t === "reel" || t === "story" || t === "feed" || t === "post";
}

function isVersion(token: string): boolean {
  const t = token.toLowerCase();
  return /^v\d+$/.test(t);
}

export interface ParsedAdName {
  release: string;
  visual: string;
  hook: string;
  format: string;
  version: string;
}

export function parseAdName(adName: string): ParsedAdName {
  if (!adName) {
    return {
      release: "Unparsed",
      visual: "Unparsed",
      hook: "Unparsed",
      format: "Unparsed",
      version: "Unparsed"
    };
  }

  const normalized = adName.trim();
  // Split using primary delimiters: _ and | and spaces. Keep hyphens intact.
  const tokens = normalized.split(/[ _|]+/).map((t) => t.trim()).filter(Boolean);

  let visual = "Unparsed";
  let hook = "Unparsed";
  let format = "Unparsed";
  let version = "Unparsed";
  let firstComponentIndex = -1;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isVisual(token)) {
      visual = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    } else if (isHook(token)) {
      hook = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    } else if (isFormat(token)) {
      format = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    } else if (isVersion(token)) {
      version = token;
      if (firstComponentIndex === -1) {
        firstComponentIndex = index;
      }
    }
  }

  let release = "Unparsed";
  if (firstComponentIndex > 0) {
    release = tokens.slice(0, firstComponentIndex).join("_");
  }

  return {
    release,
    visual,
    hook,
    format,
    version
  };
}
