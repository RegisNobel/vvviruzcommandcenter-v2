import "server-only";

import {put} from "@vercel/blob";

export type BackupArtifactType = "asset-manifest" | "database-snapshot";

function formatBackupTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function getBackupBlobPath(type: BackupArtifactType, fileName: string, date = new Date()) {
  const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
  const year = date.getUTCFullYear().toString();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${prefix}/backups/${type}/${year}/${month}/${day}/${fileName}`;
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
  const pathname = getBackupBlobPath(type, fileName);
  const blob = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/octet-stream"
  });

  return {
    pathname,
    url: blob.url
  };
}
