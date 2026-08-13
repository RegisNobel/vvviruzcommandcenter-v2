import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

import sodium from "libsodium-wrappers";

async function main() {
await sodium.ready;

const keyPair = sodium.crypto_box_keypair();
const values = {
  BACKUP_ENCRYPTION_SECRET: "backup-test-value",
  GOOGLE_DRIVE_OAUTH_CLIENT_ID: "client-id-test-value",
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "client-secret-test-value",
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "refresh-token-test-value"
};
const run = spawnSync(process.execPath, ["scripts/seal-github-environment-secrets.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    BACKUP_GITHUB_ENVIRONMENT_SEALING: "BACKUP_GITHUB_ENVIRONMENT_SEALING",
    GITHUB_ENVIRONMENT_KEY_ID: "test-key-id",
    GITHUB_ENVIRONMENT_PUBLIC_KEY: sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL),
    ...values
  }
});

assert.equal(run.status, 0, run.stderr);
const output = JSON.parse(run.stdout.trim());
assert.equal(output.status, "sealed");
assert.equal(output.secrets.length, 4);
for (const secret of output.secrets) {
  assert.equal(secret.key_id, "test-key-id");
  assert.ok(Object.hasOwn(values, secret.name));
  const plaintext = sodium.crypto_box_seal_open(
    sodium.from_base64(secret.encrypted_value, sodium.base64_variants.ORIGINAL),
    keyPair.publicKey,
    keyPair.privateKey
  );
  assert.equal(sodium.to_string(plaintext), values[secret.name as keyof typeof values]);
}
assert.doesNotMatch(run.stdout, /backup-test-value|client-secret-test-value|refresh-token-test-value/);

console.log("GitHub environment secret sealing checks passed.");
}

void main();
