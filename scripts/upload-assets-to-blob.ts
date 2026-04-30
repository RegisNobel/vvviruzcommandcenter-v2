import fs from "node:fs/promises";
import path from "node:path";

import {put} from "@vercel/blob";

import {getBlobPath, type StoredAssetAccess, type StoredAssetKind} from "../lib/server/asset-storage";
import {
  exclusiveArtDir,
  exclusiveTracksDir,
  releaseCoversDir,
  siteIconsDir
} from "../lib/server/storage";

type AssetDirectory = {
  access: StoredAssetAccess;
  directory: string;
  kind: StoredAssetKind;
};

const envFiles = [".env", ".env.local", ".env.production.local"];
const assetDirectories: AssetDirectory[] = [
  {kind: "site-icon", directory: siteIconsDir, access: "public"},
  {kind: "cover", directory: releaseCoversDir, access: "public"},
  {kind: "exclusive-art", directory: exclusiveArtDir, access: "public"},
  {kind: "exclusive-track", directory: exclusiveTracksDir, access: "private"}
];

async function loadEnvFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex < 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional env files are expected to be missing in some workflows.
  }
}

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

async function listFiles(directory: string) {
  try {
    const entries = await fs.readdir(directory, {withFileTypes: true});

    return entries
      .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function uploadDirectory({access, directory, kind}: AssetDirectory) {
  const files = await listFiles(directory);
  let uploaded = 0;

  for (const fileName of files) {
    const data = await fs.readFile(path.join(directory, fileName));

    await put(getBlobPath(kind, fileName), data, {
      access,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: getContentType(fileName)
    });

    uploaded += 1;
  }

  return {
    kind,
    uploaded
  };
}

async function main() {
  for (const envFile of envFiles) {
    await loadEnvFile(path.join(process.cwd(), envFile));
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to upload assets.");
  }

  const results = [];

  for (const directory of assetDirectories) {
    results.push(await uploadDirectory(directory));
  }

  console.log(
    JSON.stringify(
      {
        message: "Local media assets uploaded to Vercel Blob.",
        results
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Blob asset upload failed.");
  process.exitCode = 1;
});
