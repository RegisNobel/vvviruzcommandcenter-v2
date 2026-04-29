import fs from "node:fs/promises";
import path from "node:path";

import {prisma} from "../lib/db/prisma";

const snapshotPath =
  process.env.DB_SNAPSHOT_PATH ||
  path.join(process.cwd(), "storage", "production-data-snapshot.json");

async function main() {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    adminUsers: await prisma.adminUser.findMany(),
    releases: await prisma.release.findMany(),
    releaseCategories: await prisma.releaseCategory.findMany(),
    releaseCategoryAssignments: await prisma.releaseCategoryAssignment.findMany(),
    releaseTasks: await prisma.releaseTask.findMany(),
    releaseStreamingLinks: await prisma.releaseStreamingLink.findMany(),
    lyricProjects: await prisma.lyricProject.findMany(),
    lyricLines: await prisma.lyricLine.findMany(),
    copyEntries: await prisma.copyEntry.findMany(),
    siteSettings: await prisma.siteSettings.findMany(),
    subscribers: await prisma.subscriber.findMany(),
    emailCampaigns: await prisma.emailCampaign.findMany(),
    emailSendLogs: await prisma.emailSendLog.findMany(),
    analyticsEvents: await prisma.analyticsEvent.findMany()
  };

  await fs.mkdir(path.dirname(snapshotPath), {recursive: true});
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

  console.log(
    JSON.stringify(
      {
        message: "Database snapshot exported.",
        snapshotPath,
        counts: Object.fromEntries(
          Object.entries(snapshot)
            .filter(([, value]) => Array.isArray(value))
            .map(([key, value]) => [key, value.length])
        )
      },
      null,
      2
    )
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Snapshot export failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
