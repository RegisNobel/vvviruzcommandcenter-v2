export function validateExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Unsafe protocol checks (e.g., javascript:, data:, file:)
  // By strictly checking for https://, we implicitly reject all of these.
  if (!trimmed.startsWith("https://")) return false;

  try {
    const parsed = new URL(trimmed);
    // Extra safety checks
    const lowerProtocol = parsed.protocol.toLowerCase();
    if (lowerProtocol !== "https:") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateOptionalExternalUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  return validateExternalUrl(trimmed);
}

export function validatePrimaryPlatform(platform: string | null | undefined): boolean {
  if (!platform) return false;
  const normalized = platform.trim().toLowerCase();
  return normalized === "spotify" || normalized === "apple" || normalized === "youtube";
}
