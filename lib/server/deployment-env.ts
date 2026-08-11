type DeploymentEnvironment = Record<string, string | undefined>;

export type DeploymentEnvValidation = {
  ok: boolean;
  missing: string[];
  invalid: string[];
  resolved: {
    databaseUrlSource: string | null;
    directUrlSource: string | null;
    blobEnabled: boolean;
    privateStorageEnabled: boolean;
    privateStorageNamespaces: string[];
    rawRetentionDays: number | null;
    adsRawRetentionDays: number | null;
    adsPreviewRetentionMinutes: number | null;
  };
};

function firstConfigured(env: DeploymentEnvironment, keys: string[]) {
  return keys.find((key) => Boolean(env[key]?.trim())) ?? null;
}

function validHttpUrl(value: string | undefined) {
  try {
    const parsed = new URL(value ?? "");
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function boundedNumber(value: string | undefined, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function validateDeploymentEnvironment(env: DeploymentEnvironment): DeploymentEnvValidation {
  const missing: string[] = [];
  const invalid: string[] = [];
  const databaseUrlSource = firstConfigured(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
  const directUrlSource = firstConfigured(env, ["DIRECT_URL", "POSTGRES_URL_NON_POOLING"]);
  const required = ["AUTH_SECRET", "CRON_SECRET", "BACKUP_ENCRYPTION_SECRET"];
  for (const key of required) if (!env[key]?.trim()) missing.push(key);
  if (!databaseUrlSource) missing.push("DATABASE_URL or POSTGRES_PRISMA_URL or POSTGRES_URL");
  if (!directUrlSource) missing.push("DIRECT_URL or POSTGRES_URL_NON_POOLING");

  const authSecret = env.AUTH_SECRET?.trim();
  if (authSecret && authSecret.length < 32) invalid.push("AUTH_SECRET must be at least 32 characters");
  const cronSecret = env.CRON_SECRET?.trim();
  if (cronSecret && cronSecret.length < 24) invalid.push("CRON_SECRET must be at least 24 characters");
  const backupSecret = env.BACKUP_ENCRYPTION_SECRET?.trim();
  if (backupSecret && backupSecret.length < 32) invalid.push("BACKUP_ENCRYPTION_SECRET must be at least 32 characters");

  const blobEnabled = env.ASSET_STORAGE_DRIVER === "vercel-blob";
  if (blobEnabled && !env.BLOB_READ_WRITE_TOKEN?.trim()) missing.push("BLOB_READ_WRITE_TOKEN");
  const privateStorageEnabled = env.PRIVATE_STORAGE_DRIVER === "vercel-blob";
  if (privateStorageEnabled && !env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim()) {
    missing.push("PRIVATE_BLOB_READ_WRITE_TOKEN");
  }
  const privateStorageNamespaces = [
    env.PRIVATE_STORAGE_PREVIEW_NAMESPACE?.trim() || "analytics-preview",
    env.PRIVATE_STORAGE_RAW_NAMESPACE?.trim() || "analytics-raw",
    env.PRIVATE_STORAGE_ADS_PREVIEW_NAMESPACE?.trim() || "ads-preview",
    env.PRIVATE_STORAGE_ADS_RAW_NAMESPACE?.trim() || "ads-raw",
    env.PRIVATE_STORAGE_BACKUP_NAMESPACE?.trim() || "database-backups"
  ];
  if (privateStorageNamespaces.some((value) => !/^[a-z0-9][a-z0-9-]{2,62}$/.test(value))) {
    invalid.push("Private storage namespaces must be 3-63 lowercase letters, numbers, or hyphens");
  }
  if (new Set(privateStorageNamespaces).size !== privateStorageNamespaces.length) {
    invalid.push("Private storage namespaces must be distinct");
  }
  if (env.PRIVATE_BLOB_READ_WRITE_TOKEN && env.PRIVATE_BLOB_READ_WRITE_TOKEN === env.BLOB_READ_WRITE_TOKEN) {
    invalid.push("Private and public Blob credentials must be distinct");
  }
  if (!validHttpUrl(env.NEXT_PUBLIC_SITE_URL) && !validHttpUrl(env.PUBLIC_SITE_URL)) {
    invalid.push("NEXT_PUBLIC_SITE_URL or PUBLIC_SITE_URL must be an http(s) URL");
  }
  const rawRetentionDays = boundedNumber(env.ANALYTICS_RAW_RETENTION_DAYS ?? "30", 1, 365);
  if (rawRetentionDays === null || !Number.isInteger(rawRetentionDays)) invalid.push("ANALYTICS_RAW_RETENTION_DAYS must be an integer from 1 to 365");
  const adsRawRetentionDays = boundedNumber(env.ADS_RAW_FILE_RETENTION_DAYS ?? "30", 1, 365);
  if (adsRawRetentionDays === null || !Number.isInteger(adsRawRetentionDays)) invalid.push("ADS_RAW_FILE_RETENTION_DAYS must be an integer from 1 to 365");
  const adsPreviewRetentionMinutes = boundedNumber(env.ADS_PREVIEW_RETENTION_MINUTES ?? "15", 15, 1440);
  if (adsPreviewRetentionMinutes === null || !Number.isInteger(adsPreviewRetentionMinutes)) invalid.push("ADS_PREVIEW_RETENTION_MINUTES must be an integer from 15 to 1440");
  if (boundedNumber(env.ANALYTICS_RECONCILIATION_WARNING_PERCENT ?? "5", 0, 100) === null) invalid.push("ANALYTICS_RECONCILIATION_WARNING_PERCENT must be between 0 and 100");
  if (boundedNumber(env.ANALYTICS_RECONCILIATION_HIGH_PERCENT ?? "20", 0, 100) === null) invalid.push("ANALYTICS_RECONCILIATION_HIGH_PERCENT must be between 0 and 100");
  if (boundedNumber(env.ANALYTICS_CLEANUP_BATCH_SIZE ?? "100", 1, 500) === null) invalid.push("ANALYTICS_CLEANUP_BATCH_SIZE must be between 1 and 500");
  if (boundedNumber(env.ANALYTICS_PREVIEW_RETENTION_HOURS ?? "24", 1, 168) === null) invalid.push("ANALYTICS_PREVIEW_RETENTION_HOURS must be between 1 and 168");
  if (boundedNumber(env.ANALYTICS_ORPHAN_RETENTION_DAYS ?? "7", 1, 90) === null) invalid.push("ANALYTICS_ORPHAN_RETENTION_DAYS must be between 1 and 90");
  if (boundedNumber(env.ANALYTICS_DASHBOARD_SLOW_MS ?? "2000", 100, 60_000) === null) invalid.push("ANALYTICS_DASHBOARD_SLOW_MS must be between 100 and 60000");

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    resolved: {
      databaseUrlSource,
      directUrlSource,
      blobEnabled,
      privateStorageEnabled,
      privateStorageNamespaces,
      rawRetentionDays,
      adsRawRetentionDays,
      adsPreviewRetentionMinutes
    }
  };
}
