// One-off operator tool. Runs inside an explicitly requested production build;
// never prints credentials, snapshot contents, or personal records.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";
import {prisma} from "../lib/db/prisma";
import {verifyGoogleDriveBackupCopy} from "../lib/backups/google-drive";
import {decryptBackupArtifact} from "../lib/backups/encryption";
import {selectBackupPruneCandidates} from "../lib/backups/retention-policy";
import {deletePrivateObject, listPrivateObjects} from "../lib/server/private-object-storage";
import {list, del} from "@vercel/blob";

async function main() {
  assert.equal(process.env.RUN_BACKUP_STORAGE_REPAIR, "1");
  assert.equal(process.env.VERCEL_ENV, "production");
  const directory = process.env.BACKUP_REPAIR_DIRECTORY!;
  assert.ok(directory && path.isAbsolute(directory));
  const runs = await prisma.backupRun.findMany({where: {status: "success"}, orderBy: {startedAt: "desc"}});
  if (process.argv[2] === "prepare") {
    const run = runs.find(r => r.type === "database_snapshot" && r.googleDriveFileId && r.sizeBytes && r.checksumSha256);
    assert.ok(run, "No recorded Drive database backup is available.");
    const copy = await verifyGoogleDriveBackupCopy({fileId: run.googleDriveFileId!, sizeBytes: run.sizeBytes!, checksumSha256: run.checksumSha256!});
    const snapshot = gunzipSync(decryptBackupArtifact(copy.buffer));
    await fs.writeFile(path.join(directory, "snapshot.json"), snapshot, {mode: 0o600});
    await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({runId: run.id, sha256: run.checksumSha256, sizeBytes: run.sizeBytes, recordCounts: JSON.parse(run.recordCounts)}), {mode: 0o600});
    console.log(JSON.stringify({backupRepair: "verified-offsite-copy", runId: run.id, sha256: run.checksumSha256, bytes: run.sizeBytes}));
    return;
  }
  assert.equal(process.argv[2], "cleanup");
  assert.equal(await fs.readFile(path.join(directory, "restore-passed"), "utf8"), "verified");
  const publicPrefix = `${process.env.BLOB_PREFIX?.trim() || "vvviruz"}/backups/`;
  const publicObjects: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const page = await list({prefix: publicPrefix, cursor, token: process.env.BLOB_READ_WRITE_TOKEN});
    publicObjects.push(...page.blobs); cursor = page.cursor;
  } while (cursor);
  const privateObjects = await listPrivateObjects("database-backups");
  let deleted = 0, blocked = 0, freedBytes = 0;
  for (const run of selectBackupPruneCandidates(runs.filter(r => Boolean(r.blobPath)))) {
    const privateObject = privateObjects.find(o => o.storedPath === run.blobPath);
    const publicObject = publicObjects.find(o => o.pathname === run.blobPath);
    if (!privateObject && !publicObject) continue;
    const bytes = privateObject?.sizeBytes ?? publicObject!.size;
    try {
      assert.equal(bytes, run.sizeBytes);
      const {document} = await verifyGoogleDriveBackupCopy({fileId: run.googleDriveFileId!, sizeBytes: run.sizeBytes!, checksumSha256: run.checksumSha256!});
      const counts = JSON.parse(run.recordCounts) as Record<string, number>;
      assert.ok(Object.keys(counts).length);
      for (const [table, count] of Object.entries(counts)) assert.equal((document[table] as unknown[])?.length, count);
      if (privateObject) await deletePrivateObject("database-backups", run.blobPath);
      else {
        assert.ok(publicObject!.pathname.startsWith(publicPrefix));
        assert.ok(/\/(database-snapshot|asset-manifest)\/\d{4}\/\d{2}\/\d{2}\/[\w.-]+\.json\.gz\.enc$/.test(publicObject!.pathname));
        await del(publicObject!.pathname, {token: process.env.BLOB_READ_WRITE_TOKEN});
      }
      await prisma.backupRun.update({where: {id: run.id}, data: {blobPath: "", destination: "google_drive"}});
      deleted++; freedBytes += bytes;
      console.log(JSON.stringify({backupRepair: "removed-verified-duplicate", runId: run.id, sha256: run.checksumSha256, bytes}));
    } catch {
      blocked++;
      console.log(JSON.stringify({backupRepair: "copy-kept-verification-or-removal-failed", runId: run.id}));
    }
  }
  console.log(JSON.stringify({backupRepair: "cleanup-summary", deleted, blocked, freedBytes}));
}
void main().catch(() => {console.error("Backup storage repair stopped safely; see the last completed phase."); process.exitCode = 1;}).finally(() => prisma.$disconnect());
