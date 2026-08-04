import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

import {runRetentionCleanup} from "../lib/analytics/retention-cleanup";
import {GET as cleanupRoute} from "../app/api/cron/analytics-maintenance/route";
import {prisma} from "../lib/db/prisma";
import {CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";
import {
  deleteStoredAssetStrict,
  listStoredAssetReferences,
  storeAsset,
  type StoredAssetKind
} from "../lib/server/asset-storage";

const runId = randomUUID();
const importIds = {
  expired: `gate-b-expired-${runId}`,
  retry: `gate-b-retry-${runId}`,
  active: `gate-b-active-${runId}`
};
const observationId = `gate-b-observation-${runId}`;
const now = new Date("2044-02-01T00:00:00.000Z");
const created: Array<{kind: "analytics-preview" | "analytics-raw"; key: string}> = [];

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function stored(kind: "analytics-preview" | "analytics-raw", value: string) {
  const object = await storeAsset({
    kind,
    fileName: `${randomUUID()}.csv`,
    data: Buffer.from(value),
    access: "private",
    contentType: "text/csv"
  });
  created.push({kind, key: object.storedPath});
  return object.storedPath;
}

async function cleanup() {
  await prisma.artistMetricObservation.deleteMany({where: {id: observationId}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: Object.values(importIds)}}});
  for (const object of created.splice(0)) {
    await deleteStoredAssetStrict(object.kind, object.key).catch(() => undefined);
  }
}

