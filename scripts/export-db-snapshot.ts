import fs from "node:fs/promises";
import path from "node:path";

import {prisma} from "../lib/db/prisma";

const snapshotPath =
  process.env.DB_SNAPSHOT_PATH ||
  path.join(process.cwd(), "storage", "production-data-snapshot.json");

async function readOptionalTable<T>(
  label: string,
  read: () => Promise<T[]>
): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "P2021") {
      console.warn(
        `${label} is not present in the source database; exporting it as an empty collection.`
      );
      return [];
    }
    throw error;
  }
}

async function main() {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    adminUsers: await prisma.adminUser.findMany(),
    releases: await prisma.release.findMany(),
    artistProfiles: await readOptionalTable("ArtistProfile", () =>
      prisma.artistProfile.findMany()
    ),
    artistIntakes: await readOptionalTable("ArtistIntake", () =>
      prisma.artistIntake.findMany()
    ),
    artistProfileVersions: await readOptionalTable(
      "ArtistProfileVersion",
      () => prisma.artistProfileVersion.findMany()
    ),
    artistProfileApprovals: await readOptionalTable(
      "ArtistProfileApproval",
      () => prisma.artistProfileApproval.findMany()
    ),
    artistLinks: await readOptionalTable("ArtistLink", () =>
      prisma.artistLink.findMany()
    ),
    artistProfileMedia: await readOptionalTable("ArtistProfileMedia", () =>
      prisma.artistProfileMedia.findMany()
    ),
    artistFeaturedItems: await readOptionalTable(
      "ArtistFeaturedItem",
      () => prisma.artistFeaturedItem.findMany()
    ),
    releaseCategories: await prisma.releaseCategory.findMany(),
    releaseCategoryAssignments: await prisma.releaseCategoryAssignment.findMany(),
    releaseTasks: await prisma.releaseTask.findMany(),
    releaseStreamingLinks: await prisma.releaseStreamingLink.findMany(),
    playlists: await prisma.playlist.findMany(),
    playlistReleases: await prisma.playlistRelease.findMany(),
    releaseAnnotations: await prisma.releaseAnnotation.findMany(),
    releaseAnnotationSources: await prisma.releaseAnnotationSource.findMany(),
    breakingBarzEntries: await prisma.breakingBarzEntry.findMany(),
    breakingBarzVersions: await prisma.breakingBarzVersion.findMany(),
    breakingBarzVersionSources: await prisma.breakingBarzVersionSource.findMany(),
    breakingBarzCategories: await prisma.breakingBarzCategory.findMany(),
    breakingBarzEntryCategories: await prisma.breakingBarzEntryCategory.findMany(),
    breakingBarzSubmissions: await prisma.breakingBarzSubmission.findMany(),
    fanUpdates: await prisma.fanUpdate.findMany(),
    vaultItems: await prisma.vaultItem.findMany(),
    appearsOn: await prisma.appearsOn.findMany(),
    releaseArtistCredits: await prisma.releaseArtistCredit.findMany(),
    appearsOnArtistCredits: await prisma.appearsOnArtistCredit.findMany(),
    copyEntries: await prisma.copyEntry.findMany(),
    siteSettings: await prisma.siteSettings.findMany(),
    subscribers: await prisma.subscriber.findMany(),
    emailCampaigns: await prisma.emailCampaign.findMany(),
    emailSendLogs: await prisma.emailSendLog.findMany(),
    analyticsEvents: await prisma.analyticsEvent.findMany(),
    backupRuns: await prisma.backupRun.findMany(),
    shortLinks: await prisma.shortLink.findMany(),
    adImportBatches: await prisma.adImportBatch.findMany(),
    adCreativeReports: await prisma.adCreativeReport.findMany(),
    adCreativeCopyLinks: await prisma.adCreativeCopyLink.findMany(),
    adCampaignLearnings: await prisma.adCampaignLearning.findMany()
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
