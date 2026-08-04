import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";

import {ensureDatabaseUrl} from "../lib/db/load-env";
import {decryptBackupArtifact} from "../lib/backups/encryption";
import {listPrivateObjects, readPrivateObject} from "../lib/server/private-object-storage";

ensureDatabaseUrl();

async function main() {
  if (!process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("PRIVATE_BLOB_READ_WRITE_TOKEN is required to fetch private Blob backups.");
  }
  process.env.PRIVATE_STORAGE_DRIVER = "vercel-blob";

  console.log("Listing opaque private backup objects...");
  const candidates = (await listPrivateObjects("database-backups"))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 20);
  let latest: {objectId: string; jsonBuffer: Buffer; uploadedAt: Date} | null = null;
  for (const candidate of candidates) {
    const encrypted = await readPrivateObject("database-backups", candidate.storedPath);
    const jsonBuffer = gunzipSync(decryptBackupArtifact(encrypted.buffer));
    const parsed = JSON.parse(jsonBuffer.toString("utf8")) as Record<string, unknown>;
    if (Array.isArray(parsed.releases) && Array.isArray(parsed.breakingBarzEntries)) {
      latest = {objectId: candidate.id, jsonBuffer, uploadedAt: candidate.updatedAt};
      break;
    }
  }
  if (!latest) throw new Error("No restorable database snapshot was found among recent private backup objects.");
  console.log(`Latest database snapshot found: ${latest.objectId} (${latest.uploadedAt.toLocaleString()})`);

  const outputPath = path.join(process.cwd(), "storage", "production-data-snapshot.json");
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, latest.jsonBuffer);

  console.log(`\nSuccess! Snapshot saved to: ${outputPath}`);
  console.log("You can now import this into your local database by running:");
  console.log("  npm run db:import:snapshot\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Sync failed.");
  process.exit(1);
});
