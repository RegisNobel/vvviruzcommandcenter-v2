import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

import {prisma} from "../lib/db/prisma";
import {readRetentionDashboard} from "../lib/analytics/retention-dashboard";
import {datesInclusive} from "../lib/analytics/retention-calculations";
import {CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";

const run = randomUUID();
const now = new Date("2042-01-01T00:00:00.000Z");
const importIds = [`stage8-audience-${run}`, `stage8-track-${run}`, `stage8-mapping-${run}`, `stage8-audience-replacement-${run}`];
const releases = {
  valid: `stage8-valid-${run}`,
  open: `stage8-open-${run}`,
  future: `stage8-future-${run}`,
  overlap: `stage8-overlap-${run}`,
  overlapEvent: `stage8-overlap-event-${run}`,
  missing: `stage8-missing-${run}`,
  conflict: `stage8-conflict-${run}`,
  conflictOther: `stage8-conflict-other-${run}`,
  noCampaign: `stage8-no-campaign-${run}`
};
const campaigns = {
  valid: `stage8-campaign-valid-${run}`,
  second: `stage8-campaign-second-${run}`,
  open: `stage8-campaign-open-${run}`,
  future: `stage8-campaign-future-${run}`,
  overlap: `stage8-campaign-overlap-${run}`,
  missing: `stage8-campaign-missing-${run}`,
  conflict: `stage8-campaign-conflict-${run}`,
  suggested: `stage8-campaign-suggested-${run}`
};

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function cleanup() {
  const campaignIds = Object.values(campaigns);
  const releaseIds = Object.values(releases);
  await prisma.campaignAuditEvent.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.campaignTimelineEvent.deleteMany({where: {OR: [{campaignId: {in: campaignIds}}, {releaseId: {in: releaseIds}}]}});
  await prisma.campaignActiveInterval.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.campaignEvidence.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.promotionCampaign.deleteMany({where: {id: {in: campaignIds}}});
  await prisma.mappingAuditEvent.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImportRow.deleteMany({where: {importId: {in: importIds}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImport.updateMany({where: {id: {in: importIds}}, data: {replacedByImportId: null}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: {in: releaseIds}}});
}

async function createRelease(id: string, title: string, releaseDate: string) {
  await prisma.release.create({
    data: {
      id,
      title,
      slug: `${id}-slug`,
      catalogScope: "VVVIRUZ",
      primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      releaseDate: day(releaseDate),
      createdOn: now,
      updatedOn: now
    }
  });
}

async function createCampaign(id: string, releaseId: string, name: string, start: string, end: string | null) {
  await prisma.promotionCampaign.create({
    data: {
      id,
      artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      releaseId,
      platform: "META",
      name,
      objective: "STREAMS",
      status: end ? "ENDED" : "ACTIVE",
      createdAt: now,
      updatedAt: now,
      activeIntervals: {
        create: {
          id: `${id}-interval`,
          activeStartDate: day(start),
          activeEndDate: end ? day(end) : null,
          timezone: "America/New_York",
          sourceType: "MANUAL",
          confirmationStatus: "CONFIRMED",
          confirmedAt: now,
          createdAt: now,
          updatedAt: now
        }
      }
    }
  });
}

async function createImport(id: string, type: string) {
  await prisma.analyticsImport.create({
    data: {
      id,
      importType: type,
      originalFilename: `${id}.csv`,
      fileHash: hash(id),
      artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      uploadedAt: now,
      status: "IMPORTED",
      reportingTimezone: "UTC",
      validationSummary: JSON.stringify({parserVersion: "spotify-sfa-v1", reconciliation: {entries: []}}),
      normalizationVersion: 1,
      rawFileStorageDriver: "local",
      rawFileStorageKey: `private/${id}.csv`,
      rawFileExpiresAt: new Date("2042-01-31T00:00:00.000Z"),
      acceptedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
}

async function seed() {
  await Promise.all([
    createRelease(releases.valid, "Stage 8 Complete", "2040-01-01"),
    createRelease(releases.open, "Stage 8 Open", "2040-04-01"),
    createRelease(releases.future, "Stage 8 Future Floor", "2041-12-01"),
    createRelease(releases.overlap, "Stage 8 Overlap", "2040-05-01"),
    createRelease(releases.overlapEvent, "Stage 8 Other Release", "2040-06-10"),
    createRelease(releases.missing, "Stage 8 Missing", "2040-07-01"),
    createRelease(releases.conflict, "Stage 8 Mapping Conflict", "2040-09-01"),
    createRelease(releases.conflictOther, "Stage 8 Mapping Other", "2040-11-01"),
    createRelease(releases.noCampaign, "Stage 8 No Campaign", "2040-10-01")
  ]);
  await Promise.all([
    createCampaign(campaigns.valid, releases.valid, "Complete campaign", "2040-01-10", "2040-01-20"),
    createCampaign(campaigns.second, releases.valid, "Second campaign", "2040-03-01", "2040-03-10"),
    createCampaign(campaigns.open, releases.open, "Open campaign", "2040-04-10", null),
    createCampaign(campaigns.future, releases.future, "Future floor campaign", "2041-12-10", "2041-12-25"),
    createCampaign(campaigns.overlap, releases.overlap, "Overlap campaign", "2040-05-10", "2040-05-20"),
    createCampaign(campaigns.missing, releases.missing, "Missing-date campaign", "2040-07-10", "2040-07-20"),
    createCampaign(campaigns.conflict, releases.conflict, "Mapping-conflict campaign", "2040-09-10", "2040-09-20")
  ]);
  await createImport(importIds[0], "ARTIST_AUDIENCE_TIMELINE");
  await createImport(importIds[1], "TRACK_STREAM_TIMELINE");
  await createImport(importIds[2], "SONGS_PERIOD");
  const missingDate = "2040-07-12";
  const audienceDates = datesInclusive("2039-12-01", "2041-12-31").filter((date) => date !== missingDate);
  await prisma.artistMetricObservation.createMany({
    data: audienceDates.map((date, index) => ({
      id: `stage8-audience-${run}-${index}`,
      importId: importIds[0],
      artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
      metricDate: day(date),
      listeners: 1000 + Math.round(Math.sin(index / 8) * 50) + (date >= "2040-01-10" && date <= "2040-01-20" ? 400 : 0),
      monthlyListeners: 18000 + index,
      monthlyActiveListeners: 7200 + Math.floor(index / 2),
      streams: 2400 + index,
      playlistAdds: 30 + (index % 5),
      saves: 60 + (index % 7),
      followers: 5000 + index,
      createdAt: now
    }))
  });
  const trackDates = datesInclusive("2040-01-01", "2040-03-31");
  await prisma.trackMetricObservation.createMany({
    data: trackDates.map((date, index) => ({
      id: `stage8-track-${run}-${index}`,
      importId: importIds[1],
      releaseId: releases.valid,
      spotifyTrackId: "stage8-track-safe",
      metricDate: day(date),
      streams: Math.max(100, 2000 - index * 10),
      createdAt: now
    }))
  });
  await prisma.analyticsImportRow.createMany({
    data: [
      {
        id: `stage8-map-a-${run}`,
        importId: importIds[2],
        sourceRowNumber: 2,
        exportType: "SONGS_PERIOD",
        rowIdentityKey: `stage8-conflict-identity-${run}`,
        originalValues: "{}",
        safeDisplayValues: "{}",
        normalizedValues: "{}",
        structuralOutcome: "ACCEPTED",
        mappingStatus: "CONFIRMED",
        confirmedReleaseId: releases.conflict,
        confirmedScopeKey: `stage8-scope-a-${run}`,
        mappingConfidence: "MANUAL",
        mappingEvidence: "{}",
        mappingVersion: 2,
        createdAt: now,
        updatedAt: now
      },
      {
        id: `stage8-map-b-${run}`,
        importId: importIds[2],
        sourceRowNumber: 3,
        exportType: "SONGS_PERIOD",
        rowIdentityKey: `stage8-conflict-identity-${run}`,
        originalValues: "{}",
        safeDisplayValues: "{}",
        normalizedValues: "{}",
        structuralOutcome: "ACCEPTED",
        mappingStatus: "CONFIRMED",
        confirmedReleaseId: releases.conflictOther,
        confirmedScopeKey: `stage8-scope-b-${run}`,
        mappingConfidence: "MANUAL",
        mappingEvidence: "{}",
        mappingVersion: 2,
        createdAt: now,
        updatedAt: now
      }
    ]
  });
  await prisma.campaignTimelineEvent.create({
    data: {
      id: `stage8-event-${run}`,
      campaignId: campaigns.valid,
      releaseId: releases.valid,
      eventType: "CREATIVE_CHANGED",
      eventDate: day("2040-01-15"),
      timezone: "America/New_York",
      title: "Creative changed",
      source: "USER_ENTERED",
      confirmationStatus: "CONFIRMED",
      createdAt: now,
      updatedAt: now
    }
  });
}

async function main() {
  await cleanup();
  const before = await readRetentionDashboard({releaseId: releases.noCampaign}, {now, includeComparison: false});
  assert.equal(before.selectionState, "NO_AUDIENCE_IMPORT", "missing artist data has explicit import state");
  try {
    await seed();
    const noCampaign = await readRetentionDashboard({releaseId: releases.noCampaign}, {now, includeComparison: false});
    assert.equal(noCampaign.selectionState, "NO_CAMPAIGN");
    assert.ok(noCampaign.currentMetrics.every((metric) => metric.metricDate === "2041-12-31"));
    assert.equal(JSON.stringify(noCampaign).includes(`private/${importIds[0]}.csv`), false, "storage key stays server-private");

    await prisma.promotionCampaign.create({
      data: {
        id: campaigns.suggested,
        artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID,
        releaseId: releases.noCampaign,
        platform: "META",
        name: "Suggested-only campaign",
        objective: "STREAMS",
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
        activeIntervals: {create: {id: `${campaigns.suggested}-interval`, activeStartDate: day("2040-10-10"), activeEndDate: day("2040-10-20"), timezone: "UNCONFIRMED", sourceType: "META_REPORT_SUGGESTION", confirmationStatus: "SUGGESTED", createdAt: now, updatedAt: now}}
      }
    });
    const suggestedOnly = await readRetentionDashboard({releaseId: releases.noCampaign}, {now, includeComparison: false});
    assert.equal(suggestedOnly.selectionState, "UNCONFIRMED_CAMPAIGN", "suggested intervals cannot feed calculations");

    const ambiguous = await readRetentionDashboard({releaseId: releases.valid}, {now, includeComparison: false});
    assert.equal(ambiguous.selectionState, "AMBIGUOUS_CAMPAIGN");
    const complete = await readRetentionDashboard({releaseId: releases.valid, campaignId: campaigns.valid}, {now});
    assert.equal(complete.selectionState, "READY");
    assert.ok(complete.analysis);
    assert.equal(complete.analysis!.confidence.overallConfidence, complete.analysis!.analysis.confidence);
    assert.equal(complete.analysis!.trackMetrics.find((metric) => metric.id === "track-launch")?.value !== null, true);
    assert.ok(complete.comparisonRows.every((row, index, rows) => index === 0 || rows[index - 1].releaseDate >= row.releaseDate), "comparison defaults to release recency");

    const open = await readRetentionDashboard({releaseId: releases.open, campaignId: campaigns.open}, {now, includeComparison: false});
    assert.ok(open.analysis?.analysis.reasonCodes.includes("OPEN_CAMPAIGN"));
    assert.equal(open.analysis?.primaryMetrics.find((metric) => metric.id === "post-floor")?.value, null, "open floor is unavailable, not zero");
    assert.match(open.analysis?.interpretation.headline ?? "", /still open/i);

    const future = await readRetentionDashboard({releaseId: releases.future, campaignId: campaigns.future}, {now, includeComparison: false});
    assert.ok(future.analysis?.analysis.reasonCodes.includes("FUTURE_WINDOW_INCOMPLETE"));
    assert.match(future.analysis?.interpretation.detail ?? "", /2042-01-22/);

    const overlap = await readRetentionDashboard({releaseId: releases.overlap, campaignId: campaigns.overlap}, {now, includeComparison: false});
    assert.equal(overlap.analysis?.analysis.postCampaignFloor.status, "EXCLUDED");
    assert.match(overlap.analysis?.interpretation.detail ?? "", /shown for context/i);
    assert.ok(overlap.analysis?.trackMetrics.every((metric) => metric.value === null), "track persistence stays unavailable without a resolved track timeline");

    const missing = await readRetentionDashboard({releaseId: releases.missing, campaignId: campaigns.missing, range: "1000"}, {now, includeComparison: false});
    assert.ok(missing.analysis?.chart.accessibilitySummary.gapDates.includes("2040-07-12"));
    assert.notEqual(missing.analysis?.confidence.dataConfidence, "HIGH");

    const conflict = await readRetentionDashboard({releaseId: releases.conflict, campaignId: campaigns.conflict}, {now, includeComparison: false});
    assert.ok(conflict.analysis?.analysis.reasonCodes.includes("AMBIGUOUS_RELEASE_MAPPING"));
    assert.equal(conflict.analysis?.confidence.dataConfidence, "INSUFFICIENT");

    const invalid = await readRetentionDashboard({releaseId: releases.valid, campaignId: campaigns.open}, {now, includeComparison: false});
    assert.equal(invalid.selectionState, "INVALID_SELECTION", "cross-release campaign selection is blocked");

    await createImport(importIds[3], "ARTIST_AUDIENCE_TIMELINE");
    await prisma.artistMetricObservation.create({data: {id: `stage8-audience-replacement-row-${run}`, importId: importIds[3], artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate: day("2041-12-31"), listeners: 7777, monthlyListeners: 20000, monthlyActiveListeners: 8000, streams: 9000, playlistAdds: 40, saves: 80, followers: 6000, createdAt: now}});
    await prisma.analyticsImport.update({where: {id: importIds[0]}, data: {status: "REPLACED", replacedByImportId: importIds[3], updatedAt: now}});
    const replaced = await readRetentionDashboard({releaseId: releases.noCampaign}, {now, includeComparison: false});
    assert.equal(replaced.currentMetrics.find((metric) => metric.id === "listeners")?.value, 7777, "replaced observations are excluded from current metrics");
    await prisma.analyticsImport.update({where: {id: importIds[3]}, data: {status: "WITHDRAWN", withdrawnAt: now, updatedAt: now}});
    const withdrawn = await readRetentionDashboard({releaseId: releases.noCampaign}, {now, includeComparison: false});
    assert.equal(withdrawn.selectionState, "NO_AUDIENCE_IMPORT", "withdrawn observations are excluded from the dashboard");

    console.log("Retention dashboard server states, current metrics, confidence, comparison, overlap, gaps, track, and privacy checks passed.");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  await prisma.$disconnect();
  process.exitCode = 1;
});
