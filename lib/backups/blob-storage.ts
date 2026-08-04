import "server-only";

import {randomUUID} from "node:crypto";

import {storePrivateObject} from "@/lib/server/private-object-storage";

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
