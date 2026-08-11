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
  analyticsImports?: SnapshotRecord[];
  artistMetricObservations?: SnapshotRecord[];
  trackMetricObservations?: SnapshotRecord[];
  songPeriodSnapshots?: SnapshotRecord[];
  playlistPeriodSnapshots?: SnapshotRecord[];
  analyticsImportRows?: SnapshotRecord[];
  releaseImportAliases?: SnapshotRecord[];
  mappingAuditEvents?: SnapshotRecord[];
  backupRuns?: SnapshotRecord[];
  shortLinks?: SnapshotRecord[];
  adImportBatches?: SnapshotRecord[];
  adCreativeReports?: SnapshotRecord[];
  adCreativeCopyLinks?: SnapshotRecord[];
  adCampaignLearnings?: SnapshotRecord[];
  metaImportFiles?: SnapshotRecord[];
  metaImportFileRows?: SnapshotRecord[];
  metaDailySourceObservations?: SnapshotRecord[];
  metaDailyResolutions?: SnapshotRecord[];
  metaDailyResolutionEvents?: SnapshotRecord[];
  metaImportAuditEvents?: SnapshotRecord[];
  metaPromotionLinks?: SnapshotRecord[];
  metaPromotionLinkAuditEvents?: SnapshotRecord[];
  metaAccountTimezoneResolutions?: SnapshotRecord[];
  promotionCampaigns?: SnapshotRecord[];
  campaignEvidence?: SnapshotRecord[];
  campaignActiveIntervals?: SnapshotRecord[];
  campaignTimelineEvents?: SnapshotRecord[];
  campaignAuditEvents?: SnapshotRecord[];
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
  analyticsImport: [
    "uploadedAt", "detectedPeriodStart", "detectedPeriodEnd", "userConfirmedPeriodStart",
    "userConfirmedPeriodEnd", "rawFileExpiresAt", "rawFileDeletedAt", "acceptedAt",
    "withdrawnAt", "createdAt", "updatedAt"
  ],
  artistMetricObservation: ["metricDate", "createdAt"],
  trackMetricObservation: ["metricDate", "createdAt"],
  songPeriodSnapshot: ["periodStart", "periodEnd", "exportedReleaseDate", "createdAt"],
  playlistPeriodSnapshot: ["periodStart", "periodEnd", "dateAdded", "createdAt"],
  analyticsImportRow: ["confirmedAt", "unmatchedAt", "createdAt", "updatedAt"],
  releaseImportAlias: ["exportedReleaseDate", "confirmedAt", "revokedAt", "createdAt", "updatedAt"],
  mappingAuditEvent: ["createdAt"],
  backupRun: ["startedAt", "finishedAt", "createdAt"],
  shortLink: ["createdAt", "updatedAt", "archivedAt", "pausedAt", "destinationUpdatedAt", "deletedAt"],
  adImportBatch: ["reportingStart", "reportingEnd", "exportedAt", "sourceAsOf", "acceptedAt", "withdrawnAt", "createdAt", "updatedAt"],
  adCreativeReport: ["reportingStart", "reportingEnd", "createdAt", "updatedAt"],
  adCreativeCopyLink: ["createdAt"],
  adCampaignLearning: ["createdAt", "updatedAt"],
  metaImportFile: ["reportingStart", "reportingEnd", "rawExpiresAt", "rawDeletedAt", "createdAt"],
  metaImportFileRow: ["createdAt"],
  metaDailySourceObservation: ["metricDate", "sourceAsOf", "acceptedAt", "createdAt"],
  metaDailyResolution: ["metricDate", "resolvedAt"],
  metaDailyResolutionEvent: ["createdAt"],
  metaAccountTimezoneResolution: ["confirmedAt", "createdAt"],
  metaImportAuditEvent: ["createdAt"],
  metaPromotionLink: ["createdAt", "updatedAt"],
  metaPromotionLinkAuditEvent: ["createdAt"],
  promotionCampaign: ["createdAt", "updatedAt", "archivedAt"],
  campaignEvidence: ["importedStartDate", "importedEndDate", "spendStartDate", "spendEndDate", "suggestedStartDate", "suggestedEndDate", "createdAt", "updatedAt"],
  campaignActiveInterval: ["activeStartDate", "activeEndDate", "confirmedAt", "rejectedAt", "createdAt", "updatedAt"],
  campaignTimelineEvent: ["eventDate", "revokedAt", "createdAt", "updatedAt"],
  campaignAuditEvent: ["createdAt"]
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

