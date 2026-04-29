import {z} from "zod";

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LABEL_LENGTH = 63;
const BASIC_EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmailAddress(value: string) {
  const normalized = normalizeEmailAddress(value);
  const [localPart, domainPart] = normalized.split("@");

  if (
    normalized.length > MAX_EMAIL_LENGTH ||
    !localPart ||
    !domainPart ||
    localPart.length > MAX_LOCAL_PART_LENGTH ||
    normalized.includes(" ") ||
    normalized.includes("..") ||
    !BASIC_EMAIL_PATTERN.test(normalized)
  ) {
    return false;
  }

  return domainPart.split(".").every((label) => label.length <= MAX_DOMAIN_LABEL_LENGTH);
}

export function emailField(message = "Enter a valid email address.") {
  return z.string().trim().transform((value, context) => {
    const normalized = normalizeEmailAddress(value);

    if (!isValidEmailAddress(normalized)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message
      });

      return z.NEVER;
    }

    return normalized;
  });
}
