import type {SiteContentSettings} from "@/lib/types";

import {parseAndNormalizeYouTubePlaylist} from "./youtube-utils";

type ExclusiveDeliverySettings = SiteContentSettings["exclusive"];

function hasEmailDeliveryEnabled(values: ExclusiveDeliverySettings) {
  return (
    values.unlock_experience === "email_only" ||
    (values.unlock_experience === "instant_unlock" && values.also_email_link)
  );
}

export function validateAndNormalizeYouTubePlaylistUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    return "";
  }
  return parseAndNormalizeYouTubePlaylist(trimmed).publicUrl;
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
    private_external_url: validateAndNormalizeYouTubePlaylistUrl(values.private_external_url)
  };

  validateExclusiveEmailDeliverySettings(normalizedValues);

  return normalizedValues;
}
