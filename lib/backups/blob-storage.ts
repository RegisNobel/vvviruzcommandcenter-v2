import "server-only";

import {randomUUID} from "node:crypto";

import {listPrivateObjects, storePrivateObject} from "@/lib/server/private-object-storage";

export type BackupArtifactType = "asset-manifest" | "database-snapshot";

function formatBackupTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function uploadBackupArtifactToBlob({
  buffer,
  fileStem,
  type
}: {
  buffer: Buffer;
  fileStem: string;
  type: BackupArtifactType;
}) {
  const fileName = `${fileStem}-${formatBackupTimestamp(new Date())}.json.gz.enc`;
  // Fail closed if inventory fails. Never grow this namespace without a capacity
  // check; Drive remains independent when the budget is reached.
  const current = await listPrivateObjects("database-backups");
  const limitBytes = 200 * 1024 * 1024;
  if (current.reduce((sum, item) => sum + item.sizeBytes, 0) + buffer.byteLength > limitBytes) {
    throw new Error("Blob backup budget reached (200 MiB). Keep the verified Google Drive copy and prune verified older Blob copies.");
  }
  const stored = await storePrivateObject({
    namespace: "database-backups",
    objectId: randomUUID(),
    data: buffer
  });

  return {
    pathname: stored.key,
    fileName,
    artifactType: type,
    checksumSha256: stored.checksumSha256,
    createdAt: stored.createdAt,
    sizeBytes: stored.sizeBytes
  };
}
