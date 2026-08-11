import assert from "node:assert/strict";
import {createHash} from "node:crypto";

import {
  BackupRetrievalError,
  readNormalizedGoogleDriveOAuthCredentials,
  retrievePinnedEncryptedGoogleDriveBackup
} from "../lib/backups/google-drive-retrieval";

const fileId = "pinned-file";
const artifact = Buffer.from("approved encrypted fixture", "utf8");
const expectedSha256 = createHash("sha256").update(artifact).digest("hex");
const credentials = {clientId: "client", clientSecret: "secret", refreshToken: "refresh"};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {"content-type": "application/json"}
});
const binary = (value: Buffer, headers: Record<string, string> = {}) => new Response(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer, {
  status: 200,
  headers: {"content-type": "application/octet-stream", ...headers}
});
const oauthSuccess = () => json({access_token: "access"});
const metadataSuccess = (overrides: Record<string, unknown> = {}) => json({
  id: fileId,
  size: String(artifact.length),
  trashed: false,
  mimeType: "application/octet-stream",
  ...overrides
});

function sequenceFetch(items: Array<Response | Error | ((url: string, init?: RequestInit) => Response | Promise<Response>)>) {
  let index = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const item = items[index++];
    if (!item) throw new Error("Unexpected fetch call.");
    if (item instanceof Error) throw item;
    return typeof item === "function" ? await item(String(url), init) : item;
  }) as typeof fetch;
}

async function retrieve(fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof retrievePinnedEncryptedGoogleDriveBackup>[0]> = {}) {
  return retrievePinnedEncryptedGoogleDriveBackup({
    credentials,
    expectedFileId: fileId,
    expectedSha256,
    expectedSize: artifact.length,
    fetchImpl,
    timeoutMs: 25,
    ...overrides
  });
}

async function expectFailure(
  fetchImpl: typeof fetch,
  code: string,
  phase: string,
  overrides: Partial<Parameters<typeof retrievePinnedEncryptedGoogleDriveBackup>[0]> = {}
) {
  await assert.rejects(() => retrieve(fetchImpl, overrides), (error: unknown) => {
    assert.ok(error instanceof BackupRetrievalError);
    assert.equal(error.code, code);
    assert.equal(error.phase, phase);
    assert.doesNotMatch(error.message, /client|secret|refresh|access/);
    return true;
  });
}

