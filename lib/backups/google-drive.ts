import "server-only";

import {createSign, randomUUID} from "node:crypto";

type GoogleDriveUploadResult =
  | {
      enabled: false;
      reason: string;
    }
  | {
      enabled: true;
      fileId: string;
      folderId: string;
      webViewLink: string;
    };

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function readGoogleDriveConfig() {
  const enabled = process.env.GOOGLE_DRIVE_BACKUP_ENABLED === "1";
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() || "";
  const privateKey = (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim() || "";

  if (!enabled) {
    return {enabled: false as const, reason: "Google Drive backups are disabled."};
  }

  if (!clientEmail || !privateKey || !folderId) {
    return {
      enabled: false as const,
      reason:
        "Google Drive backups need GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_BACKUP_FOLDER_ID."
    };
  }

  return {
    enabled: true as const,
    clientEmail,
    privateKey,
    folderId
  };
}

async function getGoogleAccessToken(config: {
  clientEmail: string;
  privateKey: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({alg: "RS256", typ: "JWT"}));
  const claim = base64UrlEncode(
    JSON.stringify({
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
      iss: config.clientEmail,
      scope: GOOGLE_DRIVE_SCOPE
    })
  );
  const unsignedToken = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(config.privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    })
  });
  const payload = (await response.json()) as {access_token?: string; error_description?: string};

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Unable to authenticate with Google Drive.");
  }

  return payload.access_token;
}

export async function uploadBackupArtifactToGoogleDrive({
  buffer,
  fileName
}: {
  buffer: Buffer;
  fileName: string;
}): Promise<GoogleDriveUploadResult> {
  const config = readGoogleDriveConfig();

  if (!config.enabled) {
    return config;
  }

  const accessToken = await getGoogleAccessToken(config);
  const boundary = `vvviruz-${randomUUID()}`;
  const metadata = {
    mimeType: "application/gzip",
    name: fileName,
    parents: [config.folderId]
  };
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
      "utf8"
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`, "utf8")
  ]);
  const response = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }
  );
  const payload = (await response.json()) as {
    error?: {message?: string};
    id?: string;
    webViewLink?: string;
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || "Unable to upload backup to Google Drive.");
  }

  return {
    enabled: true,
    fileId: payload.id,
    folderId: config.folderId,
    webViewLink: payload.webViewLink || ""
  };
}
