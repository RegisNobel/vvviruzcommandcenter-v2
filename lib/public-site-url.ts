import "server-only";

export function getPublicSiteBaseUrl() {
  const value =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  return value.replace(/\/+$/, "");
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
