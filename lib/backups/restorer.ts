import "server-only";

import {gunzipSync} from "node:zlib";
import {createDecipheriv, createHash} from "node:crypto";

import {prisma} from "@/lib/db/prisma";

type EncryptedPayload = {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
};

type SnapshotRecord = Record<string, unknown> & {id: string};

type Snapshot = {
  exportedAt?: string;
  adminUsers?: SnapshotRecord[];
  releases?: SnapshotRecord[];
  releaseCategories?: SnapshotRecord[];
  releaseCategoryAssignments?: SnapshotRecord[];
  releaseTasks?: SnapshotRecord[];
  releaseStreamingLinks?: SnapshotRecord[];
  copyEntries?: SnapshotRecord[];
  siteSettings?: SnapshotRecord[];
  subscribers?: SnapshotRecord[];
  emailCampaigns?: SnapshotRecord[];
  emailSendLogs?: SnapshotRecord[];
  analyticsEvents?: SnapshotRecord[];
  backupRuns?: SnapshotRecord[];
  shortLinks?: SnapshotRecord[];
  adImportBatches?: SnapshotRecord[];
  adCreativeReports?: SnapshotRecord[];
  adCreativeCopyLinks?: SnapshotRecord[];
  adCampaignLearnings?: SnapshotRecord[];
};

const dateFieldsByModel: Record<string, string[]> = {
  adminUser: ["totpEnrolledAt", "createdAt", "updatedAt"],
  release: ["releaseDate", "createdOn", "updatedOn"],
  releaseCategory: ["createdAt", "updatedAt"],
  releaseCategoryAssignment: ["createdAt", "updatedAt"],
  releaseTask: ["createdAt", "updatedAt"],
  releaseStreamingLink: ["createdAt", "updatedAt"],
  copyEntry: ["createdOn", "updatedOn"],
  siteSettings: ["createdOn", "updatedOn"],
  subscriber: ["createdAt", "updatedAt", "unsubscribedAt"],
  emailCampaign: ["sentAt", "createdAt", "updatedAt"],
  emailSendLog: ["sentAt", "createdAt"],
  analyticsEvent: ["createdAt"],
  backupRun: ["startedAt", "finishedAt", "createdAt"],
  shortLink: ["createdAt", "updatedAt", "archivedAt", "pausedAt", "destinationUpdatedAt", "deletedAt"],
  adImportBatch: ["reportingStart", "reportingEnd", "exportedAt", "createdAt", "updatedAt"],
  adCreativeReport: ["reportingStart", "reportingEnd", "createdAt", "updatedAt"],
  adCreativeCopyLink: ["createdAt"],
  adCampaignLearning: ["createdAt", "updatedAt"]
};

const compositeUniqueKeys: Record<string, string[]> = {
  releaseCategoryAssignment: ["categoryId", "releaseId"],
  releaseStreamingLink: ["releaseId", "platform"],
  adCreativeCopyLink: ["adCreativeReportId", "copyEntryId"]
};

function hydrateDates(modelName: string, record: SnapshotRecord) {
  const hydrated: SnapshotRecord = {...record};

  for (const field of dateFieldsByModel[modelName] ?? []) {
    const value = hydrated[field];

    if (typeof value === "string" && value) {
      hydrated[field] = new Date(value);
    }
  }

  return hydrated;
}

async function upsertMany(modelName: string, records: SnapshotRecord[] = []) {
  const delegate = (prisma as Record<string, any>)[modelName];
  const compositeFields = compositeUniqueKeys[modelName];
  let imported = 0;

  for (const record of records) {
    const data = hydrateDates(modelName, record);
    const {id, ...updateData} = data;

    let where: Record<string, any>;

    if (compositeFields) {
      const compositeName = compositeFields.join("_");
      const compositeValue: Record<string, any> = {};
      for (const field of compositeFields) {
        compositeValue[field] = data[field];
      }
      where = {[compositeName]: compositeValue};
    } else {
      where = {id};
    }

    await delegate.upsert({
      where,
      create: data,
      update: updateData
    });
    imported += 1;
  }

  return imported;
}

