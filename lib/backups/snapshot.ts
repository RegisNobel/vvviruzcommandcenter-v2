import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";

import {prisma} from "@/lib/db/prisma";
import {getAssetStorageDriver, getBlobPath, type StoredAssetKind} from "@/lib/server/asset-storage";
import {
  exclusiveArtDir,
  exclusiveTracksDir,
  releaseCoversDir,
  siteIconsDir
} from "@/lib/server/storage";

type SnapshotArtifact = {
  buffer: Buffer;
  checksumSha256: string;
  recordCounts: Record<string, number>;
  sizeBytes: number;
};

type LocalAssetDirectory = {
  directory: string;
  kind: StoredAssetKind;
};

const localAssetDirectories: LocalAssetDirectory[] = [
  {kind: "site-icon", directory: siteIconsDir},
  {kind: "cover", directory: releaseCoversDir},
  {kind: "exclusive-art", directory: exclusiveArtDir},
  {kind: "exclusive-track", directory: exclusiveTracksDir}
];

function toGzipJsonArtifact(value: unknown, recordCounts: Record<string, number>): SnapshotArtifact {
  const buffer = gzipSync(Buffer.from(JSON.stringify(value, null, 2), "utf8"), {
    level: 9
  });

  return {
    buffer,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    recordCounts,
    sizeBytes: buffer.byteLength
  };
}

function countSnapshotTables(snapshot: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, (value as unknown[]).length])
  );
}

export async function createDatabaseSnapshotArtifact() {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    adminUsers: await prisma.adminUser.findMany(),
    releases: await prisma.release.findMany(),
    releaseCategories: await prisma.releaseCategory.findMany(),
    releaseCategoryAssignments: await prisma.releaseCategoryAssignment.findMany(),
    releaseTasks: await prisma.releaseTask.findMany(),
    releaseStreamingLinks: await prisma.releaseStreamingLink.findMany(),
    lyricProjects: await prisma.lyricProject.findMany(),
    lyricLines: await prisma.lyricLine.findMany(),
    copyEntries: await prisma.copyEntry.findMany(),
    siteSettings: await prisma.siteSettings.findMany(),
    subscribers: await prisma.subscriber.findMany(),
    emailCampaigns: await prisma.emailCampaign.findMany(),
    emailSendLogs: await prisma.emailSendLog.findMany(),
    analyticsEvents: await prisma.analyticsEvent.findMany(),
    backupRuns: await prisma.backupRun.findMany(),
    adImportBatches: await prisma.adImportBatch.findMany(),
    adCreativeReports: await prisma.adCreativeReport.findMany(),
    adCreativeCopyLinks: await prisma.adCreativeCopyLink.findMany(),
    adCampaignLearnings: await prisma.adCampaignLearning.findMany()
  };

  return toGzipJsonArtifact(snapshot, countSnapshotTables(snapshot));
}

async function listLocalAssets() {
  const assets = [];

  for (const {directory, kind} of localAssetDirectories) {
    let files: string[] = [];

    try {
      files = await fs.readdir(directory);
    } catch {
      files = [];
    }

    for (const fileName of files.filter((file) => file !== ".gitkeep").sort()) {
      const filePath = path.join(directory, fileName);
      const stat = await fs.stat(filePath);

      if (!stat.isFile()) {
        continue;
      }

      assets.push({
        driver: "local",
        kind,
        pathname: fileName,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }
  }

  return assets;
}

async function listBlobAssets() {
  const {list} = await import("@vercel/blob");
  const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
  const assets = [];
  let cursor: string | undefined;

  do {
    const result = await list({
      cursor,
      limit: 1000,
      prefix: `${prefix}/`
    });

    for (const blob of result.blobs) {
      if (blob.pathname.startsWith(`${prefix}/backups/`)) {
        continue;
      }

      assets.push({
        driver: "vercel-blob",
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt).toISOString(),
        url: blob.url
      });
    }

    cursor = result.cursor;
  } while (cursor);

  return assets;
}

export async function createAssetManifestArtifact() {
  const driver = getAssetStorageDriver();
  const assets = driver === "vercel-blob" ? await listBlobAssets() : await listLocalAssets();
  const manifest = {
    exportedAt: new Date().toISOString(),
    driver,
    expectedBlobPrefix:
      process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz",
    assetPathExamples: localAssetDirectories.map(({kind}) => ({
      kind,
      examplePath: getBlobPath(kind, "example-file.ext")
    })),
    assets
  };

  return toGzipJsonArtifact(manifest, {
    assets: assets.length
  });
}
