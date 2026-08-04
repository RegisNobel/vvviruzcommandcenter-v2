import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import fs from "node:fs/promises";

import {prisma} from "../lib/db/prisma";
import {readRetentionDashboard, type RetentionDashboardProfile} from "../lib/analytics/retention-dashboard";
import {datesInclusive} from "../lib/analytics/retention-calculations";
import {CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";

const run = randomUUID();
const importId = `stage10-profile-import-${run}`;
const releaseIds = Array.from({length: 20}, (_, index) => `stage10-profile-release-${index}-${run}`);
const campaignIds = Array.from({length: 20}, (_, index) => `stage10-profile-campaign-${index}-${run}`);
const now = new Date("2050-01-01T00:00:00.000Z");

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function cleanup() {
  const staleCampaigns = await prisma.promotionCampaign.findMany({where: {id: {startsWith: "stage10-profile-campaign-"}}, select: {id: true}});
  const staleCampaignIds = staleCampaigns.map(({id}) => id);
  const staleImports = await prisma.analyticsImport.findMany({where: {id: {startsWith: "stage10-profile-import-"}}, select: {id: true}});
  const staleImportIds = staleImports.map(({id}) => id);
  await prisma.campaignTimelineEvent.deleteMany({where: {campaignId: {in: staleCampaignIds}}});
  await prisma.campaignActiveInterval.deleteMany({where: {campaignId: {in: staleCampaignIds}}});
  await prisma.campaignEvidence.deleteMany({where: {campaignId: {in: staleCampaignIds}}});
  await prisma.campaignAuditEvent.deleteMany({where: {campaignId: {in: staleCampaignIds}}});
  await prisma.promotionCampaign.deleteMany({where: {id: {in: staleCampaignIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: staleImportIds}}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: staleImportIds}}});
  await prisma.release.deleteMany({where: {id: {startsWith: "stage10-profile-release-"}}});
}

async function seed() {
  await prisma.analyticsImport.create({data: {
    id: importId,
    importType: "ARTIST_AUDIENCE_TIMELINE",
    originalFilename: "profile-audience.csv",
    fileHash: createHash("sha256").update(importId).digest("hex"),
    artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
    uploadedAt: now,
    status: "IMPORTED",
    acceptedAt: now,
    reportingTimezone: "UTC",
    validationSummary: JSON.stringify({parserVersion: "stage10-profile", reconciliation: {entries: []}}),
    normalizationVersion: 1,
    createdAt: now,
    updatedAt: now
  }});
  const dates = datesInclusive("2047-01-01", "2049-12-31");
  await prisma.artistMetricObservation.createMany({data: dates.map((date, index) => ({
    id: `stage10-profile-observation-${index}-${run}`,
    importId,
    artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
    metricDate: day(date),
    listeners: 1000 + (index % 90),
    monthlyListeners: 18000 + index,
    monthlyActiveListeners: 7000 + index,
    streams: 2300 + index,
    playlistAdds: 20 + (index % 7),
    saves: 40 + (index % 9),
    followers: 5000 + index,
    createdAt: now
  }))});
  for (let index = 0; index < releaseIds.length; index += 1) {
    const releaseDate = new Date(Date.UTC(2047, 0, 1 + index * 45));
    const start = new Date(releaseDate.getTime() + 10 * 86_400_000);
    const end = new Date(start.getTime() + 10 * 86_400_000);
    await prisma.release.create({data: {
      id: releaseIds[index],
      title: `Stage 10 Profile ${index + 1}`,
      slug: `stage10-profile-${index}-${run}`,
      catalogScope: "VVVIRUZ",
      primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      releaseDate,
      createdOn: now,
      updatedOn: now
    }});
    await prisma.promotionCampaign.create({data: {
      id: campaignIds[index],
      artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      releaseId: releaseIds[index],
      platform: "META",
      name: `Stage 10 Profile Campaign ${index + 1}`,
      objective: "STREAMS",
      status: "ENDED",
      createdAt: now,
      updatedAt: now,
      activeIntervals: {create: {
        id: `stage10-profile-interval-${index}-${run}`,
        activeStartDate: start,
        activeEndDate: end,
        timezone: "America/New_York",
        sourceType: "MANUAL",
        confirmationStatus: "CONFIRMED",
        confirmedAt: now,
        createdAt: now,
        updatedAt: now
      }}
    }});
  }
}

async function profile(range: "180" | "365" | "1000", comparisonLimit: number) {
  let captured: RetentionDashboardProfile | null = null;
  await readRetentionDashboard(
    {releaseId: releaseIds[19], campaignId: campaignIds[19], range},
    {now, comparisonLimit, onProfile: (value) => { captured = value; }}
  );
  assert.ok(captured);
  return captured;
}

async function main() {
  try {
    await cleanup();
    await seed();
    await profile("180", 1);
    const comparisons: RetentionDashboardProfile[] = [];
    for (const count of [1, 5, 10, 20]) {
      const measured = await profile("180", count);
      comparisons.push(measured);
      console.log(JSON.stringify({kind: "comparison", measured}));
    }
    const ranges: RetentionDashboardProfile[] = [];
    for (const range of ["180", "365", "1000"] as const) {
      const measured = await profile(range, 1);
      ranges.push(measured);
      console.log(JSON.stringify({kind: "range", measured}));
    }
    const report = {measurementBoundary: "server adapter only; excludes HTTP, browser navigation, React hydration, chart paint, and accessible DOM paint", comparisons, ranges};
    if (process.env.RETENTION_PROFILE_OUTPUT_PATH) await fs.writeFile(process.env.RETENTION_PROFILE_OUTPUT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
