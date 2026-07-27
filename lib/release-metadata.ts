const htmlMarkupPattern = /<\/?[a-z][^>]*>/i;
const contentAttributePattern = /\bcontent\s*=\s*(["'])(.*?)\1/gi;
const leadingBrandPattern = /^vvviruz\s*(?:[|:\-\u2013\u2014])\s*/i;
const redundantArtistBylinePattern =
  /\s+by\s+vvviruz(?=\s*(?:[|:\-\u2013\u2014]|$))/i;

export function containsHtmlMarkup(value: string | null | undefined) {
  return htmlMarkupPattern.test(value?.trim() || "");
}

export function cleanPublicMetadataText(value: string | null | undefined) {
  const text = value?.trim() || "";

  if (!text) {
    return "";
  }

  if (!containsHtmlMarkup(text)) {
    return text.replace(/\s+/g, " ").trim();
  }

  const contentValues = Array.from(text.matchAll(contentAttributePattern))
    .map((match) => match[2]?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean);

  return contentValues.at(-1) || "";
}

export function cleanPublicSeoTitle(value: string | null | undefined) {
  return cleanPublicMetadataText(value)
    .replace(leadingBrandPattern, "")
    .replace(redundantArtistBylinePattern, "")
    .trim();
}

export function isPlainPublicMetadata(value: string | null | undefined) {
  return !containsHtmlMarkup(value);
}
