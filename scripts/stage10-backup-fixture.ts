import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import {prisma} from "../lib/db/prisma";
import {readCurrentAnalyticsDataset, CANONICAL_ANALYTICS_ARTIST_ID} from "../lib/repositories/analytics-imports";
import {readReleaseRetentionAnalysis} from "../lib/analytics/retention-data";

const now = new Date("2025-04-01T00:00:00.000Z");
const releaseId = "stage10-restore-release";
const campaignId = "stage10-restore-campaign";
const currentImportId = "stage10-restore-import-current";
const gameOverImportId = "a060e608-24f4-4f79-8a3b-fceface408c9";
const gameOverReleaseId = "7814c0e7-b8b1-44d7-ad44-4d0197c5330f";
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function day(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function range(start: string, end: string) {
  const values: string[] = [];
  for (let current = day(start); current <= day(end); current = new Date(current.getTime() + 86_400_000)) values.push(current.toISOString().slice(0, 10));
  return values;
}
function importData(id: string, status: string, acceptedAt: Date, extra: Record<string, unknown> = {}) {
  return {id, importType: "ARTIST_AUDIENCE_TIMELINE", originalFilename: `${id}.csv`, fileHash: id.padEnd(64, "a").slice(0, 64), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, uploadedById: "stage10-restore-admin", uploadedByUsername: "restore-operator", uploadedAt: acceptedAt, status, acceptedAt, reportingTimezone: "UTC", validationSummary: "{}", metadata: "{}", normalizationVersion: 1, createdAt: acceptedAt, updatedAt: acceptedAt, ...extra};
}

async function seed() {
  await prisma.adminUser.create({data: {id: "stage10-restore-admin", username: "restore-operator", createdAt: now, updatedAt: now}});
  await prisma.artistProfile.create({data: {id: CANONICAL_ANALYTICS_ARTIST_ID, slug: "vvviruz", displayName: "vvviruz", workflowStatus: "DRAFT", draftUpdatedAt: now, createdAt: now, updatedAt: now}});
  await prisma.release.create({data: {id: releaseId, title: "Restore Rehearsal", slug: "restore-rehearsal", catalogScope: "VVVIRUZ", primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseDate: day("2025-01-01"), createdOn: now, updatedOn: now}});
  await prisma.release.create({data: {id: gameOverReleaseId, title: "Game Over", slug: "game-over", isrc: "QT6ED2602112", catalogScope: "VVVIRUZ", primaryArtistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseDate: day("2026-07-11"), createdOn: now, updatedOn: now}});
  await prisma.analyticsImport.create({data: importData(currentImportId, "IMPORTED", day("2025-02-02"), {rawFileStorageDriver: "local", rawFileStorageKey: "stage10-private-raw.csv", rawFileExpiresAt: day("2025-03-04")}) as never});
  await prisma.analyticsImport.create({data: importData("stage10-restore-import-old", "REPLACED", day("2025-02-01"), {replacedByImportId: currentImportId}) as never});
  await prisma.analyticsImport.create({data: importData("stage10-restore-import-withdrawn", "WITHDRAWN", day("2025-02-03"), {withdrawnAt: day("2025-02-10"), withdrawnById: "stage10-restore-admin", withdrawalReason: "Representative withdrawal"}) as never});
  await prisma.analyticsImport.create({data: {...importData("stage10-restore-import-mapping", "IMPORTED", day("2025-02-04")), importType: "SONGS_PERIOD", periodDatesUserConfirmed: true, userConfirmedPeriodStart: day("2025-01-01"), userConfirmedPeriodEnd: day("2025-01-31")} as never});
  await prisma.analyticsImport.create({data: {...importData(gameOverImportId, "IMPORTED", day("2026-08-09")), importType: "TRACK_STREAM_TIMELINE", originalFilename: "game-over-timeline.csv", fileHash: "15a4bedaea68451030ede560ec8e648f925ea9349ff1973bd1aaf0cfaf3b3f16", rowCount: 952, acceptedRowCount: 952, metadata: JSON.stringify({confirmations: {catalog: true}, previewResultChecksum: "production-shaped-checksum"})} as never});
  const dates = range("2024-12-01", "2025-03-15");
  await prisma.artistMetricObservation.createMany({data: dates.map((date, index) => ({id: `stage10-restore-observation-${index}`, importId: currentImportId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, metricDate: day(date), listeners: 1000 + index + (date >= "2025-01-10" && date <= "2025-01-20" ? 300 : 0), monthlyListeners: 15000 + index, monthlyActiveListeners: 6000 + index, streams: 2200 + index, playlistAdds: 20, saves: 40, followers: 5000 + index, createdAt: now}))});
  const gameOverDates = range("2024-01-01", "2026-08-09");
  assert.equal(gameOverDates.length, 952);
  await prisma.trackMetricObservation.createMany({data: gameOverDates.map((date, index) => ({id: `game-over-observation-${String(index).padStart(4, "0")}`, importId: gameOverImportId, releaseId: gameOverReleaseId, spotifyTrackId: "game-over-track", metricDate: day(date), streams: index + 1, listeners: index % 17, saves: index % 7, playlistAdds: index % 3, createdAt: now}))});
  const metaBatchId = "e2a5a408-02ea-426b-910a-2015124877ad";
  await prisma.adImportBatch.create({data: {id: metaBatchId, name: "Game Over production-shaped daily fixture", releaseId: gameOverReleaseId, reportingStart: day("2026-07-11"), reportingEnd: day("2026-08-09"), sourceGranularity: "DAILY", campaignIntervalEligible: true, validationState: "ACCEPTED", accountId: "fixture-account", accountTimezone: "America/Los_Angeles", normalizedTimezone: "America/Los_Angeles", timezoneSource: "ACCOUNT_REGISTRY", currency: "USD", sourceAsOf: day("2026-08-09"), sourceAsOfOrigin: "IMPORT_ACCEPTED_FALLBACK", acceptedById: "stage10-restore-admin", acceptedByUsername: "restore-operator", acceptedAt: day("2026-08-09"), importState: "ACCEPTED", createdAt: now, updatedAt: now}});
  const metaDates = range("2026-07-11", "2026-08-09");
  const metaFacts = metaDates.flatMap((date, dateIndex) => Array.from({length: 7}, (_, adIndex) => {
    const index = dateIndex * 7 + adIndex;
    const identityKey = `game-over|ad-${adIndex}|${date}|SPEND`;
    return {id: `game-over-meta-observation-${String(index).padStart(3, "0")}`, importBatchId: metaBatchId, accountId: "fixture-account", campaignId: "fixture-campaign", campaignName: "Game Over", adSetId: "fixture-ad-set", adSetName: "Game Over", adId: `fixture-ad-${adIndex}`, adName: `Creative ${adIndex}`, metricDate: day(date), sourceReportingDate: date, accountTimezone: "America/Los_Angeles", normalizedTimezone: "America/Los_Angeles", timezoneSource: "ACCOUNT_REGISTRY", currency: "USD", currencyOrigin: "HEADER", metricFamily: "SPEND", metricKey: "SPEND", attributionSetting: "7-day click, 1-day view", spend: index < 59 ? 4.72 : index === 59 ? 5 : 0, sourceAsOf: day("2026-08-09"), sourceAsOfOrigin: "IMPORT_ACCEPTED_FALLBACK", acceptedAt: day("2026-08-09"), parserVersion: "fixture-v1", normalizationVersion: "fixture-v1", identityKey, createdAt: now};
  }));
  assert.equal(metaFacts.length, 210);
  await prisma.metaDailySourceObservation.createMany({data: metaFacts});
  await prisma.metaDailyResolution.createMany({data: metaFacts.map((fact, index) => ({id: `game-over-meta-resolution-${String(index).padStart(3, "0")}`, identityKey: fact.identityKey, accountId: fact.accountId, campaignId: fact.campaignId, adSetId: fact.adSetId, adId: fact.adId, metricDate: fact.metricDate, currency: "USD", currencyOrigin: "HEADER", metricFamily: "SPEND", metricKey: "SPEND", attributionSetting: fact.attributionSetting, currentObservationId: fact.id, resolvedAt: now}))});
  await prisma.metaImportAuditEvent.create({data: {id: "game-over-meta-acceptance-audit", importBatchId: metaBatchId, action: "IMPORT_ACCEPTED", actorId: "stage10-restore-admin", actorUsername: "restore-operator", createdAt: now}});
  await prisma.metaAccountTimezoneResolution.create({data: {id: "game-over-timezone", accountId: "fixture-account", ianaTimezone: "America/Los_Angeles", sourceOrigin: "USER_CONFIRMED", confirmedAt: now, confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", createdAt: now}});
  await prisma.releaseImportAlias.createMany({data: [
    {id: "stage10-restore-alias-old", source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Restore Rehearsal", normalizedTitle: "restore rehearsal", exportedReleaseDate: day("2025-01-01"), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseId, status: "SUPERSEDED", matchMethod: "MANUAL_CONFIRMATION", scopeKey: "stage10-scope-old", activeScopeKey: null, confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", confirmedAt: now, supersededByAliasId: "stage10-restore-alias-active", createdAt: now, updatedAt: now},
    {id: "stage10-restore-alias-active", source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", exportedTitle: "Restore Rehearsal", normalizedTitle: "restore rehearsal", exportedReleaseDate: day("2025-01-01"), artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseId, status: "ACTIVE", matchMethod: "MANUAL_CONFIRMATION", scopeKey: "stage10-scope-active", activeScopeKey: "stage10-scope-active", confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", confirmedAt: now, createdAt: now, updatedAt: now}
  ]});
  await prisma.analyticsImportRow.create({data: {id: "stage10-restore-mapping-row", importId: "stage10-restore-import-mapping", sourceRowNumber: 2, exportType: "SONGS_PERIOD", rowIdentityKey: "restore rehearsal|2025-01-01", originalValues: "{}", safeDisplayValues: "{}", normalizedValues: JSON.stringify({exportedTitle: "Restore Rehearsal", exportedReleaseDate: "2025-01-01", listeners: 100, streams: 200, saves: 10}), structuralOutcome: "ACCEPTED", mappingStatus: "CONFIRMED", confirmedReleaseId: releaseId, confirmedScopeKey: "stage10-confirmed-scope", mappingConfidence: "MANUAL", appliedAliasId: "stage10-restore-alias-active", confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", confirmedAt: now, createdAt: now, updatedAt: now}});
  await prisma.mappingAuditEvent.create({data: {id: "stage10-restore-mapping-audit", rowId: "stage10-restore-mapping-row", importId: "stage10-restore-import-mapping", aliasId: "stage10-restore-alias-active", action: "CONFIRMED", newMappingStatus: "CONFIRMED", newReleaseId: releaseId, actorId: "stage10-restore-admin", actorUsername: "restore-operator", createdAt: now}});
  await prisma.promotionCampaign.create({data: {id: campaignId, artistProfileId: CANONICAL_ANALYTICS_ARTIST_ID, releaseId, platform: "META", name: "Restore campaign", objective: "STREAMS", status: "ENDED", createdById: "stage10-restore-admin", createdByUsername: "restore-operator", updatedById: "stage10-restore-admin", updatedByUsername: "restore-operator", createdAt: now, updatedAt: now}});
  await prisma.campaignEvidence.create({data: {id: "stage10-restore-evidence", campaignId, sourceType: "USER_NOTE", sourceRecordId: "restore-evidence", rationale: "Representative restore evidence", confidence: "HIGH", createdById: "stage10-restore-admin", createdByUsername: "restore-operator", createdAt: now, updatedAt: now}});
  await prisma.campaignActiveInterval.createMany({data: [
    {id: "stage10-restore-interval-old", campaignId, activeStartDate: day("2025-01-09"), activeEndDate: day("2025-01-19"), timezone: "America/New_York", sourceType: "MANUAL", confirmationStatus: "SUPERSEDED", confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", confirmedAt: now, createdAt: now, updatedAt: now},
    {id: "stage10-restore-interval-current", campaignId, activeStartDate: day("2025-01-10"), activeEndDate: day("2025-01-20"), timezone: "America/New_York", sourceType: "MANUAL", confirmationStatus: "CONFIRMED", evidenceId: "stage10-restore-evidence", supersedesIntervalId: "stage10-restore-interval-old", confirmedById: "stage10-restore-admin", confirmedByUsername: "restore-operator", confirmedAt: now, createdAt: now, updatedAt: now}
  ]});
  await prisma.campaignTimelineEvent.createMany({data: [
    {id: "stage10-restore-event-old", campaignId, releaseId, eventType: "CREATIVE_CHANGED", eventDate: day("2025-01-12"), timezone: "America/New_York", title: "Old creative", source: "USER_ENTERED", confirmationStatus: "SUPERSEDED", createdById: "stage10-restore-admin", createdByUsername: "restore-operator", revokedAt: now, createdAt: now, updatedAt: now},
    {id: "stage10-restore-event-current", campaignId, releaseId, eventType: "CREATIVE_CHANGED", eventDate: day("2025-01-13"), timezone: "America/New_York", title: "Corrected creative", source: "USER_ENTERED", confirmationStatus: "CONFIRMED", supersedesEventId: "stage10-restore-event-old", createdById: "stage10-restore-admin", createdByUsername: "restore-operator", createdAt: now, updatedAt: now}
  ]});
  await prisma.campaignAuditEvent.create({data: {id: "stage10-restore-campaign-audit", campaignId, intervalId: "stage10-restore-interval-current", evidenceId: "stage10-restore-evidence", action: "INTERVAL_CORRECTED", actorId: "stage10-restore-admin", actorUsername: "restore-operator", createdAt: now}});
}

async function fingerprint() {
  const dataset = await readCurrentAnalyticsDataset(CANONICAL_ANALYTICS_ARTIST_ID);
  const analysis = await readReleaseRetentionAnalysis(releaseId, {campaignId, now});
  const gameOverImport = await prisma.analyticsImport.findUniqueOrThrow({where: {id: gameOverImportId}});
  const gameOverTimeline = await prisma.trackMetricObservation.findMany({where: {importId: gameOverImportId}, orderBy: {id: "asc"}});
  const metaFacts = await prisma.metaDailySourceObservation.findMany({where: {importBatchId: "e2a5a408-02ea-426b-910a-2015124877ad"}, orderBy: {id: "asc"}});
  const metaAudit = await prisma.metaImportAuditEvent.findUniqueOrThrow({where: {id: "game-over-meta-acceptance-audit"}});
  return {
    counts: {
      imports: await prisma.analyticsImport.count(),
      observations: await prisma.artistMetricObservation.count(),
      rows: await prisma.analyticsImportRow.count(),
      aliases: await prisma.releaseImportAlias.count(),
      mappingAudits: await prisma.mappingAuditEvent.count(),
      campaigns: await prisma.promotionCampaign.count(),
      intervals: await prisma.campaignActiveInterval.count(),
      events: await prisma.campaignTimelineEvent.count(),
      evidence: await prisma.campaignEvidence.count(),
      campaignAudits: await prisma.campaignAuditEvent.count()
    },
    gameOverContract: {
      importId: gameOverImport.id,
      releaseId: gameOverReleaseId,
      importType: gameOverImport.importType,
      status: gameOverImport.status,
      observationCount: gameOverTimeline.length,
      earliestDate: gameOverTimeline[0]?.metricDate.toISOString().slice(0, 10),
      latestDate: gameOverTimeline.at(-1)?.metricDate.toISOString().slice(0, 10),
      actorId: gameOverImport.uploadedById,
      importFingerprint: digest(gameOverImport),
      timelineFingerprint: digest(gameOverTimeline)
    },
    gameOverMetaContract: {
      factCount: metaFacts.length,
      positiveCount: metaFacts.filter((row) => (row.spend ?? 0) > 0).length,
      explicitZeroCount: metaFacts.filter((row) => row.spend === 0).length,
      spend: metaFacts.reduce((total, row) => total + (row.spend ?? 0), 0).toFixed(2),
      factsFingerprint: digest(metaFacts),
      acceptanceActorId: metaAudit.actorId,
      acceptanceFingerprint: digest(metaAudit)
    },
    current: dataset.artistMetricObservations.map((row) => [row.metricDate.toISOString(), row.listeners]),
    analysis: {status: analysis.status, confidence: analysis.confidence, windows: analysis.windows, growth: analysis.growth, reasonCodes: analysis.reasonCodes},
    links: {
      replacedBy: (await prisma.analyticsImport.findUniqueOrThrow({where: {id: "stage10-restore-import-old"}})).replacedByImportId,
      withdrawn: (await prisma.analyticsImport.findUniqueOrThrow({where: {id: "stage10-restore-import-withdrawn"}})).withdrawnAt?.toISOString(),
      aliasSupersededBy: (await prisma.releaseImportAlias.findUniqueOrThrow({where: {id: "stage10-restore-alias-old"}})).supersededByAliasId,
      intervalSupersedes: (await prisma.campaignActiveInterval.findUniqueOrThrow({where: {id: "stage10-restore-interval-current"}})).supersedesIntervalId,
      eventSupersedes: (await prisma.campaignTimelineEvent.findUniqueOrThrow({where: {id: "stage10-restore-event-current"}})).supersedesEventId
    },
    usernames: {
      mapping: (await prisma.mappingAuditEvent.findUniqueOrThrow({where: {id: "stage10-restore-mapping-audit"}})).actorUsername,
      campaign: (await prisma.campaignAuditEvent.findUniqueOrThrow({where: {id: "stage10-restore-campaign-audit"}})).actorUsername
    },
    actorIds: {
      importUploaded: (await prisma.analyticsImport.findUniqueOrThrow({where: {id: currentImportId}})).uploadedById,
      importWithdrawn: (await prisma.analyticsImport.findUniqueOrThrow({where: {id: "stage10-restore-import-withdrawn"}})).withdrawnById,
      aliasConfirmed: (await prisma.releaseImportAlias.findUniqueOrThrow({where: {id: "stage10-restore-alias-active"}})).confirmedById,
      rowConfirmed: (await prisma.analyticsImportRow.findUniqueOrThrow({where: {id: "stage10-restore-mapping-row"}})).confirmedById,
      mapping: (await prisma.mappingAuditEvent.findUniqueOrThrow({where: {id: "stage10-restore-mapping-audit"}})).actorId,
      campaignCreated: (await prisma.promotionCampaign.findUniqueOrThrow({where: {id: campaignId}})).createdById,
      evidenceCreated: (await prisma.campaignEvidence.findUniqueOrThrow({where: {id: "stage10-restore-evidence"}})).createdById,
      intervalConfirmed: (await prisma.campaignActiveInterval.findUniqueOrThrow({where: {id: "stage10-restore-interval-current"}})).confirmedById,
      eventCreated: (await prisma.campaignTimelineEvent.findUniqueOrThrow({where: {id: "stage10-restore-event-current"}})).createdById,
      campaignAudit: (await prisma.campaignAuditEvent.findUniqueOrThrow({where: {id: "stage10-restore-campaign-audit"}})).actorId
    }
  };
}

async function main() {
  const mode = process.argv[2];
  if (mode === "seed") await seed();
  else if (mode === "fingerprint") {
    const value = await fingerprint();
    const output = process.env.STAGE10_FINGERPRINT_PATH;
    if (!output) throw new Error("STAGE10_FINGERPRINT_PATH is required.");
    await fs.writeFile(output, JSON.stringify(value));
  } else if (mode === "verify") {
    const expectedPath = process.env.STAGE10_FINGERPRINT_PATH;
    const snapshotPath = process.env.DB_SNAPSHOT_PATH;
    if (!expectedPath || !snapshotPath) throw new Error("Fingerprint and snapshot paths are required.");
    const expected = JSON.parse(await fs.readFile(expectedPath, "utf8"));
    const actual = JSON.parse(JSON.stringify(await fingerprint()));
    assert.deepEqual(actual, expected);
    assert.equal(actual.counts.imports, 5);
    assert.deepEqual(
      {
        importId: actual.gameOverContract.importId,
        releaseId: actual.gameOverContract.releaseId,
        importType: actual.gameOverContract.importType,
        status: actual.gameOverContract.status,
        observationCount: actual.gameOverContract.observationCount,
        earliestDate: actual.gameOverContract.earliestDate,
        latestDate: actual.gameOverContract.latestDate,
        actorId: actual.gameOverContract.actorId
      },
      {
        importId: gameOverImportId,
        releaseId: gameOverReleaseId,
        importType: "TRACK_STREAM_TIMELINE",
        status: "IMPORTED",
        observationCount: 952,
        earliestDate: "2024-01-01",
        latestDate: "2026-08-09",
        actorId: "stage10-restore-admin"
      }
    );
    assert.equal(actual.gameOverMetaContract.factCount, 210);
    assert.equal(actual.gameOverMetaContract.positiveCount, 60);
    assert.equal(actual.gameOverMetaContract.explicitZeroCount, 150);
    assert.equal(actual.gameOverMetaContract.spend, "283.48");
    assert.equal(actual.gameOverMetaContract.acceptanceActorId, "stage10-restore-admin");
    const snapshotText = await fs.readFile(snapshotPath, "utf8");
    assert.ok(!snapshotText.includes("RAW_CSV_SECRET_BYTES"));
    assert.equal(actual.usernames.mapping, "restore-operator");
    assert.equal(actual.usernames.campaign, "restore-operator");
  } else throw new Error("Use seed, fingerprint, or verify.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
