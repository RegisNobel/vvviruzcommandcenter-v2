# Private object storage

## Gate B architecture

Vercel Blob is the selected provider. Two IAD1 private stores isolate environments:

- `vvviruz-retention-private-nonprod` (`store_5VKKY7FhNuJKCmpX`) serves Preview and Development.
- `vvviruz-retention-private-production` (`store_jEPj6g95XKRXy5a0`) serves Production.

Both stores require authentication for every read and write. The project receives separate, encrypted, store-scoped `PRIVATE_BLOB_READ_WRITE_TOKEN` values. The existing public store and `BLOB_READ_WRITE_TOKEN` remain dedicated to public media and historical objects. No private store URL, token, signed URL, or storage key is returned to a browser.

The application uses the `@vercel/blob` server SDK with an explicit private token and `get(..., {access: "private", useCache: false})`. It does not issue signed retrieval URLs. Vercel supports private Blob on all plans with `@vercel/blob` 2.3 or later; this project uses 2.3.3 on a Hobby account. Private and public stores have the same storage/operation pricing, and Hobby usage is shared with other Vercel services. The stores currently report active billing and no exceeded quota. Usage and cost must be monitored as retained bytes and retrievals grow.

Vercel's platform maximum is 5 TB per object and recommends multipart upload above 100 MB. The application intentionally caps private objects at 512 MiB and enables multipart upload above 4 MiB. The selected region is IAD1 and cannot be treated as an application-level residency guarantee without a separate compliance review.

## Namespaces and keys

One private store per environment uses three opaque namespaces:

- `analytics-preview/<uuid>.csv`
- `analytics-raw/<uuid>.csv`
- `database-backups/<uuid>.json.gz.enc`

UUIDs are generated server-side. Keys reject URLs, traversal, nested caller paths, original filenames, artist/release names, email addresses, import titles, and raw hashes. Original filenames remain sanitized database metadata. Private CSV objects are stored as `application/octet-stream`; they are read only by trusted server code and are never routed through `/api/assets`.

The token identifies its store, so no runtime store identifier is required. Configuration is:

- `PRIVATE_STORAGE_DRIVER=vercel-blob`
- `PRIVATE_BLOB_READ_WRITE_TOKEN` (encrypted, server-only, different per production and non-production)
- `PRIVATE_STORAGE_PREVIEW_NAMESPACE=analytics-preview`
- `PRIVATE_STORAGE_RAW_NAMESPACE=analytics-raw`
- `PRIVATE_STORAGE_BACKUP_NAMESPACE=database-backups`
- `PRIVATE_STORAGE_MAX_OBJECT_BYTES=536870912`

Public assets continue to use `ASSET_STORAGE_DRIVER`, `BLOB_READ_WRITE_TOKEN`, and `BLOB_PREFIX`.

## Access behavior

Uploads return only an opaque pathname, byte count, SHA-256 checksum, and timestamp. Listing returns opaque ID/pathname, size, timestamp, and ETag; Blob URLs are discarded. Reads validate the expected namespace and UUID key before using authenticated SDK download. An optional expected SHA-256 check rejects partial or changed content. Deletes are idempotent. SDK errors are reduced to stable operational codes without provider messages, tokens, URLs, or keys.

Preview objects expire independently of the encrypted preview token. Raw objects retain a database driver, opaque key, size, hash, expiration, and deletion timestamp. Storage deletion precedes `rawFileDeletedAt`; a failure leaves the database row retryable. Imports, mappings, audits, and normalized observations are not deleted with raw bytes.

## Backup behavior

Backup artifacts are compressed and encrypted with AES-256-GCM before private upload. The private Blob key is opaque; the human-readable generated filename is used only for the optional Google Drive copy. Restore retrieves bytes with the server token, verifies SHA-256, rejects malformed/corrupt ciphertext and the wrong encryption secret, decrypts, decompresses, and imports into the selected database. Restore never deletes its source object automatically.

The strength and rotation history of the production `BACKUP_ENCRYPTION_SECRET` were not independently assessed in Gate B. Gate B used a generated synthetic secret for the disposable restore test and did not read, print, or rotate the production secret.

## Historical public-store inventory

The metadata-only 2026-08-04 inventory found 213 encrypted-name objects totaling 149,757,887 bytes, dated from 2026-04-30T03:03:06Z through 2026-08-04T09:03:26Z:

- 105 database snapshots totaling 149,356,490 bytes.
- 108 asset manifests totaling 401,397 bytes.

All paths match the established encrypted filename layout, all required Blob metadata is present, and no matching-ETag duplicate candidates were found. Exact envelope versions are unavailable from Blob metadata because object contents were intentionally not downloaded or decrypted. No historical object is currently eligible for deletion because retention approval has not been granted.

## Unexecuted migration plan

1. Freeze deletion in the old public store.
2. Select a small encrypted database-snapshot sample after explicit approval.
3. Download it through trusted server credentials and upload the unchanged ciphertext to `database-backups/<uuid>.json.gz.enc` in the production private store. Vercel provider-side `copy` is store-scoped, so cross-store migration requires download and re-upload.
4. Compare source and destination SHA-256 checksums and byte counts.
5. Restore exclusively from the private copy into a disposable database and compare expected analytics and Breaking Barz records.
6. Preserve the old object throughout sample and batch validation.
7. Batch with bounded concurrency, durable per-object state, checksum verification, retries with backoff, and resumable cursors.
8. Approve a final backup retention window and cost budget.
9. Delete old public copies only in a later explicitly approved gate after migration completeness and restore evidence are reviewed.

Gate B did not copy, reclassify, or delete any historical object.

## Deployment boundary

The private stores and future-deployment environment values are provisioned, but the application was not deployed and existing production backup writes were not switched. The current production deployment therefore continues its prior backup destination until the final reviewed deployment. The production analytics cleanup cron was not invoked against real data. A later deployment must validate environment separation, take a reviewed backup, and smoke-test private writes before enabling production analytics workflows.
