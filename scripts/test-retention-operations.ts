import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

import {prisma} from "../lib/db/prisma";
import {runRetentionCleanup} from "../lib/analytics/retention-cleanup";
import {CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";
import {validateDeploymentEnvironment} from "../lib/server/deployment-env";
import {GET as cleanupRoute} from "../app/api/cron/analytics-maintenance/route";

const run = randomUUID();
const importId = `stage10-cleanup-${run}`;
const failureImportId = `stage10-cleanup-failure-${run}`;
const observationId = `stage10-cleanup-observation-${run}`;
const now = new Date("2044-02-01T00:00:00.000Z");

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function cleanup() {
  await prisma.artistMetricObservation.deleteMany({where: {id: observationId}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: [importId, failureImportId]}}});
}

async function main() {
  await cleanup();
  await prisma.analyticsImport.createMany({data: [
    {id: importId, importType: "ARTIST_AUDIENCE_TIMELINE", originalFilename: "safe.csv", fileHash: hash(importId), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, uploadedAt: now, status: "IMPORTED", acceptedAt: now, rawFileStorageDriver: "local", rawFileStorageKey: "expired.csv", rawFileExpiresAt: new Date(now.getTime() - 1000), reportingTimezone: "UTC", validationSummary: "{}", normalizationVersion: 1, createdAt: now, updatedAt: now},
    {id: failureImportId, importType: "ARTIST_AUDIENCE_TIMELINE", originalFilename: "retry.csv", fileHash: hash(failureImportId), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, uploadedAt: now, status: "IMPORTED", acceptedAt: now, rawFileStorageDriver: "local", rawFileStorageKey: "retry.csv", rawFileExpiresAt: new Date(now.getTime() - 1000), reportingTimezone: "UTC", validationSummary: "{}", normalizationVersion: 1, createdAt: now, updatedAt: now}
  ]});
  await prisma.artistMetricObservation.create({data: {id: observationId, importId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate: now, listeners: 1, monthlyListeners: 1, monthlyActiveListeners: 1, streams: 1, playlistAdds: 1, saves: 1, followers: 1, createdAt: now}});

  const objects = {
    "analytics-preview": [{id: "preview-old.csv", storedPath: "preview-old.csv", updatedAt: new Date(now.getTime() - 2 * 86_400_000)}],
    "analytics-raw": [
      {id: "expired.csv", storedPath: "expired.csv", updatedAt: new Date(now.getTime() - 40 * 86_400_000)},
      {id: "retry.csv", storedPath: "retry.csv", updatedAt: new Date(now.getTime() - 40 * 86_400_000)},
      {id: "orphan.csv", storedPath: "orphan.csv", updatedAt: new Date(now.getTime() - 8 * 86_400_000)},
      {id: "young-orphan.csv", storedPath: "young-orphan.csv", updatedAt: new Date(now.getTime() - 2 * 86_400_000)}
    ]
  };
  const removed: string[] = [];
  let failRetry = true;
  const deps = {
    now: () => now,
    list: async (kind: "analytics-preview" | "analytics-raw") => objects[kind],
    remove: async (_kind: string, storedPath: string) => {
      if (storedPath === "retry.csv" && failRetry) throw new Error("simulated storage failure");
      removed.push(storedPath);
      return {deleted: true as const, alreadyAbsent: false as const};
    }
  };

  const dryRun = await runRetentionCleanup({dryRun: true, batchSize: 20}, deps);
  assert.equal(dryRun.expiredPreviews.deferred, 1);
  assert.equal(dryRun.expiredRawFiles.deferred, 2);
  assert.equal(removed.length, 0);
  assert.equal((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importId}})).rawFileDeletedAt, null);

  const applied = await runRetentionCleanup({dryRun: false, batchSize: 20}, deps);
  assert.equal(applied.expiredPreviews.deleted, 1);
  assert.equal(applied.expiredRawFiles.deleted, 1);
  assert.equal(applied.orphanedRawFiles.deleted, 1);
  assert.deepEqual(applied.errors, [{category: "expiredRawFiles", objectId: failureImportId, code: "STORAGE_DELETE_FAILED"}]);
  assert.ok((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importId}})).rawFileDeletedAt);
  assert.equal((await prisma.analyticsImport.findUniqueOrThrow({where: {id: failureImportId}})).rawFileDeletedAt, null);
  assert.equal(await prisma.artistMetricObservation.count({where: {id: observationId}}), 1, "normalized observations survive raw-file expiration");
  assert.ok(!removed.includes("young-orphan.csv"), "young orphans stay inside the grace period");

  failRetry = false;
  const retry = await runRetentionCleanup({dryRun: false, batchSize: 20}, deps);
  assert.equal(retry.errors.length, 0);
  assert.ok((await prisma.analyticsImport.findUniqueOrThrow({where: {id: failureImportId}})).rawFileDeletedAt, "failed storage deletes remain retryable");
  const idempotent = await runRetentionCleanup({dryRun: false, batchSize: 20}, {...deps, remove: async () => ({deleted: false as const, alreadyAbsent: true as const})});
  assert.equal(idempotent.expiredRawFiles.discovered, 0);

  const previousCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "stage10-test-cron-secret-long-enough";
  try {
    const unauthorized = await cleanupRoute(new Request("http://localhost/api/cron/analytics-maintenance"));
    assert.equal(unauthorized.status, 401);
    const wrong = await cleanupRoute(new Request("http://localhost/api/cron/analytics-maintenance", {headers: {authorization: "Bearer wrong"}}));
    assert.equal(wrong.status, 401);
  } finally {
    if (previousCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCron;
  }

  const validEnv = validateDeploymentEnvironment({DATABASE_URL: "postgresql://db", DIRECT_URL: "postgresql://direct", AUTH_SECRET: "a".repeat(32), CRON_SECRET: "b".repeat(24), BACKUP_ENCRYPTION_SECRET: "c".repeat(32), ASSET_STORAGE_DRIVER: "vercel-blob", BLOB_READ_WRITE_TOKEN: "public-token", PRIVATE_STORAGE_DRIVER: "vercel-blob", PRIVATE_BLOB_READ_WRITE_TOKEN: "private-token", PRIVATE_STORAGE_PREVIEW_NAMESPACE: "analytics-preview", PRIVATE_STORAGE_RAW_NAMESPACE: "analytics-raw", PRIVATE_STORAGE_BACKUP_NAMESPACE: "database-backups", NEXT_PUBLIC_SITE_URL: "https://example.com", ANALYTICS_RAW_RETENTION_DAYS: "30"});
  assert.equal(validEnv.ok, true);
  assert.equal(validEnv.resolved.privateStorageEnabled, true);
  const sharedCredential = validateDeploymentEnvironment({DATABASE_URL: "postgresql://db", DIRECT_URL: "postgresql://direct", AUTH_SECRET: "a".repeat(32), CRON_SECRET: "b".repeat(24), BACKUP_ENCRYPTION_SECRET: "c".repeat(32), ASSET_STORAGE_DRIVER: "vercel-blob", BLOB_READ_WRITE_TOKEN: "shared", PRIVATE_STORAGE_DRIVER: "vercel-blob", PRIVATE_BLOB_READ_WRITE_TOKEN: "shared", NEXT_PUBLIC_SITE_URL: "https://example.com"});
  assert.ok(sharedCredential.invalid.includes("Private and public Blob credentials must be distinct"));
  const invalidEnv = validateDeploymentEnvironment({});
  assert.equal(invalidEnv.ok, false);
  assert.ok(invalidEnv.missing.length >= 5);
  console.log("Cleanup authorization, dry-run, preview/raw/orphan deletion, grace threshold, normalized-data preservation, idempotency, retry, and distinct private-storage environment validation passed.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