function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("BACKUP_ENCRYPTION_SECRET must be at least 32 characters long.");
  }

  const key = createHash("sha256").update(secret, "utf8").digest();
  const payload = JSON.parse(encryptedBuffer.toString("utf8")) as EncryptedPayload;

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

async function getGoogleDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive OAuth credentials are not configured.");
  }

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
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to refresh Google token.");
  }

  return data.access_token;
}

export type DriveBackupFile = {
  id: string;
  name: string;
  createdTime: string;
};

export async function listDriveBackupSnapshots(): Promise<DriveBackupFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_BACKUP_FOLDER_ID is not configured.");
  }

  const accessToken = await getGoogleDriveAccessToken();
  const query = `'${folderId}' in parents and trashed = false and name contains 'db-snapshot'`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=10&fields=files(id,name,createdTime)`,
    {headers: {Authorization: `Bearer ${accessToken}`}}
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to list Drive backups.");
  }

  return data.files || [];
}

export type RestoreResult = {
  counts: Record<string, number | string>;
  duration: number;
  snapshotDate: string;
  status: "success" | "failed";
  error?: string;
};

export async function restoreFromGoogleDrive(fileId: string): Promise<RestoreResult> {
  const startTime = Date.now();

  // 1. Download the encrypted file from Google Drive
  const accessToken = await getGoogleDriveAccessToken();
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {headers: {Authorization: `Bearer ${accessToken}`}}
  );

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download backup: ${downloadResponse.statusText}`);
  }

  const encryptedBuffer = Buffer.from(await downloadResponse.arrayBuffer());

  // 2. Decrypt
  const compressedBuffer = decryptBuffer(encryptedBuffer);

  // 3. Decompress
  const jsonBuffer = gunzipSync(compressedBuffer);
  const snapshot = JSON.parse(jsonBuffer.toString("utf8")) as Snapshot;

  // 4. Import all tables in order (respecting foreign key relationships)
  const counts: Record<string, number | string> = {};

  // Skip admin users for security — don't overwrite current auth
  counts.adminUsers = "skipped (security)";

  counts.releases = await upsertMany("release", snapshot.releases);
  counts.releaseCategories = await upsertMany("releaseCategory", snapshot.releaseCategories);
  counts.releaseCategoryAssignments = await upsertMany(
    "releaseCategoryAssignment",
    snapshot.releaseCategoryAssignments
  );
  counts.releaseTasks = await upsertMany("releaseTask", snapshot.releaseTasks);
  counts.releaseStreamingLinks = await upsertMany(
    "releaseStreamingLink",
    snapshot.releaseStreamingLinks
  );
  counts.copyEntries = await upsertMany("copyEntry", snapshot.copyEntries);
  counts.siteSettings = await upsertMany("siteSettings", snapshot.siteSettings);
  counts.subscribers = await upsertMany("subscriber", snapshot.subscribers);
  counts.emailCampaigns = await upsertMany("emailCampaign", snapshot.emailCampaigns);
  counts.emailSendLogs = await upsertMany("emailSendLog", snapshot.emailSendLogs);
  counts.analyticsEvents = await upsertMany("analyticsEvent", snapshot.analyticsEvents);
  counts.backupRuns = await upsertMany("backupRun", snapshot.backupRuns);
  counts.shortLinks = await upsertMany("shortLink", snapshot.shortLinks);
  counts.adImportBatches = await upsertMany("adImportBatch", snapshot.adImportBatches);
  counts.adCreativeReports = await upsertMany("adCreativeReport", snapshot.adCreativeReports);
  counts.adCreativeCopyLinks = await upsertMany(
    "adCreativeCopyLink",
    snapshot.adCreativeCopyLinks
  );
  counts.adCampaignLearnings = await upsertMany(
    "adCampaignLearning",
    snapshot.adCampaignLearnings
  );

  return {
    counts,
    duration: Date.now() - startTime,
    snapshotDate: snapshot.exportedAt || "Unknown",
    status: "success"
  };
}
