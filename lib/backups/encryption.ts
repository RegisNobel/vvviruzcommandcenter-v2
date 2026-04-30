import "server-only";

import {createCipheriv, createHash, randomBytes} from "node:crypto";

type EncryptedBackupPayload = {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
};

function getBackupEncryptionKey() {
  const secret = process.env.BACKUP_ENCRYPTION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("BACKUP_ENCRYPTION_SECRET must be at least 32 characters long.");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function checksumSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function encryptBackupArtifact(buffer: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getBackupEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const payload: EncryptedBackupPayload = {
    algorithm: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    version: 1
  };

  return Buffer.from(JSON.stringify(payload), "utf8");
}
