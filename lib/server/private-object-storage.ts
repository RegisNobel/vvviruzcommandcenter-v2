import "server-only";

import {createHash, randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  analyticsPreviewDir,
  analyticsRawDir,
  ensureStorageDirs,
  storageRoot
} from "@/lib/server/storage";

export type PrivateObjectNamespace =
  | "analytics-preview"
  | "analytics-raw"
  | "database-backups";

export type PrivateStorageErrorCode =
  | "PRIVATE_STORAGE_CONFIGURATION"
  | "PRIVATE_STORAGE_HASH_MISMATCH"
  | "PRIVATE_STORAGE_INVALID_KEY"
  | "PRIVATE_STORAGE_NOT_FOUND"
  | "PRIVATE_STORAGE_TOO_LARGE"
  | "PRIVATE_STORAGE_UNAVAILABLE";

export class PrivateStorageError extends Error {
  constructor(
    public readonly code: PrivateStorageErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PrivateStorageError";
  }
}

const namespaceEnvironmentKeys: Record<PrivateObjectNamespace, string> = {
  "analytics-preview": "PRIVATE_STORAGE_PREVIEW_NAMESPACE",
  "analytics-raw": "PRIVATE_STORAGE_RAW_NAMESPACE",
  "database-backups": "PRIVATE_STORAGE_BACKUP_NAMESPACE"
};

const defaultNamespaces: Record<PrivateObjectNamespace, string> = {
  "analytics-preview": "analytics-preview",
  "analytics-raw": "analytics-raw",
  "database-backups": "database-backups"
};

const extensions: Record<PrivateObjectNamespace, string> = {
  "analytics-preview": ".csv",
  "analytics-raw": ".csv",
  "database-backups": ".json.gz.enc"
};

function sanitizedNamespace(value: string | undefined, fallback: string) {
  const namespace = value?.trim() || fallback;
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(namespace)) {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_CONFIGURATION",
      "Private storage namespace configuration is invalid."
    );
  }
  return namespace;
}

export function getPrivateStorageNamespace(namespace: PrivateObjectNamespace) {
  return sanitizedNamespace(
    process.env[namespaceEnvironmentKeys[namespace]],
    defaultNamespaces[namespace]
  );
}

export function getPrivateStorageDriver() {
  return process.env.PRIVATE_STORAGE_DRIVER === "vercel-blob"
    ? "vercel-blob"
    : "local";
}

function privateBlobToken() {
  const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_CONFIGURATION",
      "Private object storage credentials are unavailable."
    );
  }
  return token;
}

function maximumObjectBytes() {
  const configured = Number(process.env.PRIVATE_STORAGE_MAX_OBJECT_BYTES ?? 536_870_912);
  return Number.isInteger(configured) && configured >= 10_485_760 && configured <= 5_497_558_138_880
    ? configured
    : 536_870_912;
}

function localDirectory(namespace: PrivateObjectNamespace) {
  if (namespace === "analytics-preview") return analyticsPreviewDir;
  if (namespace === "analytics-raw") return analyticsRawDir;
  return path.join(storageRoot, "database-backups");
}

function expectedObjectName(namespace: PrivateObjectNamespace, objectName: string) {
  const extension = extensions[namespace].replace(/\./g, "\\.");
  const matcher = new RegExp(
    `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}${extension}$`,
    "i"
  );
  return matcher.test(objectName);
}

export function validatePrivateObjectKey(
  namespace: PrivateObjectNamespace,
  value: string
) {
  const key = value.trim().replace(/\\/g, "/");
  const prefix = `${getPrivateStorageNamespace(namespace)}/`;
  const objectName = key.slice(prefix.length);
  if (
    !key.startsWith(prefix) ||
    objectName.includes("/") ||
    !expectedObjectName(namespace, objectName)
  ) {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_INVALID_KEY",
      "Private object reference is invalid."
    );
  }
  return key;
}

export function createPrivateObjectKey(
  namespace: PrivateObjectNamespace,
  objectId: string = randomUUID()
) {
  const objectName = `${objectId}${extensions[namespace]}`;
  return validatePrivateObjectKey(
    namespace,
    `${getPrivateStorageNamespace(namespace)}/${objectName}`
  );
}

