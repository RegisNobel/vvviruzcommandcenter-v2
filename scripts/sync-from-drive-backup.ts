import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";

import {ensureDatabaseUrl} from "../lib/db/load-env";
import {decryptBackupArtifact} from "../lib/backups/encryption";

ensureDatabaseUrl();
console.log("Environment variables loaded from .env.local");

async function getAccessToken() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(`Google Drive OAuth credentials missing in environment. Found: ClientId=${!!clientId}, Secret=${!!clientSecret}, Token=${!!refreshToken}`);
  }

  console.log(`Attempting to refresh token for Client ID: ${clientId.slice(0, 10)}...`);
  console.log(`Using Refresh Token (masked): ${refreshToken.slice(0, 5)}...${refreshToken.slice(-5)} (Length: ${refreshToken.length})`);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Google Token Refresh Error Details:", JSON.stringify(data, null, 2));
    throw new Error(`Failed to refresh Google token: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

async function main() {
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_BACKUP_FOLDER_ID is required to locate backups.");
  }

  const accessToken = await getAccessToken();

  console.log("Listing files in Google Drive backup folder...");
  const query = `'${folderId}' in parents and trashed = false and name contains 'database_snapshot'`;
  const listResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=10&fields=files(id,name,createdTime)`,
    {
      headers: {Authorization: `Bearer ${accessToken}`}
    }
  );

  const listData = await listResponse.json();
  if (!listResponse.ok) {
    throw new Error(`Failed to list Drive files: ${listData.error?.message}`);
  }

  const files = listData.files || [];
  if (files.length === 0) {
    throw new Error("No database snapshots found in the Google Drive folder.");
  }

  const latest = files[0];
  console.log(`Latest backup found: ${latest.name} (${new Date(latest.createdTime).toLocaleString()})`);

  console.log("Downloading file content...");
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`,
    {
      headers: {Authorization: `Bearer ${accessToken}`}
    }
  );

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
  }

  const encryptedBuffer = Buffer.from(await downloadResponse.arrayBuffer());

  console.log("Decrypting...");
  const compressedBuffer = decryptBackupArtifact(encryptedBuffer);

  console.log("Decompressing (Gzip)...");
  const jsonBuffer = gunzipSync(compressedBuffer);

  const outputPath = path.join(process.cwd(), "storage", "production-data-snapshot.json");
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, jsonBuffer);

  console.log(`\nSuccess! Snapshot saved to: ${outputPath}`);
  console.log("You can now import this into your local database by running:");
  console.log("  npm run db:import:snapshot\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Google Drive sync failed.");
  process.exit(1);
});
