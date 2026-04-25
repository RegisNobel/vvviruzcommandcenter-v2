export function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: string | null | undefined, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toDate(value: Date | string | null | undefined, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

export function toOptionalDate(value: Date | string | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
    ? new Date(`${trimmedValue}T00:00:00.000Z`)
    : new Date(trimmedValue);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateInputValue(value: Date | string | null | undefined) {
  const parsed = toOptionalDate(value);

  return parsed ? parsed.toISOString().slice(0, 10) : "";
}
