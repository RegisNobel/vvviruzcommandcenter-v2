import type {SiteContentSettings} from "@/lib/types";

type ExclusiveDeliverySettings = SiteContentSettings["exclusive"];

function hasEmailDeliveryEnabled(values: ExclusiveDeliverySettings) {
  return (
    values.unlock_experience === "email_only" ||
    (values.unlock_experience === "instant_unlock" && values.also_email_link)
  );
}

export function normalizePrivateExternalUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Unsupported protocol.");
    }

    return trimmedValue;
  } catch {
    throw new Error("Private External URL must be a valid http:// or https:// URL.");
  }
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
    private_external_url: normalizePrivateExternalUrl(values.private_external_url)
  };

  validateExclusiveEmailDeliverySettings(normalizedValues);

  return normalizedValues;
}
