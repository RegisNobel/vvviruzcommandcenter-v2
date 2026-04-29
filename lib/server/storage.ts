import fs from "node:fs/promises";
import path from "node:path";

import {fileNameFromPath} from "@/lib/utils";
export {
  deleteProject,
  readProject,
  readProjectSummaries,
  readProjectsByReleaseId,
  saveProject
} from "@/lib/repositories/projects";

export const storageRoot = path.join(process.cwd(), "storage");
export const uploadsDir = path.join(storageRoot, "uploads");
export const exportsDir = path.join(storageRoot, "exports");
export const backgroundsDir = path.join(storageRoot, "backgrounds");
export const releaseCoversDir = path.join(storageRoot, "release-covers");
export const siteIconsDir = path.join(storageRoot, "site_icons");
export const exclusiveTracksDir = path.join(storageRoot, "exclusive-tracks");
export const exclusiveArtDir = path.join(storageRoot, "exclusive-art");
export const projectsDir = path.join(storageRoot, "projects");
export const releasesDir = path.join(storageRoot, "releases");
export const copiesDir = path.join(storageRoot, "copies");

const SITE_ICON_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif"
]);

const EXCLUSIVE_TRACK_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a"
]);

const EXCLUSIVE_ART_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp"
]);

function isDurableObjectStorageEnabled() {
  return process.env.ASSET_STORAGE_DRIVER === "vercel-blob";
}

function getBlobPrefix() {
  return process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
}

async function listBlobAssetFiles(
  kind: "site-icon" | "exclusive-track" | "exclusive-art",
  allowedExtensions: Set<string>
) {
  const {list} = await import("@vercel/blob");
  const files = new Set<string>();
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await list({
      prefix: `${getBlobPrefix()}/${kind}/`,
      cursor
    });

    for (const blob of result.blobs) {
      const fileName = fileNameFromPath(blob.pathname);

      if (allowedExtensions.has(path.extname(fileName).toLowerCase())) {
        files.add(fileName);
      }
    }

    cursor = result.cursor;
    hasMore = Boolean(result.hasMore && cursor);
  }

  return Array.from(files).sort((left, right) => left.localeCompare(right));
}

export async function ensureStorageDirs() {
  await Promise.all([
    fs.mkdir(uploadsDir, {recursive: true}),
    fs.mkdir(exportsDir, {recursive: true}),
    fs.mkdir(backgroundsDir, {recursive: true}),
    fs.mkdir(releaseCoversDir, {recursive: true}),
    fs.mkdir(siteIconsDir, {recursive: true}),
    fs.mkdir(exclusiveTracksDir, {recursive: true}),
    fs.mkdir(exclusiveArtDir, {recursive: true}),
    fs.mkdir(projectsDir, {recursive: true}),
    fs.mkdir(releasesDir, {recursive: true}),
    fs.mkdir(copiesDir, {recursive: true})
  ]);
}

export async function listSiteIconFiles() {
  if (isDurableObjectStorageEnabled()) {
    return listBlobAssetFiles("site-icon", SITE_ICON_EXTENSIONS);
  }

  await ensureStorageDirs();
  const entries = await fs.readdir(siteIconsDir, {withFileTypes: true});

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => SITE_ICON_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

async function listFilesByExtension(
  kind: "exclusive-track" | "exclusive-art",
  directory: string,
  allowedExtensions: Set<string>
) {
  if (isDurableObjectStorageEnabled()) {
    return listBlobAssetFiles(kind, allowedExtensions);
  }

  await ensureStorageDirs();
  const entries = await fs.readdir(directory, {withFileTypes: true});

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => allowedExtensions.has(path.extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

export async function listExclusiveTrackFiles() {
  return listFilesByExtension(
    "exclusive-track",
    exclusiveTracksDir,
    EXCLUSIVE_TRACK_EXTENSIONS
  );
}

export async function listExclusiveArtFiles() {
  return listFilesByExtension("exclusive-art", exclusiveArtDir, EXCLUSIVE_ART_EXTENSIONS);
}

export function sanitizeAssetId(assetId: string) {
  return fileNameFromPath(assetId);
}

export async function resolveAssetPath(
  kind:
    | "audio"
    | "background"
    | "cover"
    | "export"
    | "site-icon"
    | "exclusive-art"
    | "exclusive-track",
  assetId: string
) {
  await ensureStorageDirs();
  const safeAssetId = sanitizeAssetId(assetId);
  const baseDir =
    kind === "audio"
      ? uploadsDir
      : kind === "background"
        ? backgroundsDir
      : kind === "cover"
        ? releaseCoversDir
        : kind === "site-icon"
          ? siteIconsDir
        : kind === "exclusive-art"
          ? exclusiveArtDir
        : kind === "exclusive-track"
          ? exclusiveTracksDir
        : exportsDir;
  const filePath = path.join(baseDir, safeAssetId);

  await fs.access(filePath);

  return filePath;
}
