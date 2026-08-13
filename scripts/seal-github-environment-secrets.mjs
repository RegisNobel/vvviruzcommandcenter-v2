import assert from "node:assert/strict";

import sodium from "libsodium-wrappers";

const GATE = "BACKUP_GITHUB_ENVIRONMENT_SEALING";
const EXPECTED_KEY_BYTES = 32;
const SECRET_NAMES = Object.freeze([
  "BACKUP_ENCRYPTION_SECRET",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN"
]);

if (process.env.BACKUP_GITHUB_ENVIRONMENT_SEALING !== GATE) {
  console.log(JSON.stringify({gate: GATE, status: "disabled"}));
  process.exit(0);
}

await sodium.ready;

const keyId = process.env.GITHUB_ENVIRONMENT_KEY_ID?.trim();
const encodedPublicKey = process.env.GITHUB_ENVIRONMENT_PUBLIC_KEY?.trim();
assert.ok(keyId, "GitHub environment key ID is required.");
assert.ok(encodedPublicKey, "GitHub environment public key is required.");

const publicKey = sodium.from_base64(encodedPublicKey, sodium.base64_variants.ORIGINAL);
assert.equal(publicKey.length, EXPECTED_KEY_BYTES, "Unexpected GitHub environment public-key length.");

const sealed = SECRET_NAMES.map((name) => {
  const plaintext = process.env[name];
  assert.ok(plaintext, `Required trusted runtime secret ${name} is absent.`);
  const encrypted = sodium.crypto_box_seal(sodium.from_string(plaintext), publicKey);
  return {
    name,
    encrypted_value: sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL),
    key_id: keyId
  };
});

assert.equal(sealed.length, SECRET_NAMES.length);
assert.deepEqual(sealed.map(({name}) => name), SECRET_NAMES);
console.log(JSON.stringify({gate: GATE, status: "sealed", secrets: sealed}));
