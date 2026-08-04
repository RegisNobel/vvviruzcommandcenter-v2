import "server-only";

type OperationalLevel = "info" | "warn" | "error";
type SafeOperationalValue = string | number | boolean | null | string[];

function safeFields(fields: Record<string, SafeOperationalValue | undefined>) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function writeOperationalLog(
  level: OperationalLevel,
  event: string,
  fields: Record<string, SafeOperationalValue | undefined> = {}
) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...safeFields(fields)
  };
  if (level === "error") console.error("[operations]", payload);
  else if (level === "warn") console.warn("[operations]", payload);
  else console.info("[operations]", payload);
}

export async function withOperationalSpan<T>(
  event: string,
  fields: Record<string, SafeOperationalValue | undefined>,
  operation: () => Promise<T>,
  completedFields: (result: T) => Record<string, SafeOperationalValue | undefined> = () => ({})
) {
  const startedAt = performance.now();
  writeOperationalLog("info", `${event}.started`, fields);
  try {
    const result = await operation();
    writeOperationalLog("info", `${event}.completed`, {
      ...fields,
      ...completedFields(result),
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  } catch (error) {
    writeOperationalLog("error", `${event}.failed`, {
      ...fields,
      durationMs: Math.round(performance.now() - startedAt),
      errorType: error instanceof Error ? error.name : "UnknownError"
    });
    throw error;
  }
}
