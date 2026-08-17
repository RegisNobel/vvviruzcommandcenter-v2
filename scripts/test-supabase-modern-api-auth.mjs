import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  authenticatedDataApiHeaders,
  privilegedDataApiHeaders,
  publicDataApiHeaders,
  requireAuthenticatedTestAccessToken,
  requireModernPublishableKey,
  requireModernSecretKey
} from "./lib/supabase-data-api-auth.mjs";

const root = process.cwd();
const publishableKey = "sb_publishable_modern_test_value";
const secretKey = "sb_secret_modern_test_value";
const nowSeconds = 2_000_000_000;

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({alg: "ES256", typ: "JWT"})}.${encode(payload)}.test-signature`;
}

function errorMessage(callback) {
  try {
    callback();
    assert.fail("Expected configuration validation to fail.");
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const userToken = jwt({aud: "authenticated", exp: nowSeconds + 300, role: "authenticated", sub: "test-user"});

assert.deepEqual(publicDataApiHeaders(publishableKey), {apikey: publishableKey});
assert.deepEqual(privilegedDataApiHeaders(secretKey), {apikey: secretKey});
assert.equal("Authorization" in publicDataApiHeaders(publishableKey), false);
assert.equal("Authorization" in privilegedDataApiHeaders(secretKey), false);
assert.deepEqual(authenticatedDataApiHeaders(publishableKey, userToken, {nowSeconds}), {
  apikey: publishableKey,
  Authorization: `Bearer ${userToken}`
});

assert.equal(requireModernPublishableKey({SUPABASE_PUBLISHABLE_KEY: publishableKey}), publishableKey);
assert.equal(requireModernPublishableKey({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey}), publishableKey);
assert.equal(requireModernSecretKey({SUPABASE_SECRET_KEY: secretKey}), secretKey);
assert.equal(requireAuthenticatedTestAccessToken({SUPABASE_TEST_AUTHENTICATED_JWT: userToken}, {nowSeconds}), userToken);

const validationErrors = [
  errorMessage(() => requireModernPublishableKey({})),
  errorMessage(() => requireModernSecretKey({})),
  errorMessage(() => requireModernSecretKey({SUPABASE_SERVICE_ROLE_KEY: "legacy-value"})),
  errorMessage(() => requireModernPublishableKey({SUPABASE_ANON_KEY: "legacy-value", NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-value"})),
  errorMessage(() => authenticatedDataApiHeaders(publishableKey, "malformed", {nowSeconds})),
  errorMessage(() => authenticatedDataApiHeaders(publishableKey, jwt({aud: "authenticated", exp: nowSeconds + 60, role: "authenticated"}).replace(/^.*?\./, `${Buffer.from(JSON.stringify({alg: "HS256"})).toString("base64url")}.`), {nowSeconds})),
  errorMessage(() => authenticatedDataApiHeaders(publishableKey, jwt({aud: "authenticated", exp: nowSeconds - 1, role: "authenticated"}), {nowSeconds})),
  errorMessage(() => authenticatedDataApiHeaders(publishableKey, jwt({aud: "authenticated", exp: nowSeconds + 60, role: "service_role"}), {nowSeconds}))
];
for (const message of validationErrors) {
  assert.equal(message.includes(publishableKey), false);
  assert.equal(message.includes(secretKey), false);
  assert.equal(message.includes("legacy-value"), false);
  assert.match(message, /Supabase|modern|authenticated|non-expired/i);
}

const [snapshotScript, promotionScript, denialScript] = await Promise.all([
  fs.readFile(path.join(root, "scripts/export-supabase-rest-snapshot.mjs"), "utf8"),
  fs.readFile(path.join(root, "scripts/promote-local-artist-profile.mjs"), "utf8"),
  fs.readFile(path.join(root, "scripts/test-gate-a2-data-api-denials.mjs"), "utf8")
]);

for (const source of [snapshotScript, promotionScript, denialScript]) {
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET/);
}
for (const source of [snapshotScript, promotionScript]) {
  assert.match(source, /requireModernSecretKey/);
  assert.match(source, /privilegedDataApiHeaders/);
  assert.doesNotMatch(source, /Authorization\s*:\s*`Bearer/);
}
assert.doesNotMatch(denialScript, /node:crypto|createHmac|HS256|authenticatedJwt/);
assert.match(denialScript, /requireModernPublishableKey/);
assert.match(denialScript, /requireModernSecretKey/);
assert.match(denialScript, /requireAuthenticatedTestAccessToken/);
assert.match(denialScript, /authenticatedDataApiHeaders/);

console.log("Modern Supabase API-key headers, authenticated-token boundary, fail-closed configuration, and migrated consumer sources passed.");