export function checksumPrivateObject(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeStorageError(error: unknown): never {
  if (error instanceof PrivateStorageError) throw error;
  if (error instanceof Error && error.name === "BlobNotFoundError") {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_NOT_FOUND",
      "Private object was not found."
    );
  }
  throw new PrivateStorageError(
    "PRIVATE_STORAGE_UNAVAILABLE",
    "Private object storage operation failed."
  );
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maximumObjectBytes()) {
        await reader.cancel();
        throw new PrivateStorageError(
          "PRIVATE_STORAGE_TOO_LARGE",
          "Private object exceeds the configured size limit."
        );
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

export async function storePrivateObject({
  abortSignal,
  data,
  namespace,
  objectId
}: {
  abortSignal?: AbortSignal;
  data: Buffer;
  namespace: PrivateObjectNamespace;
  objectId?: string;
}) {
  if (data.byteLength > maximumObjectBytes()) {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_TOO_LARGE",
      "Private object exceeds the configured size limit."
    );
  }
  const key = createPrivateObjectKey(namespace, objectId);
  const checksumSha256 = checksumPrivateObject(data);
  const createdAt = new Date();

  if (getPrivateStorageDriver() === "vercel-blob") {
    try {
      const {put} = await import("@vercel/blob");
      await put(key, data, {
        access: "private",
        abortSignal,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/octet-stream",
        maximumSizeInBytes: maximumObjectBytes(),
        multipart: data.byteLength > 4 * 1024 * 1024,
        token: privateBlobToken()
      });
    } catch (error) {
      safeStorageError(error);
    }
  } else {
    await ensureStorageDirs();
    const directory = localDirectory(namespace);
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path.join(directory, path.basename(key)), data, {flag: "wx"});
  }

  return {key, sizeBytes: data.byteLength, checksumSha256, createdAt};
}

export async function readPrivateObject(
  namespace: PrivateObjectNamespace,
  objectKey: string,
  options: {abortSignal?: AbortSignal; expectedSha256?: string} = {}
) {
  const key = validatePrivateObjectKey(namespace, objectKey);
  let buffer: Buffer;
  if (getPrivateStorageDriver() === "vercel-blob") {
    try {
      const {get} = await import("@vercel/blob");
      const result = await get(key, {
        access: "private",
        abortSignal: options.abortSignal,
        token: privateBlobToken(),
        useCache: false
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new PrivateStorageError(
          "PRIVATE_STORAGE_NOT_FOUND",
          "Private object was not found."
        );
      }
      buffer = await streamToBuffer(result.stream);
    } catch (error) {
      safeStorageError(error);
    }
  } else {
    try {
      buffer = await fs.readFile(path.join(localDirectory(namespace), path.basename(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new PrivateStorageError(
          "PRIVATE_STORAGE_NOT_FOUND",
          "Private object was not found."
        );
      }
      safeStorageError(error);
    }
  }

  const checksumSha256 = checksumPrivateObject(buffer);
  if (options.expectedSha256 && checksumSha256 !== options.expectedSha256) {
    throw new PrivateStorageError(
      "PRIVATE_STORAGE_HASH_MISMATCH",
      "Private object integrity verification failed."
    );
  }
  return {buffer, checksumSha256, sizeBytes: buffer.byteLength};
}

export async function deletePrivateObject(
  namespace: PrivateObjectNamespace,
  objectKey: string
) {
  const key = validatePrivateObjectKey(namespace, objectKey);
  if (getPrivateStorageDriver() === "vercel-blob") {
    try {
      const {del} = await import("@vercel/blob");
      await del(key, {token: privateBlobToken()});
      return {deleted: true as const, alreadyAbsent: false as const};
    } catch (error) {
      safeStorageError(error);
    }
  }

  try {
    await fs.unlink(path.join(localDirectory(namespace), path.basename(key)));
    return {deleted: true as const, alreadyAbsent: false as const};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {deleted: false as const, alreadyAbsent: true as const};
    }
    safeStorageError(error);
  }
}

export async function listPrivateObjects(namespace: PrivateObjectNamespace) {
  const prefix = `${getPrivateStorageNamespace(namespace)}/`;
  if (getPrivateStorageDriver() === "vercel-blob") {
    const objects: Array<{
      id: string;
      storedPath: string;
      sizeBytes: number;
      updatedAt: Date;
      etag: string;
    }> = [];
    try {
      const {list} = await import("@vercel/blob");
      let cursor: string | undefined;
      do {
        const result = await list({cursor, prefix, token: privateBlobToken()});
        for (const blob of result.blobs) {
          const key = validatePrivateObjectKey(namespace, blob.pathname);
          objects.push({
            id: path.basename(key),
            storedPath: key,
            sizeBytes: blob.size,
            updatedAt: new Date(blob.uploadedAt),
            etag: blob.etag
          });
        }
        cursor = result.cursor;
      } while (cursor);
    } catch (error) {
      safeStorageError(error);
    }
    return objects;
  }

  await ensureStorageDirs();
  const directory = localDirectory(namespace);
  await fs.mkdir(directory, {recursive: true});
  const entries = await fs.readdir(directory, {withFileTypes: true});
  return Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const key = validatePrivateObjectKey(namespace, `${prefix}${entry.name}`);
    const filePath = path.join(directory, entry.name);
    const stat = await fs.stat(filePath);
    return {
      id: entry.name,
      storedPath: key,
      sizeBytes: stat.size,
      updatedAt: stat.mtime,
      etag: checksumPrivateObject(await fs.readFile(filePath))
    };
  }));
}
