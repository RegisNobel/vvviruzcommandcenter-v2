import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/diagnose-google-drive-oauth-provenance.mjs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {scripts: Record<string, string>};

assert.match(source, /BACKUP_OAUTH_PROVENANCE_DIAGNOSTIC !== DIAGNOSTIC_GATE/);
assert.match(source, /BEGIN READ ONLY/);
assert.match(source, /verifyPinnedGoogleDriveBackupMetadata/);
assert.match(source, /backupRunId: "70e04de9-3ab8-459c-971b-c23cd404a04e"/);
assert.match(source, /sizeBytes: 5_975_016/);
assert.match(source, /fileDownloaded: false/);
assert.match(source, /credentialsPrinted: false/);
assert.match(source, /credentialsMoved: false/);
assert.ok(!source.includes("retrievePinnedEncryptedGoogleDriveBackup"));
assert.ok(!source.includes("verifyAndDecodeBackup"));
assert.ok(!source.includes("BACKUP_ENCRYPTION_SECRET"));
for (const name of ["GOOGLE_DRIVE_OAUTH_CLIENT_ID", "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET", "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN"]) {
  assert.ok(!new RegExp(`console\\.(?:log|error)\\([^\\n]*${name}`).test(source), `${name} must not be logged.`);
}
assert.match(packageJson.scripts["build:vercel"], /backup:oauth-provenance:maybe/);

console.log(JSON.stringify({suite: "google-drive-oauth-provenance-diagnostic", metadataOnly: true, readOnlyProduction: true, secretsPrinted: false, secretsMoved: false}));
