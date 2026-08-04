import fs from "node:fs/promises";
import path from "node:path";

import {prisma} from "../lib/db/prisma";
import {revalidateRestoredReleaseAnnotations} from "../lib/server/revalidate-restored-annotations";

const snapshotPath =
  process.env.DB_SNAPSHOT_PATH ||
  path.join(process.cwd(), "storage", "production-data-snapshot.json");
const importAuth = process.env.IMPORT_AUTH === "1";

type SnapshotRecord = Record<string, unknown> & {id?: string};

type Snapshot = {
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
  releaseImportAliases?: SnapshotRecord[];
  analyticsImportRows?: SnapshotRecord[];
  mappingAuditEvents?: SnapshotRecord[];
  backupRuns?: SnapshotRecord[];
  shortLinks?: SnapshotRecord[];
  adImportBatches?: SnapshotRecord[];
  adCreativeReports?: SnapshotRecord[];
  adCreativeCopyLinks?: SnapshotRecord[];
  adCampaignLearnings?: SnapshotRecord[];
  promotionCampaigns?: SnapshotRecord[];
  campaignEvidence?: SnapshotRecord[];
  campaignActiveIntervals?: SnapshotRecord[];
  campaignTimelineEvents?: SnapshotRecord[];
  campaignAuditEvents?: SnapshotRecord[];
  commissionRequests?: SnapshotRecord[];
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
  releaseImportAlias: ["exportedReleaseDate", "confirmedAt", "revokedAt", "createdAt", "updatedAt"],
  analyticsImportRow: ["confirmedAt", "unmatchedAt", "createdAt", "updatedAt"],
  mappingAuditEvent: ["createdAt"],
  backupRun: ["startedAt", "finishedAt", "createdAt"],
  shortLink: ["createdAt", "updatedAt", "archivedAt", "pausedAt", "destinationUpdatedAt", "deletedAt"],
  adImportBatch: ["reportingStart", "reportingEnd", "exportedAt", "createdAt", "updatedAt"],
  adCreativeReport: ["reportingStart", "reportingEnd", "createdAt", "updatedAt"],
  adCreativeCopyLink: ["createdAt"],
  adCampaignLearning: ["createdAt", "updatedAt"],
  promotionCampaign: ["createdAt", "updatedAt", "archivedAt"],
  campaignEvidence: ["importedStartDate", "importedEndDate", "spendStartDate", "spendEndDate", "suggestedStartDate", "suggestedEndDate", "createdAt", "updatedAt"],
  campaignActiveInterval: ["activeStartDate", "activeEndDate", "confirmedAt", "rejectedAt", "createdAt", "updatedAt"],
  campaignTimelineEvent: ["eventDate", "revokedAt", "createdAt", "updatedAt"],
  campaignAuditEvent: ["createdAt"],
  commissionRequest: ["createdAt", "updatedAt"]
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

const compositeUniqueKeys: Record<string, string[]> = {
  releaseCategoryAssignment: ["categoryId", "releaseId"],
  releaseStreamingLink: ["releaseId", "platform"],
  playlistRelease: ["playlistId", "releaseId"],
  adCreativeCopyLink: ["adCreativeReportId", "copyEntryId"],
  releaseArtistCredit: ["releaseId", "artistProfileId", "role"],
  appearsOnArtistCredit: ["appearsOnId", "artistProfileId", "role"],
  breakingBarzEntryCategory: ["entryId", "categoryId"]
};

async function upsertMany(modelName: string, records: SnapshotRecord[] = []) {
  const delegate = (prisma as Record<string, any>)[modelName];
  const compositeFields = compositeUniqueKeys[modelName];
  let imported = 0;

  for (const record of records) {
    const data = hydrateDates(modelName, record);
    const {id, ...updateData} = data;

    // Build the where clause. Prisma upsert requires exactly ONE unique selector.
    // We prioritize the composite unique key (like categoryId_releaseId) if it exists,
    // as it is more reliable for syncing relationships than the internal ID.
    let where: Record<string, any>;
    
    if (compositeFields) {
      const compositeName = compositeFields.join("_");
      const compositeValue: Record<string, any> = {};
      for (const field of compositeFields) {
        compositeValue[field] = data[field];
      }
      where = { [compositeName]: compositeValue };
    } else {
      where = { id };
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
    if (typeof data.id !== "string") throw new Error(`${modelName} snapshot row is missing its immutable id.`);
    const existing = await delegate.findUnique({where: {id: data.id}, select: {id: true}});
    if (!existing) {
      await delegate.create({data});
      imported += 1;
    }
  }
  return imported;
}

async function restoreAnalyticsImports(records: SnapshotRecord[] = []) {
  const replacementLinks = records.map((record) => ({id: record.id, replacedByImportId: record.replacedByImportId}));
  const count = await upsertMany(
    "analyticsImport",
    records.map((record) => ({...record, uploadedById: null, withdrawnById: null, replacedByImportId: null}))
  );
  for (const link of replacementLinks) {
    if (typeof link.id === "string" && typeof link.replacedByImportId === "string") {
      await prisma.analyticsImport.update({where: {id: link.id}, data: {replacedByImportId: link.replacedByImportId}});
    }
  }
  return count;
}

async function main() {
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8")) as Snapshot;
  const counts: Record<string, number | string> = {};

  if (importAuth) {
    counts.adminUsers = await upsertMany("adminUser", snapshot.adminUsers);
  } else {
    counts.adminUsers = "skipped";
  }

  const publishedArtistVersions = (snapshot.artistProfiles ?? []).map((record) => ({
    id: record.id,
    publishedVersionId: record.publishedVersionId
  }));
  counts.artistProfiles = await upsertMany(
    "artistProfile",
    (snapshot.artistProfiles ?? []).map((record) => ({...record, publishedVersionId: null}))
  );
  counts.releases = await upsertMany("release", snapshot.releases);
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
  const aliasLinks = (snapshot.releaseImportAliases ?? []).map((record) => ({id: record.id, supersededByAliasId: record.supersededByAliasId}));
  counts.releaseImportAliases = await upsertMany(
    "releaseImportAlias",
    (snapshot.releaseImportAliases ?? []).map((record) => ({...record, confirmedById: null, revokedById: null, supersededByAliasId: null}))
  );
  for (const link of aliasLinks) {
    if (typeof link.id === "string" && typeof link.supersededByAliasId === "string") {
      await prisma.releaseImportAlias.update({where: {id: link.id}, data: {supersededByAliasId: link.supersededByAliasId}});
    }
  }
  counts.analyticsImportRows = await upsertMany(
    "analyticsImportRow",
    (snapshot.analyticsImportRows ?? []).map((record) => ({...record, confirmedById: null, unmatchedById: null}))
  );
  counts.mappingAuditEvents = await insertManyImmutable(
    "mappingAuditEvent",
    (snapshot.mappingAuditEvents ?? []).map((record) => ({...record, actorId: null}))
  );
  counts.artistMetricObservations = await insertManyImmutable(
    "artistMetricObservation",
    snapshot.artistMetricObservations
  );
  counts.trackMetricObservations = await insertManyImmutable(
    "trackMetricObservation",
    snapshot.trackMetricObservations
  );
  counts.songPeriodSnapshots = await insertManyImmutable(
    "songPeriodSnapshot",
    snapshot.songPeriodSnapshots
  );
  counts.playlistPeriodSnapshots = await insertManyImmutable(
    "playlistPeriodSnapshot",
    snapshot.playlistPeriodSnapshots
  );
  counts.releaseCategories = await upsertMany(
    "releaseCategory",
    snapshot.releaseCategories
  );
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
  counts.promotionCampaigns = await upsertMany(
    "promotionCampaign",
    (snapshot.promotionCampaigns ?? []).map((record) => ({...record, createdById: null, updatedById: null}))
  );
  counts.campaignEvidence = await upsertMany(
    "campaignEvidence",
    (snapshot.campaignEvidence ?? []).map((record) => ({...record, createdById: null}))
  );
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
  counts.commissionRequests = await upsertMany(
    "commissionRequest",
    snapshot.commissionRequests
  );

  console.log(
    JSON.stringify(
      {
        message: "Database snapshot imported.",
        snapshotPath,
        counts
      },
      null,
      2
    )
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Snapshot import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
