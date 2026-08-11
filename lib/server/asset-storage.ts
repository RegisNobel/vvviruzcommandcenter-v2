import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {fileNameFromPath} from "@/lib/utils";

import {
  artistIntakeImagesDir,
  analyticsPreviewDir,
  analyticsRawDir,
  adsPreviewDir,
  adsRawDir,
  ensureStorageDirs,
  exclusiveArtDir,
  exclusiveTracksDir,
  releaseCoversDir,
  siteIconsDir
} from "@/lib/server/storage";
import {
  deletePrivateObject,
  getPrivateStorageDriver,
  listPrivateObjects,
  readPrivateObject,
  storePrivateObject,
  type PrivateObjectNamespace
} from "@/lib/server/private-object-storage";

export type StoredAssetKind =
  | "cover"
  | "artist-intake-image"
  | "site-icon"
  | "exclusive-art"
  | "exclusive-track"
  | "analytics-preview"
  | "analytics-raw"
  | "ads-preview"
  | "ads-raw";

export type StoredAssetAccess = "public" | "private";

export type StoredAssetResult = {
  id: string;
  url: string;
  storedPath: string;
  publicUrl: string | null;
};

export function getAssetStorageDriver() {
  return process.env.ASSET_STORAGE_DRIVER === "vercel-blob" ? "vercel-blob" : "local";
}

export function getPrivateAssetStorageDriver() {
  return getPrivateStorageDriver();
}

export function isDurableObjectStorageEnabled() {
  return getAssetStorageDriver() === "vercel-blob";
}

export function isRemoteAssetReference(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isAnalyticsAssetKind(
  kind: StoredAssetKind
): kind is Extract<StoredAssetKind, PrivateObjectNamespace> {
  return kind === "analytics-preview" || kind === "analytics-raw" || kind === "ads-preview" || kind === "ads-raw";
}

function getAssetDirectory(kind: StoredAssetKind) {
  switch (kind) {
    case "cover":
      return releaseCoversDir;
    case "artist-intake-image":
      return artistIntakeImagesDir;
    case "site-icon":
      return siteIconsDir;
    case "exclusive-art":
      return exclusiveArtDir;
    case "exclusive-track":
      return exclusiveTracksDir;
    case "analytics-preview":
      return analyticsPreviewDir;
    case "analytics-raw":
      return analyticsRawDir;
    case "ads-preview":
      return adsPreviewDir;
    case "ads-raw":
      return adsRawDir;
  }
}

function getAssetRouteKind(kind: StoredAssetKind) {
  return kind;
}

export function getBlobPath(kind: StoredAssetKind, fileName: string) {
  const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
  const safeFileName = fileNameFromPath(fileName);

  return `${prefix}/${kind}/${safeFileName}`;
}

export function getLocalAssetUrl(kind: StoredAssetKind, fileName: string) {
  return `/api/assets/${getAssetRouteKind(kind)}/${fileNameFromPath(fileName)}`;
}

export async function storeAsset({
  access = "public",
  contentType,
  data,
  fileName,
  kind
}: {
  access?: StoredAssetAccess;
  contentType?: string;
  data: Buffer;
  fileName: string;
  kind: StoredAssetKind;
}): Promise<StoredAssetResult> {
  const safeFileName = fileNameFromPath(fileName);

  if (isAnalyticsAssetKind(kind)) {
    if (access !== "private") {
      throw new Error("Analytics objects require private storage.");
    }
    const stored = await storePrivateObject({
      namespace: kind,
      objectId: path.basename(safeFileName, path.extname(safeFileName)),
      data
    });
    return {
      id: path.basename(stored.key),
      url: stored.key,
      storedPath: stored.key,
      publicUrl: null
    };
  }

  if (isDurableObjectStorageEnabled()) {
    const {put} = await import("@vercel/blob");
    const blob = await put(getBlobPath(kind, safeFileName), data, {
      access,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType
    });

    return {
      id: safeFileName,
      url: access === "public" ? blob.url : getLocalAssetUrl(kind, safeFileName),
      storedPath: blob.url,
      publicUrl: access === "public" ? blob.url : null
    };
  }

  await ensureStorageDirs();
  await fs.writeFile(path.join(getAssetDirectory(kind), safeFileName), data);

  return {
    id: safeFileName,
    url: getLocalAssetUrl(kind, safeFileName),
    storedPath: safeFileName,
    publicUrl: access === "public" ? getLocalAssetUrl(kind, safeFileName) : null
  };
}

export async function deleteAsset(kind: StoredAssetKind, assetPathOrUrl: string) {
  if (!assetPathOrUrl) return;

  if (isAnalyticsAssetKind(kind)) {
    try {
      await deletePrivateObject(kind, assetPathOrUrl);
    } catch {
      console.error("Failed to delete private analytics object.");
    }
    return;
  }

  const fileName = fileNameFromPath(assetPathOrUrl);
  if (!fileName) return;

  try {
    if (isDurableObjectStorageEnabled()) {
      const { del } = await import("@vercel/blob");
      try {
        await del(getBlobPath(kind, fileName));
      } catch (e) {
        console.error(`Failed to delete blob ${kind}/${fileName}:`, e);
      }
      try {
        await del(getBlobPath(kind, `original-${fileName}`));
      } catch (e) {
        console.error(`Failed to delete original blob ${kind}/original-${fileName}:`, e);
      }
    } else {
      const localPath = path.join(getAssetDirectory(kind), fileName);
      await fs.unlink(localPath).catch(() => {});
      const originalLocalPath = path.join(getAssetDirectory(kind), `original-${fileName}`);
      await fs.unlink(originalLocalPath).catch(() => {});
    }
  } catch (error) {
    console.error(`Failed to delete asset ${kind}/${fileName}:`, error);
  }
}

/**
 * Deletes one stored object and reports failures to the caller. Cleanup jobs use
 * this stricter variant so they never mark database metadata as deleted after a
 * storage failure. Missing local files are treated as an idempotent success.
 */
export async function deleteStoredAssetStrict(
  kind: StoredAssetKind,
  assetPathOrUrl: string
) {
  if (isAnalyticsAssetKind(kind)) {
    return deletePrivateObject(kind, assetPathOrUrl);
  }

  const fileName = fileNameFromPath(assetPathOrUrl);
  if (!fileName) return {deleted: false as const, alreadyAbsent: true as const};

  if (isDurableObjectStorageEnabled()) {
    const {del} = await import("@vercel/blob");
    await del(isRemoteAssetReference(assetPathOrUrl) ? assetPathOrUrl : getBlobPath(kind, fileName));
    return {deleted: true as const, alreadyAbsent: false as const};
  }

  const localPath = path.join(getAssetDirectory(kind), fileName);
  try {
    await fs.unlink(localPath);
    return {deleted: true as const, alreadyAbsent: false as const};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {deleted: false as const, alreadyAbsent: true as const};
    }
    throw error;
  }
}


