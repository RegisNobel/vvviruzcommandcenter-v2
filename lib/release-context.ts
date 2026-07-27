export function normalizeReleaseContextValues(values: unknown) {
  const input = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[,\n]/)
      : [];

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function parseStoredReleaseContext(value: string | null | undefined) {
  const text = value?.trim() || "";

  if (!text) {
    return [];
  }

  try {
    return normalizeReleaseContextValues(JSON.parse(text));
  } catch {
    return normalizeReleaseContextValues(text);
  }
}

export function serializeReleaseContext(values: string[]) {
  return JSON.stringify(normalizeReleaseContextValues(values));
}