async function main() {
const normalized = readNormalizedGoogleDriveOAuthCredentials({
  GOOGLE_DRIVE_OAUTH_CLIENT_ID: " client\r\n",
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: " secret ",
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "refresh\n"
});
assert.deepEqual(normalized.credentials, credentials);
assert.deepEqual(normalized.normalization, {
  bomPresent: {clientId: false, clientSecret: false, refreshToken: false},
  outerQuotesPresent: {clientId: false, clientSecret: false, refreshToken: false},
  outerWhitespaceRemoved: {clientId: true, clientSecret: true, refreshToken: true}
});
assert.throws(() => readNormalizedGoogleDriveOAuthCredentials({}), (error: unknown) => error instanceof BackupRetrievalError && error.code === "BACKUP_CONFIGURATION_INVALID");

const phases: string[] = [];
let downloadRedirect = "";
const success = await retrieve(sequenceFetch([
  (url, init) => {
    assert.match(url, /oauth2\.googleapis\.com\/token/);
    assert.equal(init?.method, "POST");
    assert.ok(init?.body instanceof URLSearchParams);
    assert.deepEqual(Object.fromEntries(init.body.entries()), {client_id: "client", client_secret: "secret", refresh_token: "refresh", grant_type: "refresh_token"});
    return oauthSuccess();
  },
  (url) => { assert.match(url, /fields=id%2Csize%2Ctrashed%2CmimeType|fields=id,size,trashed,mimeType/); return metadataSuccess(); },
  (_url, init) => { downloadRedirect = String(init?.redirect); return binary(artifact, {"content-length": String(artifact.length)}); }
]), {onPhase: (phase) => phases.push(phase)});
assert.deepEqual(success, artifact);
assert.equal(downloadRedirect, "follow");
assert.deepEqual(phases, ["oauth-refresh", "drive-metadata", "drive-download-open", "encrypted-stream", "encrypted-size", "encrypted-sha256"]);

await expectFailure(sequenceFetch([json({error: "invalid_grant"}, 400)]), "GOOGLE_OAUTH_REFRESH_REJECTED", "oauth-refresh");
await expectFailure(sequenceFetch([json({error: "unauthorized_client"}, 401)]), "GOOGLE_OAUTH_REFRESH_REJECTED", "oauth-refresh");
await expectFailure(sequenceFetch([new Response("not-json", {status: 200})]), "GOOGLE_OAUTH_RESPONSE_INVALID", "oauth-refresh");
await expectFailure(sequenceFetch([json({token_type: "Bearer"})]), "GOOGLE_OAUTH_ACCESS_TOKEN_MISSING", "oauth-refresh");
await expectFailure(sequenceFetch([new TypeError("network")]), "BACKUP_NETWORK_FAILURE", "oauth-refresh");
await expectFailure((async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch, "BACKUP_NETWORK_TIMEOUT", "oauth-refresh", {timeoutMs: 5});

for (const [status, code] of [[401, "GOOGLE_DRIVE_AUTHENTICATION_REJECTED"], [403, "GOOGLE_DRIVE_ACCESS_DENIED"], [404, "GOOGLE_DRIVE_FILE_NOT_FOUND"]] as const) {
  await expectFailure(sequenceFetch([oauthSuccess(), json({}, status)]), code, "drive-metadata");
  await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), json({}, status)]), code, "drive-download-open");
}
await expectFailure(sequenceFetch([oauthSuccess(), new Response("bad-json", {status: 200})]), "GOOGLE_DRIVE_METADATA_FAILED", "drive-metadata");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess({id: "wrong"})]), "GOOGLE_DRIVE_FILE_ID_MISMATCH", "drive-metadata");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess({trashed: true})]), "GOOGLE_DRIVE_FILE_TRASHED", "drive-metadata");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess({mimeType: "application/vnd.google-apps.folder"})]), "GOOGLE_DRIVE_OBJECT_NOT_FILE", "drive-metadata");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess({size: String(artifact.length + 1)})]), "BACKUP_ENCRYPTED_SIZE_MISMATCH", "encrypted-size");

await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), new Response("<html>login</html>", {status: 200, headers: {"content-type": "text/html"}})]), "GOOGLE_DRIVE_DOWNLOAD_INVALID_CONTENT", "drive-download-open");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), binary(artifact.subarray(0, -1))]), "BACKUP_ENCRYPTED_SIZE_MISMATCH", "encrypted-size");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), binary(Buffer.alloc(artifact.length, 1))]), "BACKUP_ENCRYPTED_HASH_MISMATCH", "encrypted-sha256");
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), new Response(null, {status: 200})]), "GOOGLE_DRIVE_DOWNLOAD_FAILED", "encrypted-stream");

const interrupted = new ReadableStream<Uint8Array>({
  start(controller) { controller.enqueue(new Uint8Array([1])); controller.error(new Error("interrupted")); }
});
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), new Response(interrupted, {status: 200})]), "GOOGLE_DRIVE_STREAM_INTERRUPTED", "encrypted-stream");
const stalled = new ReadableStream<Uint8Array>({start() {}});
await expectFailure(sequenceFetch([oauthSuccess(), metadataSuccess(), new Response(stalled, {status: 200})]), "BACKUP_NETWORK_TIMEOUT", "encrypted-stream", {timeoutMs: 5});

console.log(JSON.stringify({suite: "google-drive-backup-retrieval", cases: 26, credentialsPrinted: false, productionCredentialsUsed: false}));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Google Drive retrieval tests failed.");
  process.exit(1);
});
