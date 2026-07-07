import type {SiteContentSettings} from "@/lib/types";
import {extractYouTubeVideoId, getCanonicalYouTubeWatchUrl} from "./youtube-utils";

type ExclusiveDeliverySettings = SiteContentSettings["exclusive"];

function hasEmailDeliveryEnabled(values: ExclusiveDeliverySettings) {
  return (
    values.unlock_experience === "email_only" ||
    (values.unlock_experience === "instant_unlock" && values.also_email_link)
  );
}

export function validateAndNormalizePrivateExternalUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Private external URL must be a valid URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Private external URL must use HTTP or HTTPS.");
  }

  const host = parsed.hostname.toLowerCase();
  const allowedYouTubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"];
  const isYouTube = allowedYouTubeHosts.some(h => host === h || host.endsWith("." + h));

  if (isYouTube) {
    const videoId = extractYouTubeVideoId(trimmed);
    return getCanonicalYouTubeWatchUrl(videoId);
  }

  // SoundCloud, BandLab, or other host: return as-is
  return trimmed;
}

export function validateExclusiveEmailDeliverySettings(values: ExclusiveDeliverySettings) {
  if (!hasEmailDeliveryEnabled(values)) {
    return;
  }

  if (!values.email_subject.trim()) {
    throw new Error("Add an email subject before enabling email delivery.");
  }

  if (!values.email_body.trim()) {
    throw new Error("Add an email body before enabling email delivery.");
  }
}

export function normalizeExclusiveDeliverySettings<T extends ExclusiveDeliverySettings>(
  values: T
): T {
  const normalizedValues = {
    ...values,
    release_id: values.release_id?.trim() || null,
    private_external_url: validateAndNormalizePrivateExternalUrl(values.private_external_url)
  };

  validateExclusiveEmailDeliverySettings(normalizedValues);

  return normalizedValues;
}
