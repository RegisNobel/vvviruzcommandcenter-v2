export const utmSourcePresets = ["meta", "instagram", "tiktok", "youtube", "email"] as const;
export const utmMediumPresets = [
  "paid_social",
  "organic_social",
  "bio_link",
  "email",
  "direct"
] as const;

export type UtmFields = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

export function buildDestinationUrlWithUtm(destinationUrl: string, utmFields: UtmFields = {}) {
  const trimmedDestinationUrl = destinationUrl.trim();

  try {
    const url = new URL(trimmedDestinationUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://.");
    }

    utmKeys.forEach((key) => {
      const value = utmFields[key]?.trim();

      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  } catch {
    throw new Error("Enter a valid destination URL starting with http:// or https://.");
  }
}
