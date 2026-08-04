import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

import {list} from "@vercel/blob";

import {
  PrivateStorageError,
  createPrivateObjectKey,
  deletePrivateObject,
  listPrivateObjects,
  readPrivateObject,
  storePrivateObject
} from "../lib/server/private-object-storage";
import {
  createSpotifyPreviewToken,
  readSpotifyPreviewToken
} from "../lib/analytics/spotify-preview-token";

async function expectPrivateError(
  operation: () => Promise<unknown>,
  code: PrivateStorageError["code"]
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PrivateStorageError);
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /token|vercel_blob_rw_|https?:\/\//i);
    return true;
  });
}

async function main() {
  const privateToken = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
  assert.ok(privateToken, "PRIVATE_BLOB_READ_WRITE_TOKEN is required.");
  assert.equal(process.env.PRIVATE_STORAGE_DRIVER, "vercel-blob");
  const publicToken = process.env.GATE_B_PUBLIC_BLOB_READ_WRITE_TOKEN?.trim();
  const originalPrivateToken = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const createdKeys: string[] = [];

  try {
    process.env.AUTH_SECRET = "gate-b-preview-token-secret-".repeat(3);
    const csv = Buffer.from(
      "date,listeners,streams\n2026-08-01,7,11\n",
      "utf8"
    );
    const stored = await storePrivateObject({
      namespace: "analytics-preview",
      data: csv
    });
    createdKeys.push(stored.key);
    assert.match(stored.key, /^analytics-preview\/[0-9a-f-]{36}\.csv$/i);
    assert.doesNotMatch(stored.key, /listeners|spotify|vvviruz|\.com/i);

    const sdkListing = await list({
      prefix: `${stored.key}/`.replace(/[^/]+\/$/, ""),
      token: privateToken
    });
    const sdkObject = sdkListing.blobs.find((blob) => blob.pathname === stored.key);
    assert.ok(sdkObject, "Uploaded object must be present in the private store.");
    const anonymous = await fetch(sdkObject.url, {redirect: "manual"});
    assert.ok([401, 403, 404].includes(anonymous.status));

    const retrieved = await readPrivateObject("analytics-preview", stored.key, {
      expectedSha256: stored.checksumSha256
    });
    assert.deepEqual(retrieved.buffer, csv);
    assert.equal(retrieved.sizeBytes, csv.byteLength);

    const safeListing = await listPrivateObjects("analytics-preview");
    const safeMetadata = safeListing.find((item) => item.storedPath === stored.key);
    assert.ok(safeMetadata);
    assert.equal(JSON.stringify(safeMetadata).includes("url"), false);
    assert.equal(JSON.stringify(safeMetadata).includes(privateToken), false);

    const preview = createSpotifyPreviewToken({
      userId: "gate-b-admin",
      fileHash: stored.checksumSha256,
      parserVersion: "gate-b",
      normalizationVersion: 1,
      detectedType: "ARTIST_AUDIENCE_TIMELINE",
      parsedResultChecksum: stored.checksumSha256,
      temporaryRawFileReference: stored.key,
      originalFileName: "synthetic.csv",
      mimeType: "text/csv",
      sizeBytes: csv.byteLength,
      previewPeriod: null,
      candidateArtistProfileId: null,
      candidateReleaseId: null,
      reprocessSourceImportId: null
    });
    const previewPayload = readSpotifyPreviewToken(preview.token);
    assert.equal(previewPayload?.temporaryRawFileReference, stored.key);
    assert.equal(preview.token.includes(stored.key), false);

    assert.throws(
      () => createPrivateObjectKey("analytics-preview", "../../original-file-name"),
      (error: unknown) => error instanceof PrivateStorageError &&
        error.code === "PRIVATE_STORAGE_INVALID_KEY"
    );
    await expectPrivateError(
      () => readPrivateObject("analytics-raw", stored.key),
      "PRIVATE_STORAGE_INVALID_KEY"
    );
    await expectPrivateError(
      () => readPrivateObject("analytics-preview", stored.key, {
        expectedSha256: "0".repeat(64)
      }),
      "PRIVATE_STORAGE_HASH_MISMATCH"
    );

    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = "invalid-private-token";
    await expectPrivateError(
      () => listPrivateObjects("analytics-preview"),
      "PRIVATE_STORAGE_UNAVAILABLE"
    );

    if (publicToken) {
      process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = publicToken;
      await expectPrivateError(
        () => storePrivateObject({
          namespace: "analytics-preview",
          data: csv,
          objectId: randomUUID()
        }),
        "PRIVATE_STORAGE_UNAVAILABLE"
      );
    }

    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = privateToken;
    const uploadController = new AbortController();
    uploadController.abort();
    await expectPrivateError(
      () => storePrivateObject({
        abortSignal: uploadController.signal,
        namespace: "analytics-preview",
        data: csv,
        objectId: randomUUID()
      }),
      "PRIVATE_STORAGE_UNAVAILABLE"
    );
    const controller = new AbortController();
    controller.abort();
    await expectPrivateError(
      () => readPrivateObject("analytics-preview", stored.key, {
        abortSignal: controller.signal
      }),
      "PRIVATE_STORAGE_UNAVAILABLE"
    );

    await deletePrivateObject("analytics-preview", stored.key);
    createdKeys.splice(createdKeys.indexOf(stored.key), 1);
    await deletePrivateObject("analytics-preview", stored.key);
    await expectPrivateError(
      () => readPrivateObject("analytics-preview", stored.key),
      "PRIVATE_STORAGE_NOT_FOUND"
    );

    console.log(JSON.stringify({
      anonymousStatus: anonymous.status,
      byteIntegrity: true,
      deleteIdempotent: true,
      invalidCredentialSanitized: true,
      uploadAndRetrievalAbortSanitized: true,
      listingExposesUrl: false,
      missingObjectFailsSafely: true,
      previewTokenContainsOpaqueReferenceOnly: true,
      publicStoreTokenRejected: Boolean(publicToken),
      storeDriver: "vercel-blob"
    }, null, 2));
  } finally {
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = privateToken;
    for (const key of createdKeys) {
      await deletePrivateObject("analytics-preview", key).catch(() => undefined);
    }
    if (originalPrivateToken === undefined) delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    else process.env.PRIVATE_BLOB_READ_WRITE_TOKEN = originalPrivateToken;
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
  }
}

void main().catch((error) => {
  console.error(error instanceof PrivateStorageError
    ? `${error.code}: ${error.message}`
    : error);
  process.exitCode = 1;
});