async function insertManyImmutable(modelName: string, records: SnapshotRecord[] = []) {
  const delegate = (prisma as Record<string, any>)[modelName];
  let imported = 0;

  for (const record of records) {
    const data = hydrateDates(modelName, record);
    if (typeof data.id !== "string") throw new Error(`${modelName} backup row is missing its immutable id.`);
    const existing = await delegate.findUnique({where: {id: data.id}, select: {id: true}});
    if (!existing) {
      await delegate.create({data});
      imported += 1;
    }
  }

  return imported;
}

async function restoreAnalyticsImports(records: SnapshotRecord[] = []) {
  const replacementLinks = records.map((record) => ({
    id: record.id,
    replacedByImportId: record.replacedByImportId
  }));
  const count = await upsertMany(
    "analyticsImport",
    records.map((record) => ({
      ...record,
      uploadedById: null,
      withdrawnById: null,
      replacedByImportId: null
    }))
  );

  for (const link of replacementLinks) {
    if (typeof link.id === "string" && typeof link.replacedByImportId === "string") {
      await prisma.analyticsImport.update({
        where: {id: link.id},
        data: {replacedByImportId: link.replacedByImportId}
      });
    }
  }
  return count;
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
  counts.analyticsImports = await restoreAnalyticsImports(snapshot.analyticsImports);
  counts.artistMetricObservations = await insertManyImmutable(
    "artistMetricObservation",
    snapshot.artistMetricObservations
  );
  counts.trackMetricObservations = await insertManyImmutable(
    "trackMetricObservation",
    snapshot.trackMetricObservations
  );
  const aliasSupersession = (snapshot.releaseImportAliases ?? []).map((record) => ({id: record.id, supersededByAliasId: record.supersededByAliasId}));
  counts.releaseImportAliases = await upsertMany("releaseImportAlias", (snapshot.releaseImportAliases ?? []).map((record) => ({...record, confirmedById: null, revokedById: null, supersededByAliasId: null})));
  for (const link of aliasSupersession) {
    if (typeof link.id === "string" && typeof link.supersededByAliasId === "string") await prisma.releaseImportAlias.update({where: {id: link.id}, data: {supersededByAliasId: link.supersededByAliasId}});
  }
  counts.analyticsImportRows = await upsertMany("analyticsImportRow", (snapshot.analyticsImportRows ?? []).map((record) => ({...record, confirmedById: null, unmatchedById: null})));
  counts.songPeriodSnapshots = await insertManyImmutable(
    "songPeriodSnapshot",
    snapshot.songPeriodSnapshots
  );
  counts.playlistPeriodSnapshots = await insertManyImmutable(
    "playlistPeriodSnapshot",
    snapshot.playlistPeriodSnapshots
  );
  counts.mappingAuditEvents = await insertManyImmutable("mappingAuditEvent", (snapshot.mappingAuditEvents ?? []).map((record) => ({...record, actorId: null})));
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
  const metaBatchReplacements = (snapshot.adImportBatches ?? []).map((record) => ({id: record.id, replacesBatchId: record.replacesBatchId}));
  counts.adImportBatches = await upsertMany("adImportBatch", (snapshot.adImportBatches ?? []).map((record) => ({...record, acceptedById: null, withdrawnById: null, replacesBatchId: null})));
  counts.adCreativeReports = await upsertMany("adCreativeReport", snapshot.adCreativeReports);
  counts.adCreativeCopyLinks = await upsertMany(
    "adCreativeCopyLink",
    snapshot.adCreativeCopyLinks
  );
  counts.adCampaignLearnings = await upsertMany(
    "adCampaignLearning",
    snapshot.adCampaignLearnings
  );
  counts.metaImportFiles = await upsertMany("metaImportFile", snapshot.metaImportFiles);
  counts.metaImportFileRows = await insertManyImmutable("metaImportFileRow", snapshot.metaImportFileRows);
  counts.metaDailySourceObservations = await insertManyImmutable("metaDailySourceObservation", snapshot.metaDailySourceObservations);
  counts.metaDailyResolutions = await upsertMany("metaDailyResolution", snapshot.metaDailyResolutions);
  counts.metaDailyResolutionEvents = await insertManyImmutable("metaDailyResolutionEvent", snapshot.metaDailyResolutionEvents);
  counts.metaImportAuditEvents = await insertManyImmutable("metaImportAuditEvent", (snapshot.metaImportAuditEvents ?? []).map((record) => ({...record, actorId: null})));
  for (const link of metaBatchReplacements) if (typeof link.id === "string" && typeof link.replacesBatchId === "string") await prisma.adImportBatch.update({where: {id: link.id}, data: {replacesBatchId: link.replacesBatchId}});
  counts.promotionCampaigns = await upsertMany(
    "promotionCampaign",
    (snapshot.promotionCampaigns ?? []).map((record) => ({...record, createdById: null, updatedById: null}))
  );
  const metaLinkSupersessions = (snapshot.metaPromotionLinks ?? []).map((record) => ({id: record.id, supersedesLinkId: record.supersedesLinkId}));
  counts.metaPromotionLinks = await upsertMany("metaPromotionLink", (snapshot.metaPromotionLinks ?? []).map((record) => ({...record, actorId: null, supersedesLinkId: null})));
  for (const link of metaLinkSupersessions) if (typeof link.id === "string" && typeof link.supersedesLinkId === "string") await prisma.metaPromotionLink.update({where: {id: link.id}, data: {supersedesLinkId: link.supersedesLinkId}});
  counts.metaPromotionLinkAuditEvents = await insertManyImmutable("metaPromotionLinkAuditEvent", (snapshot.metaPromotionLinkAuditEvents ?? []).map((record) => ({...record, actorId: null})));
  const metaTimezoneSupersessions = (snapshot.metaAccountTimezoneResolutions ?? []).map((record) => ({id: record.id, supersedesResolutionId: record.supersedesResolutionId}));
  counts.metaAccountTimezoneResolutions = await upsertMany("metaAccountTimezoneResolution", (snapshot.metaAccountTimezoneResolutions ?? []).map((record) => ({...record, confirmedById: null, supersedesResolutionId: null})));
  for (const link of metaTimezoneSupersessions) if (typeof link.id === "string" && typeof link.supersedesResolutionId === "string") await prisma.metaAccountTimezoneResolution.update({where: {id: link.id}, data: {supersedesResolutionId: link.supersedesResolutionId}});
  const evidenceSupersessions = (snapshot.campaignEvidence ?? []).map((record) => ({id: record.id, supersededByEvidenceId: record.supersededByEvidenceId}));
  counts.campaignEvidence = await upsertMany(
    "campaignEvidence",
    (snapshot.campaignEvidence ?? []).map((record) => ({...record, createdById: null, supersededByEvidenceId: null}))
  );
  for (const link of evidenceSupersessions) if (typeof link.id === "string" && typeof link.supersededByEvidenceId === "string") await prisma.campaignEvidence.update({where: {id: link.id}, data: {supersededByEvidenceId: link.supersededByEvidenceId}});
  const intervalLinks = (snapshot.campaignActiveIntervals ?? []).map((record) => ({id: record.id, supersedesIntervalId: record.supersedesIntervalId}));
  counts.campaignActiveIntervals = await upsertMany(
    "campaignActiveInterval",
    (snapshot.campaignActiveIntervals ?? []).map((record) => ({...record, supersedesIntervalId: null, createdById: null, updatedById: null, confirmedById: null, rejectedById: null}))
  );
  for (const link of intervalLinks) {
    if (typeof link.id === "string" && typeof link.supersedesIntervalId === "string") await prisma.campaignActiveInterval.update({where: {id: link.id}, data: {supersedesIntervalId: link.supersedesIntervalId}});
  }
  const eventLinks = (snapshot.campaignTimelineEvents ?? []).map((record) => ({id: record.id, supersedesEventId: record.supersedesEventId}));
  counts.campaignTimelineEvents = await upsertMany(
    "campaignTimelineEvent",
    (snapshot.campaignTimelineEvents ?? []).map((record) => ({...record, supersedesEventId: null, createdById: null, updatedById: null}))
  );
  for (const link of eventLinks) {
    if (typeof link.id === "string" && typeof link.supersedesEventId === "string") await prisma.campaignTimelineEvent.update({where: {id: link.id}, data: {supersedesEventId: link.supersedesEventId}});
  }
  counts.campaignAuditEvents = await insertManyImmutable(
    "campaignAuditEvent",
    (snapshot.campaignAuditEvents ?? []).map((record) => ({...record, actorId: null}))
  );

  return {
    counts,
    duration: Date.now() - startTime,
    snapshotDate: snapshot.exportedAt || "Unknown",
    status: "success"
  };
}
