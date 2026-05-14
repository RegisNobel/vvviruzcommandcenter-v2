import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";
import {createDecipheriv, createHash} from "node:crypto";

// Load environment variables from .env.local
import {ensureDatabaseUrl} from "../lib/db/load-env";
ensureDatabaseUrl();

type EncryptedPayload = {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
};

function decrypt(buffer: Buffer): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("BACKUP_ENCRYPTION_SECRET must be at least 32 characters long.");
  }

  const key = createHash("sha256").update(secret, "utf8").digest();
  const payload = JSON.parse(buffer.toString("utf8")) as EncryptedPayload;

  if (payload.version !== 1 || payload.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported backup encryption format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final()
  ]);
}

async function main() {
  const inputArg = process.argv[2];
  const inputPath = inputArg
    ? path.resolve(inputArg)
    : path.join(process.cwd(), "storage", "latest-backup.json");

  console.log(`Reading encrypted backup from: ${inputPath}`);
  const encryptedBuffer = await fs.readFile(inputPath);

  console.log("Decrypting...");
  const compressedBuffer = decrypt(encryptedBuffer);

  console.log("Decompressing (Gzip)...");
  const jsonBuffer = gunzipSync(compressedBuffer);
  const snapshot = JSON.parse(jsonBuffer.toString("utf8"));

  // Detect if this is an asset manifest or a database snapshot
  const isAssetManifest = !!snapshot.assets && Array.isArray(snapshot.assets);
  const outputFileName = isAssetManifest ? "asset-manifest.json" : "production-data-snapshot.json";
  const outputPath = path.join(process.cwd(), "storage", outputFileName);

  await fs.writeFile(outputPath, jsonBuffer);

  const tables = Object.entries(snapshot)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `  ${k}: ${(v as unknown[]).length} records`);

  console.log(`\nSuccess! Snapshot saved to: ${outputPath}`);
  console.log(`Tables found:\n${tables.join("\n")}`);
  console.log("\nNext step: run  npm run db:import:snapshot");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Decrypt failed.");
  process.exit(1);
});
