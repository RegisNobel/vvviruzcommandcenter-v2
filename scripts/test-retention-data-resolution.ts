import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

import {prisma} from "../lib/db/prisma";
import {
  readReleaseRetentionAnalysis,
  RetentionCampaignRequiredError
} from "../lib/analytics/retention-data";
import {datesInclusive} from "../lib/analytics/retention-calculations";
import {readCurrentAnalyticsDataset} from "../lib/repositories/analytics-imports";

const run = randomUUID();
const artistId = `retention-artist-${run}`;
const releaseId = `retention-release-${run}`;
const staleReleaseId = `retention-stale-${run}`;
const conflictReleaseId = `retention-conflict-${run}`;
const campaignId = `retention-campaign-${run}`;
const secondCampaignId = `retention-campaign-second-${run}`;
const mismatchCampaignId = `retention-campaign-mismatch-${run}`;
const importIds: string[] = [];
const campaignIds = [campaignId, secondCampaignId, mismatchCampaignId];
const now = new Date("2026-06-01T00:00:00.000Z");

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function createImport(input: {
  id: string;
  type: string;
  acceptedAt: string;
  status?: string;
  withdrawnAt?: string;
  replacedByImportId?: string;
  summary?: object;
  confirmedPeriod?: boolean;
}) {
  importIds.push(input.id);
  await prisma.analyticsImport.create({
    data: {
      id: input.id,
      importType: input.type,
      originalFilename: `${input.id}.csv`,
      fileHash: Buffer.from(input.id).toString("hex").padEnd(64, "0").slice(0, 64),
      artistProfileId: artistId,
      uploadedAt: day(input.acceptedAt),
      status: input.status ?? "IMPORTED",
      acceptedAt: day(input.acceptedAt),
      withdrawnAt: input.withdrawnAt ? day(input.withdrawnAt) : null,
      replacedByImportId: input.replacedByImportId,
      validationSummary: JSON.stringify(input.summary ?? {parserVersion: "1"}),
      periodDatesUserConfirmed: input.confirmedPeriod ?? false,
      normalizationVersion: 1,
      createdAt: day(input.acceptedAt),
      updatedAt: day(input.acceptedAt)
    }
  });
}

async function cleanup() {
  await prisma.campaignAuditEvent.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.campaignTimelineEvent.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.campaignActiveInterval.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.campaignEvidence.deleteMany({where: {campaignId: {in: campaignIds}}});
  await prisma.promotionCampaign.deleteMany({where: {id: {in: campaignIds}}});
  await prisma.mappingAuditEvent.deleteMany({where: {importId: {in: importIds}}});
  await prisma.songPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.analyticsImportRow.deleteMany({where: {importId: {in: importIds}}});
  await prisma.trackMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.artistMetricObservation.deleteMany({where: {importId: {in: importIds}}});
  await prisma.playlistPeriodSnapshot.deleteMany({where: {importId: {in: importIds}}});
  await prisma.releaseImportAlias.deleteMany({where: {artistProfileId: artistId}});
  await prisma.analyticsImport.updateMany({where: {id: {in: importIds}}, data: {replacedByImportId: null}});
  await prisma.analyticsImport.deleteMany({where: {id: {in: importIds}}});
  await prisma.release.deleteMany({where: {id: {in: [releaseId, staleReleaseId, conflictReleaseId]}}});
  await prisma.artistProfile.deleteMany({where: {id: artistId}});
}