async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const {done, value} = await reader.read();

    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function readRemoteAsset(reference: string, access: StoredAssetAccess) {
  const {get} = await import("@vercel/blob");
  const result = await get(reference, {
    access,
    useCache: access === "public"
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Remote asset not found.");
  }

  return streamToBuffer(result.stream);
}

export async function readAssetBuffer(
  kind: StoredAssetKind,
  assetId: string,
  access: StoredAssetAccess = kind === "exclusive-track" ? "private" : "public"
) {
  const trimmedAssetId = assetId.trim();

  if (isAnalyticsAssetKind(kind)) {
    if (access !== "private") {
      throw new Error("Analytics objects require private retrieval.");
    }
    return (await readPrivateObject(kind, trimmedAssetId)).buffer;
  }

  if (isRemoteAssetReference(trimmedAssetId)) {
    return readRemoteAsset(trimmedAssetId, access);
  }

  const safeAssetId = fileNameFromPath(trimmedAssetId);
  const localPath = path.join(getAssetDirectory(kind), safeAssetId);

  try {
    return await fs.readFile(localPath);
  } catch (error) {
    if (!isDurableObjectStorageEnabled()) {
      throw error;
    }

    return readRemoteAsset(getBlobPath(kind, safeAssetId), access);
  }
}

export async function resolveAssetToLocalPath(
  kind: StoredAssetKind,
  assetId: string,
  access: StoredAssetAccess = kind === "exclusive-track" ? "private" : "public"
) {
  const trimmedAssetId = assetId.trim();
  const safeAssetId = fileNameFromPath(trimmedAssetId);
  const localPath = path.join(getAssetDirectory(kind), safeAssetId);

  try {
    await fs.access(localPath);
    return localPath;
  } catch (error) {
    if (!isDurableObjectStorageEnabled() && !isRemoteAssetReference(trimmedAssetId)) {
      throw error;
    }
  }

  const buffer = await readAssetBuffer(kind, trimmedAssetId || safeAssetId, access);
  const tempDir = path.join(os.tmpdir(), "vvviruz-assets", kind);
  const tempPath = path.join(tempDir, safeAssetId || crypto.randomUUID());

  await fs.mkdir(tempDir, {recursive: true});
  await fs.writeFile(tempPath, buffer);

  return tempPath;
}

export async function listStoredAssetReferences(kind: "analytics-preview" | "analytics-raw" | "ads-preview" | "ads-raw") {
  return (await listPrivateObjects(kind)).map(({id, storedPath, updatedAt}) => ({
    id,
    storedPath,
    updatedAt
  }));
}
