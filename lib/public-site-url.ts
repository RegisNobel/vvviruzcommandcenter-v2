import "server-only";

export const CANONICAL_PUBLIC_SITE_URL = "https://vvviruz.com";

function normalizeConfiguredSiteUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isNonCanonicalProductionUrl(value: string) {
  if (!value) {
    return true;
  }

  const hostname = new URL(value).hostname.toLowerCase();

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app")
  );
}

export function getPublicSiteBaseUrl() {
  const configuredValue =
    normalizeConfiguredSiteUrl(process.env.PUBLIC_SITE_URL) ||
    normalizeConfiguredSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

  if (process.env.NODE_ENV === "production") {
    return isNonCanonicalProductionUrl(configuredValue)
      ? CANONICAL_PUBLIC_SITE_URL
      : configuredValue;
  }

  return configuredValue || "http://localhost:3000";
}

export function getPublicSiteUrl(pathname = "/") {
  return new URL(pathname, `${getPublicSiteBaseUrl()}/`).toString();
}

export function getPublicHttpUrl(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = trimmed.startsWith("/")
      ? new URL(trimmed, `${getPublicSiteBaseUrl()}/`)
      : new URL(trimmed);

    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}
