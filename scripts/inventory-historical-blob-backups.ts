import assert from "node:assert/strict";

import {list} from "@vercel/blob";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  assert.ok(token, "BLOB_READ_WRITE_TOKEN is required.");
  const prefix = `${process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz"}/backups/`;
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const result = await list({cursor, prefix, token});
    blobs.push(...result.blobs);
    cursor = result.cursor;
  } while (cursor);

  const dates = blobs.map((blob) => new Date(blob.uploadedAt)).sort((a, b) => a.getTime() - b.getTime());
  const byType = new Map<string, {count: number; sizeBytes: number}>();
  let encryptedFilenameCount = 0;
  let unrecognizedPathCount = 0;
  let restoreTestEligible = 0;
  const etags = new Map<string, number>();

  for (const blob of blobs) {
    const relative = blob.pathname.slice(prefix.length);
    const [type] = relative.split("/");
    const recognizedType = type === "database-snapshot" || type === "asset-manifest";
    const recognizedShape = /^(database-snapshot|asset-manifest)\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9._-]+\.json\.gz\.enc$/.test(relative);
    if (!recognizedShape) unrecognizedPathCount += 1;
    if (blob.pathname.endsWith(".json.gz.enc")) encryptedFilenameCount += 1;
    if (type === "database-snapshot" && blob.pathname.endsWith(".json.gz.enc") && blob.size > 0) {
      restoreTestEligible += 1;
    }
    const group = byType.get(recognizedType ? type : "unclassified") ?? {count: 0, sizeBytes: 0};
    group.count += 1;
    group.sizeBytes += blob.size;
    byType.set(recognizedType ? type : "unclassified", group);
    if (blob.etag) etags.set(blob.etag, (etags.get(blob.etag) ?? 0) + 1);
  }

  const duplicateEtagGroups = [...etags.values()].filter((count) => count > 1);
  const missingMetadataCount = blobs.filter((blob) =>
    !blob.pathname || !blob.etag || !blob.uploadedAt || !Number.isFinite(blob.size)
  ).length;

  console.log(JSON.stringify({
    objectCount: blobs.length,
    totalSizeBytes: blobs.reduce((sum, blob) => sum + blob.size, 0),
    dateRange: {
      earliest: dates[0]?.toISOString() ?? null,
      latest: dates.at(-1)?.toISOString() ?? null
    },
    byType: Object.fromEntries([...byType.entries()].sort(([left], [right]) => left.localeCompare(right))),
    encryption: {
      filenameIndicatesEncryptedCount: encryptedFilenameCount,
      exactEnvelopeVersion: "unavailable-from-object-metadata",
      contentDownloadedOrDecrypted: false
    },
    duplicateCandidates: {
      matchingEtagGroups: duplicateEtagGroups.length,
      objectsInMatchingEtagGroups: duplicateEtagGroups.reduce((sum, count) => sum + count, 0),
      interpretation: "candidate-only; no deletion eligibility inferred"
    },
    supersededObjects: "not-identifiable-from-object-metadata",
    retentionEligibleObjects: 0,
    retentionDecision: "pending-explicit-approval",
    missingMetadataCount,
    unrecognizedPathCount,
    restoreTestEligibleObjects: restoreTestEligible,
    urlsExposed: false
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Historical backup inventory failed.");
  process.exitCode = 1;
});
