import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {fileNameFromPath} from "@/lib/utils";

import {
  ensureStorageDirs,
  exclusiveArtDir,
  exclusiveTracksDir,
  releaseCoversDir,
  siteIconsDir
} from "@/lib/server/storage";

export type StoredAssetKind =
  | "cover"
  | "site-icon"
  | "exclusive-art"
  | "exclusive-track";

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

export function isDurableObjectStorageEnabled() {
  return getAssetStorageDriver() === "vercel-blob";
}

export function isRemoteAssetReference(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function getAssetDirectory(kind: StoredAssetKind) {
  switch (kind) {
    case "cover":
      return releaseCoversDir;
    case "site-icon":
      return siteIconsDir;
    case "exclusive-art":
      return exclusiveArtDir;
    case "exclusive-track":
      return exclusiveTracksDir;
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
