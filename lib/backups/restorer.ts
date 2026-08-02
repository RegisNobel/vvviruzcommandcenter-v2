import "server-only";

import {gunzipSync} from "node:zlib";
import {createDecipheriv, createHash} from "node:crypto";

import {prisma} from "@/lib/db/prisma";
import {revalidateRestoredReleaseAnnotations} from "@/lib/server/revalidate-restored-annotations";

type EncryptedPayload = {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
};

type SnapshotRecord = Record<string, unknown> & {id?: string};

type Snapshot = {
  exportedAt?: string;
  adminUsers?: SnapshotRecord[];
  releases?: SnapshotRecord[];
  artistProfiles?: SnapshotRecord[];
  artistIntakes?: SnapshotRecord[];
  artistProfileVersions?: SnapshotRecord[];
  artistProfileApprovals?: SnapshotRecord[];
  artistLinks?: SnapshotRecord[];
  artistProfileMedia?: SnapshotRecord[];
  artistFeaturedItems?: SnapshotRecord[];
  releaseArtistCredits?: SnapshotRecord[];
  appearsOnArtistCredits?: SnapshotRecord[];
  releaseCategories?: SnapshotRecord[];
  releaseCategoryAssignments?: SnapshotRecord[];
  releaseTasks?: SnapshotRecord[];
  releaseStreamingLinks?: SnapshotRecord[];
  playlists?: SnapshotRecord[];
  playlistReleases?: SnapshotRecord[];
  releaseAnnotations?: SnapshotRecord[];
  releaseAnnotationSources?: SnapshotRecord[];
  breakingBarzEntries?: SnapshotRecord[];
  breakingBarzVersions?: SnapshotRecord[];
  breakingBarzVersionSources?: SnapshotRecord[];
  breakingBarzCategories?: SnapshotRecord[];
  breakingBarzEntryCategories?: SnapshotRecord[];
  breakingBarzSubmissions?: SnapshotRecord[];
  fanUpdates?: SnapshotRecord[];
  vaultItems?: SnapshotRecord[];
  appearsOn?: SnapshotRecord[];
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
  artistProfile: ["draftUpdatedAt", "publishedAt", "pausedAt", "archivedAt", "createdAt", "updatedAt"],
  artistIntake: [
    "expiresAt",
    "submittedAt",
    "lastOpenedAt",
    "reviewedAt",
    "convertedAt",
    "archivedAt",
    "submissionNotificationAttemptedAt",
    "createdAt",
    "updatedAt"
  ],
  artistProfileVersion: [
    "createdAt",
    "approvedAt",
    "publishedAt",
    "previewExpiresAt",
    "previewRevokedAt",
    "previewSupersededAt"
  ],
  artistProfileApproval: ["decidedAt", "createdAt"],
  artistLink: ["createdAt", "updatedAt"],
  artistProfileMedia: ["rightsConfirmedAt", "createdAt", "updatedAt"],
  artistFeaturedItem: ["createdAt", "updatedAt"],
  releaseArtistCredit: ["createdAt", "updatedAt"],
  appearsOnArtistCredit: ["createdAt", "updatedAt"],
  releaseCategory: ["projectReleaseDate", "createdAt", "updatedAt"],
  releaseCategoryAssignment: ["createdAt", "updatedAt"],
  releaseTask: ["createdAt", "updatedAt"],
  releaseStreamingLink: ["createdAt", "updatedAt"],
  playlist: ["createdAt", "updatedAt"],
  playlistRelease: ["createdAt", "updatedAt"],
  releaseAnnotation: ["lastReviewedAt", "createdAt", "updatedAt"],
  releaseAnnotationSource: ["createdAt", "updatedAt"],
  breakingBarzEntry: ["publishedAt", "archivedAt", "withdrawnAt", "createdAt", "updatedAt"],
  breakingBarzVersion: ["createdAt", "publishedAt"],
  breakingBarzVersionSource: ["createdAt"],
  breakingBarzCategory: ["createdAt", "updatedAt"],
  breakingBarzSubmission: ["submittedAt", "reviewedAt"],
  fanUpdate: ["publishedAt", "createdAt", "updatedAt"],
  vaultItem: ["publishedAt", "createdAt", "updatedAt"],
  appearsOn: ["releaseDate", "archivedAt", "createdAt", "updatedAt"],
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
  playlistRelease: ["playlistId", "releaseId"],
  adCreativeCopyLink: ["adCreativeReportId", "copyEntryId"],
  releaseArtistCredit: ["releaseId", "artistProfileId", "role"],
  appearsOnArtistCredit: ["appearsOnId", "artistProfileId", "role"],
  breakingBarzEntryCategory: ["entryId", "categoryId"]
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
  const publishedArtistVersions = (snapshot.artistProfiles ?? []).map((record) => ({
    id: record.id,
    publishedVersionId: record.publishedVersionId
  }));
  counts.artistProfiles = await upsertMany(
    "artistProfile",
    (snapshot.artistProfiles ?? []).map((record) => ({...record, publishedVersionId: null}))
  );
  counts.artistIntakes = await upsertMany("artistIntake", snapshot.artistIntakes);
  counts.artistProfileVersions = await upsertMany("artistProfileVersion", snapshot.artistProfileVersions);
  counts.artistProfileApprovals = await upsertMany("artistProfileApproval", snapshot.artistProfileApprovals);
  counts.artistLinks = await upsertMany("artistLink", snapshot.artistLinks);
  counts.artistProfileMedia = await upsertMany("artistProfileMedia", snapshot.artistProfileMedia);
  counts.artistFeaturedItems = await upsertMany("artistFeaturedItem", snapshot.artistFeaturedItems);
  for (const record of publishedArtistVersions) {
    if (typeof record.id === "string" && typeof record.publishedVersionId === "string") {
      await prisma.artistProfile.update({
        where: {id: record.id},
        data: {publishedVersionId: record.publishedVersionId}
      });
    }
  }
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
  counts.playlists = await upsertMany("playlist", snapshot.playlists);
  counts.playlistReleases = await upsertMany("playlistRelease", snapshot.playlistReleases);
  counts.releaseAnnotations = await upsertMany("releaseAnnotation", snapshot.releaseAnnotations);
  counts.releaseAnnotationSources = await upsertMany("releaseAnnotationSource", snapshot.releaseAnnotationSources);
  const publishedBreakingBarzVersions = (snapshot.breakingBarzEntries ?? []).map((record) => ({
    id: record.id,
    currentPublishedVersionId: record.currentPublishedVersionId
  }));
  counts.breakingBarzCategories = await upsertMany("breakingBarzCategory", snapshot.breakingBarzCategories);
  counts.breakingBarzEntries = await upsertMany(
    "breakingBarzEntry",
    (snapshot.breakingBarzEntries ?? []).map((record) => ({...record, currentPublishedVersionId: null}))
  );
  counts.breakingBarzVersions = await upsertMany("breakingBarzVersion", snapshot.breakingBarzVersions);
  counts.breakingBarzVersionSources = await upsertMany("breakingBarzVersionSource", snapshot.breakingBarzVersionSources);
  counts.breakingBarzEntryCategories = await upsertMany("breakingBarzEntryCategory", snapshot.breakingBarzEntryCategories);
  counts.breakingBarzSubmissions = await upsertMany("breakingBarzSubmission", snapshot.breakingBarzSubmissions);
  for (const record of publishedBreakingBarzVersions) {
    if (typeof record.id === "string" && typeof record.currentPublishedVersionId === "string") {
      await prisma.breakingBarzEntry.update({
        where: {id: record.id},
        data: {currentPublishedVersionId: record.currentPublishedVersionId}
      });
    }
  }
  const annotationValidation = await revalidateRestoredReleaseAnnotations(prisma);
  counts.releaseAnnotationsValid = annotationValidation.valid;
  counts.releaseAnnotationsNeedingReanchoring = annotationValidation.needsReanchoring;
  counts.fanUpdates = await upsertMany("fanUpdate", snapshot.fanUpdates);
  counts.vaultItems = await upsertMany("vaultItem", snapshot.vaultItems);
  counts.appearsOn = await upsertMany("appearsOn", snapshot.appearsOn);
  counts.releaseArtistCredits = await upsertMany("releaseArtistCredit", snapshot.releaseArtistCredits);
  counts.appearsOnArtistCredits = await upsertMany("appearsOnArtistCredit", snapshot.appearsOnArtistCredits);
  counts.copyEntries = await upsertMany("copyEntry", snapshot.copyEntries);
  counts.siteSettings = await upsertMany("siteSettings", snapshot.siteSettings);
  counts.subscribers = await upsertMany("subscriber", snapshot.subscribers);
  counts.emailCampaigns = await upsertMany("emailCampaign", snapshot.emailCampaigns);
  counts.emailSendLogs = await upsertMany("emailSendLog", snapshot.emailSendLogs);
  counts.shortLinks = await upsertMany("shortLink", snapshot.shortLinks);
  counts.analyticsEvents = await upsertMany("analyticsEvent", snapshot.analyticsEvents);
  counts.backupRuns = await upsertMany("backupRun", snapshot.backupRuns);
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
