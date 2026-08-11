import {gunzipSync} from "node:zlib";

import {checksumSha256, decryptBackupArtifact} from "@/lib/backups/encryption";

export function verifyAndDecodeBackup(encrypted: Buffer, expectedSha256: string) {
  if (checksumSha256(encrypted) !== expectedSha256) {
    throw new Error("Encrypted backup integrity check failed.");
  }

  let compressed: Buffer;
  try {
    compressed = decryptBackupArtifact(encrypted);
  } catch {
    throw new Error("Encrypted backup authentication failed.");
  }

  try {
    const snapshot = gunzipSync(compressed);
    JSON.parse(snapshot.toString("utf8"));
    return snapshot;
  } catch {
    throw new Error("Decrypted backup payload is invalid.");
  } finally {
    compressed.fill(0);
  }
}