async function main() {
  assert.equal(process.env.PRIVATE_STORAGE_DRIVER, "vercel-blob");
  await cleanup();
  const previewExpired = await stored("analytics-preview", "expired preview");
  const previewActive = await stored("analytics-preview", "active preview");
  const rawExpired = await stored("analytics-raw", "expired raw");
  const rawRetry = await stored("analytics-raw", "retry raw");
  const rawActive = await stored("analytics-raw", "active raw");
  const rawOrphan = await stored("analytics-raw", "orphan raw");
  const rawYoungOrphan = await stored("analytics-raw", "young orphan raw");

  const baseImport = {
    importType: "ARTIST_AUDIENCE_TIMELINE",
    artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
    uploadedAt: now,
    status: "IMPORTED",
    acceptedAt: now,
    rawFileStorageDriver: "vercel-blob",
    reportingTimezone: "UTC",
    validationSummary: "{}",
    normalizationVersion: 1,
    createdAt: now,
    updatedAt: now
  };
  await prisma.analyticsImport.createMany({data: [
    {...baseImport, id: importIds.expired, originalFilename: "synthetic-expired.csv", fileHash: hash(importIds.expired), rawFileStorageKey: rawExpired, rawFileExpiresAt: new Date(now.getTime() - 1_000)},
    {...baseImport, id: importIds.retry, originalFilename: "synthetic-retry.csv", fileHash: hash(importIds.retry), rawFileStorageKey: rawRetry, rawFileExpiresAt: new Date(now.getTime() - 1_000)},
    {...baseImport, id: importIds.active, originalFilename: "synthetic-active.csv", fileHash: hash(importIds.active), rawFileStorageKey: rawActive, rawFileExpiresAt: new Date(now.getTime() + 86_400_000)}
  ]});
  await prisma.artistMetricObservation.create({data: {
    id: observationId,
    importId: importIds.expired,
    artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
    metricDate: now,
    listeners: 1,
    monthlyListeners: 1,
    monthlyActiveListeners: 1,
    streams: 1,
    playlistAdds: 1,
    saves: 1,
    followers: 1,
    createdAt: now
  }});

  const activeKeys = new Set([previewActive, rawActive, rawYoungOrphan]);
  const list = async (kind: "analytics-preview" | "analytics-raw") => {
    const ownedKeys = new Set(created.filter((item) => item.kind === kind).map((item) => item.key));
    return (await listStoredAssetReferences(kind))
      .filter((item) => ownedKeys.has(item.storedPath))
      .map((item) => activeKeys.has(item.storedPath) ? {...item, updatedAt: now} : item);
  };
  let failRetryOnce = true;
  const remove = async (kind: StoredAssetKind, key: string) => {
    assert.ok(kind === "analytics-preview" || kind === "analytics-raw");
    if (key === rawRetry && failRetryOnce) {
      failRetryOnce = false;
      throw new Error("Synthetic retryable private storage failure.");
    }
    const result = await deleteStoredAssetStrict(kind, key);
    const index = created.findIndex((item) => item.kind === kind && item.key === key);
    if (index >= 0) created.splice(index, 1);
    return result;
  };
  const deps = {list, remove, now: () => now};

  const dryRun = await runRetentionCleanup({dryRun: true, batchSize: 20}, deps);
  assert.equal(dryRun.expiredPreviews.discovered, 1);
  assert.equal(dryRun.expiredRawFiles.discovered, 2);
  assert.equal(dryRun.orphanedRawFiles.discovered, 1);
  assert.equal((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importIds.expired}})).rawFileDeletedAt, null);

  const applied = await runRetentionCleanup({dryRun: false, batchSize: 20}, deps);
  assert.equal(applied.expiredPreviews.deleted, 1);
  assert.equal(applied.expiredRawFiles.deleted, 1);
  assert.equal(applied.orphanedRawFiles.deleted, 1);
  assert.deepEqual(applied.errors, [{
    category: "expiredRawFiles",
    objectId: importIds.retry,
    code: "STORAGE_DELETE_FAILED"
  }]);
  assert.ok((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importIds.expired}})).rawFileDeletedAt);
  assert.equal((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importIds.retry}})).rawFileDeletedAt, null);
  assert.equal(await prisma.artistMetricObservation.count({where: {id: observationId}}), 1);

  const retry = await runRetentionCleanup({dryRun: false, batchSize: 20}, deps);
  assert.equal(retry.errors.length, 0);
  assert.ok((await prisma.analyticsImport.findUniqueOrThrow({where: {id: importIds.retry}})).rawFileDeletedAt);
  const remainingPreview = new Set((await listStoredAssetReferences("analytics-preview")).map((item) => item.storedPath));
  const remainingRaw = new Set((await listStoredAssetReferences("analytics-raw")).map((item) => item.storedPath));
  assert.ok(remainingPreview.has(previewActive));
  assert.ok(remainingRaw.has(rawActive));
  assert.ok(remainingRaw.has(rawYoungOrphan));
  assert.equal(remainingRaw.has(rawOrphan), false);
  assert.equal(await prisma.analyticsImport.count({where: {id: {startsWith: `gate-b-preview-${runId}`}}}), 0);

  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "gate-b-synthetic-cron-secret-long-enough";
  try {
    const unauthorized = await cleanupRoute(new Request("http://localhost/api/cron/analytics-maintenance?dryRun=1"));
    assert.equal(unauthorized.status, 401);
    const authorized = await cleanupRoute(new Request("http://localhost/api/cron/analytics-maintenance?dryRun=1", {
      headers: {authorization: `Bearer ${process.env.CRON_SECRET}`}
    }));
    assert.equal(authorized.status, 200);
    const responseText = await authorized.text();
    assert.match(responseText, /ANALYTICS_CLEANUP_COMPLETE/);
    assert.doesNotMatch(responseText, /analytics-preview\/[0-9a-f]|analytics-raw\/[0-9a-f]|PRIVATE_BLOB|vercel_blob_rw_/i);
  } finally {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  }

  console.log(JSON.stringify({
    dryRun: "passed",
    previewCleanup: "passed",
    rawCleanup: "passed",
    orphanGraceAndDeletion: "passed",
    activePreviewPreserved: true,
    acceptedImportFilePreserved: true,
    normalizedObservationPreserved: true,
    partialDeleteFailureRetried: true,
    cronAuthorizationAndDryRun: "passed",
    storageKeysExposedInResult: JSON.stringify(applied).includes("analytics-")
  }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Private retention cleanup test failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
