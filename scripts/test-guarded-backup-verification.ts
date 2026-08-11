import assert from "node:assert/strict";
import {gzipSync} from "node:zlib";

import {verifyAndDecodeBackup} from "@/lib/backups/backup-verification-integrity";
import {checksumSha256, encryptBackupArtifact} from "@/lib/backups/encryption";
import {assertDisposableRestoreTarget} from "@/lib/backups/disposable-restore-guard";

const production = "postgresql://prod-user:secret@db.example.test:5432/postgres";
const disposable = "postgresql://postgres:secret@127.0.0.1:55432/backup_verify_test?schema=public";
let writeAttempts = 0;
const rejectionMessages: string[] = [];
const rejectBeforeWrite = (input: Parameters<typeof assertDisposableRestoreTarget>[0]) => {
  const error = assert.throws(() => {
    assertDisposableRestoreTarget(input);
    writeAttempts += 1;
  });
  rejectionMessages.push(String(error));
  assert.equal(writeAttempts, 0);
};

rejectBeforeWrite({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: production});
rejectBeforeWrite({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production]});
rejectBeforeWrite({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: "not-a-url"});
rejectBeforeWrite({allowRestore: "1", productionUrls: [production], targetUrl: disposable});
rejectBeforeWrite({targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: disposable});
rejectBeforeWrite({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: "postgresql://postgres:secret@127.0.0.1:55432/not_disposable"});
rejectBeforeWrite({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: "postgresql://postgres:secret@external.example.test:55432/backup_verify_test"});

const accepted = assertDisposableRestoreTarget({allowRestore: "1", targetKind: "DISPOSABLE", productionUrls: [production], targetUrl: disposable});
assert.equal(accepted.hostClass, "local-embedded-postgresql");
assert.equal(accepted.prefixVerified, true);

const originalSecret = process.env.BACKUP_ENCRYPTION_SECRET;
const correctSecret = "synthetic-guarded-backup-secret-0000000000000000000001";
const wrongSecret = "synthetic-wrong-backup-secret-00000000000000000000002";
const snapshot = Buffer.from(JSON.stringify({adImportBatches: [], marker: "safe-synthetic"}));
process.env.BACKUP_ENCRYPTION_SECRET = correctSecret;
const encrypted = encryptBackupArtifact(gzipSync(snapshot));
const expectedHash = checksumSha256(encrypted);
assert.throws(() => verifyAndDecodeBackup(encrypted, "0".repeat(64)), /integrity check failed/);
process.env.BACKUP_ENCRYPTION_SECRET = wrongSecret;
assert.throws(() => verifyAndDecodeBackup(encrypted, expectedHash), /authentication failed/);
process.env.BACKUP_ENCRYPTION_SECRET = correctSecret;
assert.deepEqual(verifyAndDecodeBackup(encrypted, expectedHash), snapshot);

const secretCorpus = [correctSecret, wrongSecret, production, disposable];
for (const value of secretCorpus) {
  assert.equal(JSON.stringify(accepted).includes(value), false);
  assert.equal(rejectionMessages.join("\n").includes(value), false);
}
if (originalSecret === undefined) delete process.env.BACKUP_ENCRYPTION_SECRET;
else process.env.BACKUP_ENCRYPTION_SECRET = originalSecret;

console.log(JSON.stringify({
  suite: "guarded-backup-verification",
  negativeCases: 9,
  positiveGuard: true,
  integrityBeforeDecrypt: true,
  authenticatedDecryption: true,
  secretLeakage: 0,
  sqlWritesBeforeGuard: writeAttempts
}));
