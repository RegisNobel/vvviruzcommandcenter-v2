import fs from "node:fs/promises";
import path from "node:path";

import {prisma} from "../lib/db/prisma";

const snapshotPath =
  process.env.DB_SNAPSHOT_PATH ||
  path.join(process.cwd(), "storage", "production-data-snapshot.json");
const importAuth = process.env.IMPORT_AUTH === "1";

type SnapshotRecord = Record<string, unknown> & {id: string};

type Snapshot = {
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
  commissionRequests?: SnapshotRecord[];
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
  adCampaignLearning: ["createdAt", "updatedAt"],
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
  adCreativeCopyLink: ["adCreativeReportId", "copyEntryId"]
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

async function main() {
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8")) as Snapshot;
  const counts: Record<string, number | string> = {};

  if (importAuth) {
    counts.adminUsers = await upsertMany("adminUser", snapshot.adminUsers);
  } else {
    counts.adminUsers = "skipped";
  }

  counts.releases = await upsertMany("release", snapshot.releases);
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
