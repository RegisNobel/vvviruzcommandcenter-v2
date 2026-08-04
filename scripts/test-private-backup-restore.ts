import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync, gzipSync} from "node:zlib";

import {
  checksumSha256,
  decryptBackupArtifact,
  encryptBackupArtifact
} from "../lib/backups/encryption";
import {
  deletePrivateObject,
  listPrivateObjects,
  readPrivateObject,
  storePrivateObject
} from "../lib/server/private-object-storage";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function main() {
  assert.equal(process.env.PRIVATE_STORAGE_DRIVER, "vercel-blob");
  assert.ok(process.env.PRIVATE_BLOB_READ_WRITE_TOKEN?.trim());
  const originalBackupSecret = process.env.BACKUP_ENCRYPTION_SECRET;
  const syntheticBackupSecret = randomBytes(48).toString("base64url");
  process.env.BACKUP_ENCRYPTION_SECRET = syntheticBackupSecret;

  const tempRoot = path.resolve(process.cwd(), ".codex-temp");
  await fs.mkdir(tempRoot, {recursive: true});
  const directory = await fs.mkdtemp(path.join(tempRoot, "gate-b-private-restore-"));
  const relativeDirectory = path.relative(process.cwd(), directory).replace(/\\/g, "/");
  const sourceDb = `../${relativeDirectory}/source.db`;
  const restoredDb = `../${relativeDirectory}/restored.db`;
  const sourceDbPath = path.join(directory, "source.db");
  const restoredDbPath = path.join(directory, "restored.db");
  const blankDbPath = path.join(directory, "blank.db");
  const sourceSnapshotPath = path.join(directory, "source-snapshot.json");
  const restoredSnapshotPath = path.join(directory, "restored-snapshot.json");
  const fingerprintPath = path.join(directory, "fingerprint.json");
  const baseEnv = {...process.env, ALLOW_DATABASE_URL_OVERRIDE: "1"};
  let backupKey: string | null = null;

  try {
    const localTemplate = path.resolve(process.cwd(), "storage", "vvviruz-command-center.db");
    await fs.access(localTemplate);
    await fs.copyFile(localTemplate, sourceDbPath);
    const sourceEnv = {
      ...baseEnv,
      DATABASE_URL: `file:${sourceDb}`,
      DIRECT_URL: `file:${sourceDb}`,
      DB_SNAPSHOT_PATH: sourceSnapshotPath,
      STAGE10_FINGERPRINT_PATH: fingerprintPath
    };
    run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.prisma", "--force-reset", "--skip-generate"], sourceEnv);
    await fs.copyFile(sourceDbPath, blankDbPath);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "seed"], sourceEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/gate-b-backup-fixture.ts", "seed"], sourceEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "fingerprint"], sourceEnv);
    run(process.execPath, ["--import", "tsx", "scripts/export-db-snapshot.ts"], sourceEnv);

    const sourceSnapshot = await fs.readFile(sourceSnapshotPath);
    const sourceJson = JSON.parse(sourceSnapshot.toString("utf8")) as Record<string, unknown>;
    assert.ok(Array.isArray(sourceJson.analyticsImports) && sourceJson.analyticsImports.length > 0);
    assert.ok(Array.isArray(sourceJson.breakingBarzEntries) && sourceJson.breakingBarzEntries.length > 0);

    const compressed = gzipSync(sourceSnapshot);
    const encrypted = encryptBackupArtifact(compressed);
    const envelope = JSON.parse(encrypted.toString("utf8")) as {
      algorithm: string;
      version: number;
    };
    assert.equal(envelope.algorithm, "aes-256-gcm");
    assert.equal(envelope.version, 1);
    assert.equal(encrypted.includes(Buffer.from("breakingBarzEntries")), false);
    const encryptedChecksum = checksumSha256(encrypted);

    const stored = await storePrivateObject({
      namespace: "database-backups",
      data: encrypted
    });
    backupKey = stored.key;
    assert.match(backupKey, /^database-backups\/[0-9a-f-]{36}\.json\.gz\.enc$/i);
    assert.equal(stored.checksumSha256, encryptedChecksum);

    const downloaded = await readPrivateObject("database-backups", backupKey, {
      expectedSha256: encryptedChecksum
    });
    assert.deepEqual(downloaded.buffer, encrypted);
    const decrypted = decryptBackupArtifact(downloaded.buffer);
    const restoredSnapshot = gunzipSync(decrypted);
    assert.deepEqual(restoredSnapshot, sourceSnapshot);
    await fs.writeFile(restoredSnapshotPath, restoredSnapshot);

    const corrupt = Buffer.from(downloaded.buffer);
    corrupt[corrupt.length - 1] ^= 1;
    assert.throws(() => decryptBackupArtifact(corrupt));
    process.env.BACKUP_ENCRYPTION_SECRET = randomBytes(48).toString("base64url");
    assert.throws(() => decryptBackupArtifact(downloaded.buffer));
    process.env.BACKUP_ENCRYPTION_SECRET = syntheticBackupSecret;

    const restoredEnv = {
      ...baseEnv,
      BACKUP_ENCRYPTION_SECRET: syntheticBackupSecret,
      DATABASE_URL: `file:${restoredDb}`,
      DIRECT_URL: `file:${restoredDb}`,
      DB_SNAPSHOT_PATH: restoredSnapshotPath,
      STAGE10_FINGERPRINT_PATH: fingerprintPath
    };
    await fs.copyFile(blankDbPath, restoredDbPath);
    run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.prisma", "--force-reset", "--skip-generate"], restoredEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], restoredEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "verify"], restoredEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/gate-b-backup-fixture.ts", "verify"], restoredEnv);

    const afterRestore = await listPrivateObjects("database-backups");
    assert.ok(afterRestore.some((item) => item.storedPath === backupKey));
    assert.equal(JSON.stringify(afterRestore).includes(syntheticBackupSecret), false);

    console.log(JSON.stringify({
      objectIdentifier: backupKey,
      sizeBytes: encrypted.byteLength,
      encryptionVersion: envelope.version,
      checksumSha256: encryptedChecksum,
      creationTime: stored.createdAt.toISOString(),
      encryptedBeforeUpload: true,
      privateRetrievalIntegrity: true,
      analyticsAndBreakingBarzRestore: "passed",
      corruptCiphertextRejected: true,
      wrongSecretRejected: true,
      retainedAfterRestoreUntilExplicitCleanup: true
    }, null, 2));
  } finally {
    process.env.BACKUP_ENCRYPTION_SECRET = syntheticBackupSecret;
    if (backupKey) {
      await deletePrivateObject("database-backups", backupKey).catch(() => undefined);
    }
    await fs.rm(directory, {recursive: true, force: true});
    if (originalBackupSecret === undefined) delete process.env.BACKUP_ENCRYPTION_SECRET;
    else process.env.BACKUP_ENCRYPTION_SECRET = originalBackupSecret;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Private backup restore test failed.");
  process.exitCode = 1;
});
