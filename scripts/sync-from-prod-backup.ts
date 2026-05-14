import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";

import {list, get} from "@vercel/blob";

import {decryptBackupArtifact} from "../lib/backups/encryption";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to fetch backups from Vercel Blob.");
  }

  const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
  const backupFolder = `${prefix}/backups/`;

  console.log(`Listing backups in ${backupFolder}...`);
  const {blobs} = await list({
    prefix: backupFolder,
    limit: 100
  });

  const dbSnapshots = blobs
    .filter((b) => b.pathname.includes("database_snapshot"))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  if (dbSnapshots.length === 0) {
    throw new Error("No database snapshots found in Vercel Blob.");
  }

  const latest = dbSnapshots[0];
  console.log(`Latest backup found: ${latest.pathname} (${new Date(latest.uploadedAt).toLocaleString()})`);

  console.log("Downloading artifact...");
  const response = await fetch(latest.url);
  if (!response.ok) {
    throw new Error(`Failed to download backup: ${response.statusText}`);
  }

  const encryptedBuffer = Buffer.from(await response.arrayBuffer());

  console.log("Decrypting...");
  const compressedBuffer = decryptBackupArtifact(encryptedBuffer);

  console.log("Decompressing (Gzip)...");
  const jsonBuffer = gunzipSync(compressedBuffer);

  const outputPath = path.join(process.cwd(), "storage", "production-data-snapshot.json");
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, jsonBuffer);

  console.log(`\nSuccess! Snapshot saved to: ${outputPath}`);
  console.log("You can now import this into your local database by running:");
  console.log("  npm run db:import:snapshot\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Sync failed.");
  process.exit(1);
});