async function main() {
  await cleanup();
  await prisma.artistProfile.create({
    data: {
      id: artistId,
      slug: artistId,
      displayName: "Retention Artist",
      draftUpdatedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.release.createMany({
    data: [
      {id: releaseId, slug: releaseId, title: "Retention Release", primaryArtistProfileId: artistId, releaseDate: day("2026-03-01"), createdOn: now, updatedOn: now},
      {id: staleReleaseId, slug: staleReleaseId, title: "Stale Mapping Release", primaryArtistProfileId: artistId, releaseDate: day("2025-01-01"), createdOn: now, updatedOn: now},
      {id: conflictReleaseId, slug: conflictReleaseId, title: "Conflict Mapping Release", primaryArtistProfileId: artistId, releaseDate: day("2025-02-01"), createdOn: now, updatedOn: now}
    ]
  });
  await prisma.promotionCampaign.create({
    data: {
      id: campaignId,
      artistProfileId: artistId,
      releaseId,
      platform: "META",
      name: "Release Campaign",
      objective: "STREAMS",
      status: "ENDED",
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.campaignActiveInterval.create({
    data: {
      id: `retention-interval-${run}`,
      campaignId,
      activeStartDate: day("2026-03-01"),
      activeEndDate: day("2026-03-14"),
      timezone: "America/New_York",
      sourceType: "META_REPORT_SUGGESTION",
      confirmationStatus: "CONFIRMED",
      confirmedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  await assert.rejects(
    () => readReleaseRetentionAnalysis(`missing-release-${run}`, {now}),
    (error: unknown) => (error as {code?: string}).code === "RETENTION_RELEASE_NOT_FOUND"
  );
  await prisma.release.update({where: {id: releaseId}, data: {releaseDate: null}});
  await assert.rejects(
    () => readReleaseRetentionAnalysis(releaseId, {campaignId, now}),
    (error: unknown) => (error as {code?: string}).code === "RETENTION_DATA_UNAVAILABLE"
  );
  await prisma.release.update({where: {id: releaseId}, data: {releaseDate: day("2026-07-01")}});
  await assert.rejects(
    () => readReleaseRetentionAnalysis(releaseId, {campaignId, now}),
    (error: unknown) => (error as {code?: string}).code === "RETENTION_DATA_UNAVAILABLE"
  );
  await prisma.release.update({where: {id: releaseId}, data: {releaseDate: day("2026-03-01")}});
  await prisma.promotionCampaign.create({
    data: {
      id: mismatchCampaignId,
      artistProfileId: artistId,
      releaseId: staleReleaseId,
      platform: "META",
      name: "Mismatch Campaign",
      objective: "STREAMS",
      status: "DRAFT",
      createdAt: now,
      updatedAt: now
    }
  });
  await assert.rejects(
    () => readReleaseRetentionAnalysis(releaseId, {campaignId: mismatchCampaignId, now}),
    (error: unknown) =>
      (error as {code?: string}).code === "RETENTION_CAMPAIGN_RELEASE_MISMATCH"
  );
  await assert.rejects(
    () => readReleaseRetentionAnalysis(releaseId, {campaignId: `missing-campaign-${run}`, now}),
    (error: unknown) => (error as {code?: string}).code === "RETENTION_CAMPAIGN_NOT_FOUND"
  );

  const oldArtistImport = `retention-old-${run}`;
  const artistImport = `retention-current-${run}`;
  const withdrawnImport = `retention-withdrawn-${run}`;
  const replacedImport = `retention-replaced-${run}`;
  const trackImport = `retention-track-${run}`;
  const songImport = `retention-song-${run}`;
  await createImport({id: oldArtistImport, type: "ARTIST_AUDIENCE_TIMELINE", acceptedAt: "2026-05-01"});
  await createImport({
    id: artistImport,
    type: "ARTIST_AUDIENCE_TIMELINE",
    acceptedAt: "2026-05-02",
    summary: {
      parserVersion: "spotify-1",
      reconciliation: {
        entries: [{key: "SONGS_VS_ARTIST_STREAMS", severity: "WARNING", message: "5.5% difference"}]
      }
    }
  });
  await createImport({id: withdrawnImport, type: "ARTIST_AUDIENCE_TIMELINE", acceptedAt: "2026-05-03", status: "WITHDRAWN", withdrawnAt: "2026-05-04"});
  await createImport({id: replacedImport, type: "ARTIST_AUDIENCE_TIMELINE", acceptedAt: "2026-05-04", status: "REPLACED", replacedByImportId: artistImport});
  await createImport({id: trackImport, type: "TRACK_STREAM_TIMELINE", acceptedAt: "2026-05-05"});
  await createImport({id: songImport, type: "SONGS_PERIOD", acceptedAt: "2026-05-06", confirmedPeriod: true});

  await prisma.artistMetricObservation.create({
    data: {
      id: `old-observation-${run}`,
      importId: oldArtistImport,
      artistProfileId: artistId,
      metricDate: day("2026-02-01"),
      listeners: 999,
      monthlyListeners: 1000,
      monthlyActiveListeners: 400,
      streams: 200,
      playlistAdds: 10,
      saves: 20,
      followers: 100,
      createdAt: now
    }
  });
  for (const [index, date] of datesInclusive("2026-02-01", "2026-04-11").entries()) {
    await prisma.artistMetricObservation.create({
      data: {
        id: `current-observation-${index}-${run}`,
        importId: artistImport,
        artistProfileId: artistId,
        metricDate: day(date),
        listeners: date < "2026-03-01" ? 100 : date <= "2026-03-14" ? 200 : 150,
        monthlyListeners: 1000,
        monthlyActiveListeners: 400,
        streams: 200,
        playlistAdds: 10,
        saves: 20,
        followers: 100 + index,
        createdAt: now
      }
    });
  }
  for (const [index, date] of datesInclusive("2026-03-01", "2026-04-11").entries()) {
    await prisma.trackMetricObservation.create({
      data: {
        id: `track-observation-${index}-${run}`,
        importId: trackImport,
        releaseId,
        spotifyTrackId: "spotify-track-one",
        metricDate: day(date),
        streams: 100 + index,
        createdAt: now
      }
    });
  }
  const aliasId = `retention-alias-${run}`;
  await prisma.releaseImportAlias.create({
    data: {
      id: aliasId,
      source: "SPOTIFY_FOR_ARTISTS",
      exportType: "SONGS_PERIOD",
      exportedTitle: "Retention Release",
      normalizedTitle: "retention release",
      artistProfileId: artistId,
      releaseId,
      status: "REVOKED",
      matchMethod: "EXACT_ALIAS",
      scopeKey: `scope-${run}`,
      confirmedAt: now,
      revokedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  const mappingRowId = `retention-row-${run}`;
  await prisma.analyticsImportRow.create({
    data: {
      id: mappingRowId,
      importId: songImport,
      sourceRowNumber: 1,
      exportType: "SONGS_PERIOD",
      rowIdentityKey: "retention release|2026-03-01",
      structuralOutcome: "ACCEPTED",
      mappingStatus: "CONFIRMED",
      confirmedReleaseId: releaseId,
      mappingConfidence: "EXACT_ALIAS",
      appliedAliasId: aliasId,
      confirmedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.songPeriodSnapshot.create({
    data: {
      id: `retention-snapshot-${run}`,
      importId: songImport,
      releaseId: staleReleaseId,
      periodStart: day("2026-03-01"),
      periodEnd: day("2026-03-28"),
      exportedTitle: "Retention Release",
      exportedReleaseDate: day("2026-03-01"),
      listeners: 100,
      streams: 200,
      saves: 20,
      mappingRowId,
      createdAt: now
    }
  });

  const current = await readCurrentAnalyticsDataset(artistId);
  assert.equal(current.artistMetricObservations.find((row) => dateOnly(row.metricDate) === "2026-02-01")?.listeners, 100, "latest accepted observation wins");
  assert.ok(!current.imports.some((item) => item.id === withdrawnImport), "withdrawn import is excluded");
  assert.ok(!current.imports.some((item) => item.id === replacedImport), "replaced import is excluded");
  assert.equal(current.songPeriodSnapshots[0]?.releaseId, releaseId, "current Stage 4 mapping overrides stale snapshot releaseId");

  const analysis = await readReleaseRetentionAnalysis(releaseId, {campaignId, now});
  assert.equal(analysis.mappingResolution[0]?.confirmedReleaseId, releaseId);
  assert.equal(analysis.mappingResolution[0]?.appliedAliasStatus, "REVOKED", "revoked alias does not rewrite historical confirmed row");
  assert.ok(analysis.inputImportIds.includes(artistImport));
  assert.ok(!analysis.inputImportIds.includes(withdrawnImport));
  assert.equal(analysis.reconciliationWarnings[0]?.key, "SONGS_VS_ARTIST_STREAMS");
  assert.ok(analysis.reasonCodes.includes("CROSS_EXPORT_DISCREPANCY"));
  assert.ok(analysis.reasonCodes.includes("TIMEZONE_UNCERTAIN"));
  assert.equal(analysis.growth.liftRetained.percentage, 50);

  await prisma.promotionCampaign.create({
    data: {
      id: secondCampaignId,
      artistProfileId: artistId,
      releaseId,
      platform: "TIKTOK",
      name: "Second Campaign",
      objective: "AWARENESS",
      status: "DRAFT",
      createdAt: now,
      updatedAt: now
    }
  });
  await assert.rejects(
    () => readReleaseRetentionAnalysis(releaseId, {now}),
    (error: unknown) =>
      error instanceof RetentionCampaignRequiredError && error.campaigns.length === 2
  );

  const conflictImport = `retention-conflict-map-${run}`;
  await createImport({id: conflictImport, type: "SONGS_PERIOD", acceptedAt: "2026-05-07"});
  await prisma.analyticsImportRow.create({
    data: {
      id: `retention-conflict-row-${run}`,
      importId: conflictImport,
      sourceRowNumber: 1,
      exportType: "SONGS_PERIOD",
      rowIdentityKey: "retention release|2026-03-01",
      structuralOutcome: "ACCEPTED",
      mappingStatus: "CONFIRMED",
      confirmedReleaseId: conflictReleaseId,
      mappingConfidence: "MANUAL",
      confirmedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  const conflict = await readReleaseRetentionAnalysis(releaseId, {campaignId, now});
  assert.equal(conflict.status, "INSUFFICIENT");
  assert.ok(conflict.reasonCodes.includes("AMBIGUOUS_RELEASE_MAPPING"));

  console.log("Retention current-import, remapping, alias-history, reconciliation, and campaign-selection checks passed.");
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
