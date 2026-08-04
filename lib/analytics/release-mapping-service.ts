import "server-only";

import {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";
import {AdminError} from "@/lib/server/admin-error-response";
import {sanitizeSpotifyDisplayValue} from "./spotify-export-validation";
import {
  buildConfirmedMappingScope,
  buildReleaseAliasScope,
  normalizeMappingTitle,
  suggestReleaseMapping,
  type MappingEvidenceInput
} from "./release-matching";

export type MappingActor = {userId: string; username: string};
type Db = typeof prisma | Prisma.TransactionClient;

export const MAPPING_STATUSES = ["UNREVIEWED", "SUGGESTED", "CONFIRMED", "UNMATCHED", "REVOKED", "CONFLICT"] as const;
export const UNMATCHED_REASONS = ["RELEASE_NOT_IN_CATALOG", "AMBIGUOUS_MATCH", "WRONG_ARTIST", "DUPLICATE_EXPORT_ROW", "VERSION_NOT_SUPPORTED", "USER_DEFERRED", "OTHER"] as const;

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function cleanText(value: string | null | undefined, max = 500) {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function dateOnly(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function normalizedEvidence(row: {normalizedValues: string; safeDisplayValues: string}) {
  const normalized = safeJson(row.normalizedValues);
  const display = safeJson(row.safeDisplayValues);
  const string = (key: string) => typeof normalized[key] === "string" ? normalized[key] as string : typeof display[key] === "string" ? display[key] as string : "";
  return {
    exportedTitle: string("exportedTitle") || string("song") || string("title"),
    exportedReleaseDate: string("exportedReleaseDate") || string("releaseDate") || null,
    spotifyTrackId: string("spotifyTrackId") || null,
    isrc: string("isrc") || null,
    spotifyUrl: string("spotifyUrl") || null,
    upc: string("upc") || null
  } satisfies MappingEvidenceInput;
}

async function requireRow(rowId: string, db: Db = prisma) {
  const row = await db.analyticsImportRow.findUnique({
    where: {id: rowId},
    include: {import: true, songPeriodSnapshot: true, appliedAlias: true}
  });
  if (!row) throw new AdminError("Mapping row was not found.", {code: "MAPPING_ROW_NOT_FOUND", status: 404});
  return row;
}

function assertEligible(row: Awaited<ReturnType<typeof requireRow>>) {
  if (row.structuralOutcome === "REJECTED") throw new AdminError("Rejected rows cannot be mapped.", {code: "MAPPING_ROW_NOT_ELIGIBLE", status: 409});
  if (row.import.status !== "IMPORTED" || row.import.withdrawnAt || row.import.replacedByImportId) throw new AdminError("The source import is not active.", {code: "IMPORT_NOT_ACTIVE", status: 409});
  if (row.exportType !== "SONGS_PERIOD") throw new AdminError("This export row does not support release mapping.", {code: "MAPPING_ROW_NOT_ELIGIBLE", status: 409});
}

async function requireCompatibleRelease(releaseId: string, artistProfileId: string, db: Db = prisma) {
  const release = await db.release.findUnique({where: {id: releaseId}});
  if (!release) throw new AdminError("Release was not found.", {code: "RELEASE_NOT_FOUND", status: 404});
  if (release.primaryArtistProfileId !== artistProfileId) throw new AdminError("Release belongs to a different artist.", {code: "ARTIST_MISMATCH", status: 409});
  return release;
}

export async function computeMappingSuggestion(rowId: string, db: Db = prisma) {
  const row = await db.analyticsImportRow.findUnique({where: {id: rowId}, include: {import: {select: {artistProfileId: true, source: true}}}});
  if (!row) throw new AdminError("Mapping row was not found.", {code: "MAPPING_ROW_NOT_FOUND", status: 404});
  const evidence = normalizedEvidence(row);
  const [candidates, aliases] = await Promise.all([
    db.release.findMany({select: {id: true, title: true, releaseDate: true, primaryArtistProfileId: true, spotifyUrl: true, isrc: true, upc: true}}),
    db.releaseImportAlias.findMany({where: {status: "ACTIVE"}, select: {id: true, scopeKey: true, status: true, releaseId: true}})
  ]);
  return suggestReleaseMapping({artistProfileId: row.import.artistProfileId, source: row.import.source, exportType: row.exportType, evidence, candidates, aliases});
}

export async function refreshMappingSuggestion(rowId: string, now = new Date()) {
  const row = await requireRow(rowId);
  if (row.mappingStatus === "CONFIRMED") return computeMappingSuggestion(rowId);
  const suggestion = await computeMappingSuggestion(rowId);
  const nextStatus = row.mappingStatus === "UNMATCHED" ? "UNMATCHED" : suggestion.candidateReleaseId ? "SUGGESTED" : suggestion.confidence === "AMBIGUOUS" ? "CONFLICT" : "UNREVIEWED";
  await prisma.analyticsImportRow.update({where: {id: rowId}, data: {mappingStatus: nextStatus, mappingReason: suggestion.matchMethod, suggestedReleaseId: suggestion.candidateReleaseId, mappingConfidence: suggestion.confidence, mappingEvidence: json(suggestion), updatedAt: now}});
  return suggestion;
}

async function createAudit(db: Db, input: {
  rowId?: string | null;
  importId?: string | null;
  aliasId?: string | null;
  action: string;
  previousMappingStatus?: string | null;
  newMappingStatus?: string | null;
  previousReleaseId?: string | null;
  newReleaseId?: string | null;
  reason?: string;
  evidence?: unknown;
  actor: MappingActor;
  now: Date;
}) {
  return db.mappingAuditEvent.create({data: {id: createId(), rowId: input.rowId, importId: input.importId, aliasId: input.aliasId, action: input.action, previousMappingStatus: input.previousMappingStatus, newMappingStatus: input.newMappingStatus, previousReleaseId: input.previousReleaseId, newReleaseId: input.newReleaseId, reason: cleanText(input.reason), evidence: json(input.evidence), actorId: input.actor.userId || null, actorUsername: cleanText(input.actor.username, 120), createdAt: input.now}});
}

async function createOrReuseAlias(db: Db, row: Awaited<ReturnType<typeof requireRow>>, releaseId: string, actor: MappingActor, now: Date, acknowledgeNoDateAlias: boolean) {
  const evidence = normalizedEvidence(row);
  if (!evidence.exportedTitle) throw new AdminError("An exported title is required for an alias.", {code: "MAPPING_ROW_NOT_ELIGIBLE", status: 409});
  if (!evidence.exportedReleaseDate && !acknowledgeNoDateAlias) throw new AdminError("Title-only aliases require explicit risk acknowledgement.", {code: "MISSING_CONFIRMATION", status: 400});
  const scopeKey = buildReleaseAliasScope({artistProfileId: row.import.artistProfileId, source: row.import.source, exportType: row.exportType, exportedTitle: evidence.exportedTitle, exportedReleaseDate: evidence.exportedReleaseDate});
  const existing = await db.releaseImportAlias.findUnique({where: {activeScopeKey: scopeKey}});
  if (existing) {
    if (existing.releaseId !== releaseId) throw new AdminError("An active alias in this exact scope points to another release.", {code: "ALIAS_CONFLICT", status: 409});
    return {alias: existing, created: false};
  }
  const alias = await db.releaseImportAlias.create({data: {id: createId(), source: row.import.source, exportType: row.exportType, exportedTitle: evidence.exportedTitle, normalizedTitle: normalizeMappingTitle(evidence.exportedTitle), exportedReleaseDate: evidence.exportedReleaseDate ? new Date(`${evidence.exportedReleaseDate}T00:00:00.000Z`) : null, artistProfileId: row.import.artistProfileId, releaseId, status: "ACTIVE", matchMethod: "MANUAL_CONFIRMATION", evidence: json({rowId: row.id, importId: row.importId, sourceRowNumber: row.sourceRowNumber, titleOnlyRiskAcknowledged: !evidence.exportedReleaseDate ? acknowledgeNoDateAlias : false}), scopeKey, activeScopeKey: scopeKey, confirmedById: actor.userId, confirmedByUsername: cleanText(actor.username, 120), confirmedAt: now, createdAt: now, updatedAt: now}});
  return {alias, created: true};
}

function percentDifference(actual: number, expected: number) {
  if (!expected) return actual ? null : 0;
  return Number((((actual - expected) / expected) * 100).toFixed(4));
}

async function refreshImportMappingSummary(db: Prisma.TransactionClient, importId: string, now: Date, action: string) {
  const record = await db.analyticsImport.findUniqueOrThrow({where: {id: importId}});
  const rows = await db.analyticsImportRow.findMany({where: {importId}});
  const confirmedRows = rows.filter(({mappingStatus, confirmedReleaseId}) => mappingStatus === "CONFIRMED" && confirmedReleaseId);
  const unmatchedRows = rows.filter(({mappingStatus}) => mappingStatus === "UNMATCHED");
  const totals = confirmedRows.reduce((sum, row) => {
    const value = safeJson(row.normalizedValues);
    return {streams: sum.streams + (typeof value.streams === "number" ? value.streams : 0), saves: sum.saves + (typeof value.saves === "number" ? value.saves : 0), listeners: sum.listeners + (typeof value.listeners === "number" ? value.listeners : 0)};
  }, {streams: 0, saves: 0, listeners: 0});
  let artistComparison: Record<string, unknown> | null = null;
  let trackComparisons: Array<Record<string, unknown>> = [];
  if (record.userConfirmedPeriodStart && record.userConfirmedPeriodEnd) {
    const activeArtistImports = await db.analyticsImport.findMany({where: {artistProfileId: record.artistProfileId, importType: "ARTIST_AUDIENCE_TIMELINE", status: "IMPORTED", withdrawnAt: null, replacedByImportId: null}, select: {id: true}});
    const artistRows = await db.artistMetricObservation.findMany({where: {importId: {in: activeArtistImports.map(({id}) => id)}, metricDate: {gte: record.userConfirmedPeriodStart, lte: record.userConfirmedPeriodEnd}}});
    if (artistRows.length) {
      const comparable = artistRows.reduce((sum, row) => ({streams: sum.streams + row.streams, saves: sum.saves + row.saves}), {streams: 0, saves: 0});
      artistComparison = {available: true, streams: {songTotal: totals.streams, artistTotal: comparable.streams, absoluteDifference: totals.streams - comparable.streams, percentageDifference: percentDifference(totals.streams, comparable.streams)}, saves: {songTotal: totals.saves, artistTotal: comparable.saves, absoluteDifference: totals.saves - comparable.saves, percentageDifference: percentDifference(totals.saves, comparable.saves)}};
    }
    const activeTrackImports = await db.analyticsImport.findMany({where: {artistProfileId: record.artistProfileId, importType: "TRACK_STREAM_TIMELINE", status: "IMPORTED", withdrawnAt: null, replacedByImportId: null}, select: {id: true}});
    const trackRows = await db.trackMetricObservation.findMany({where: {importId: {in: activeTrackImports.map(({id}) => id)}, releaseId: {in: confirmedRows.flatMap(({confirmedReleaseId}) => confirmedReleaseId ? [confirmedReleaseId] : [])}, metricDate: {gte: record.userConfirmedPeriodStart, lte: record.userConfirmedPeriodEnd}}});
    const trackStreams = new Map<string, number>();
    for (const row of trackRows) trackStreams.set(row.releaseId, (trackStreams.get(row.releaseId) ?? 0) + row.streams);
    trackComparisons = confirmedRows.flatMap((row) => {
      const releaseId = row.confirmedReleaseId!;
      if (!trackStreams.has(releaseId)) return [];
      const songStreams = safeJson(row.normalizedValues).streams;
      if (typeof songStreams !== "number") return [];
      const trackTotal = trackStreams.get(releaseId)!;
      return [{releaseId, available: true, songStreams, trackStreams: trackTotal, absoluteDifference: songStreams - trackTotal, percentageDifference: percentDifference(songStreams, trackTotal)}];
    });
  }
  const previous = safeJson(record.validationSummary);
  const priorCurrent = previous.mappingReconciliation;
  const history = Array.isArray(previous.mappingReconciliationHistory) ? previous.mappingReconciliationHistory : [];
  const mappingReconciliation = {updatedAt: now.toISOString(), action, confirmedRowCount: confirmedRows.length, unmatchedRowCount: unmatchedRows.length, songTotals: totals, artistComparison: artistComparison ?? {available: false}, trackComparisons: trackComparisons.length ? trackComparisons : [{available: false}]};
  await db.analyticsImport.update({where: {id: importId}, data: {acceptedRowCount: confirmedRows.length, unmatchedRowCount: unmatchedRows.length, validationSummary: json({...previous, mappingReconciliation, mappingReconciliationHistory: priorCurrent ? [...history, priorCurrent] : history}), updatedAt: now}});
  return mappingReconciliation;
}

async function createSnapshotIfMissing(db: Prisma.TransactionClient, row: Awaited<ReturnType<typeof requireRow>>, releaseId: string, now: Date) {
  if (row.songPeriodSnapshot) return row.songPeriodSnapshot;
  const periodStart = row.import.userConfirmedPeriodStart;
  const periodEnd = row.import.userConfirmedPeriodEnd;
  if (!periodStart || !periodEnd || !row.import.periodDatesUserConfirmed) throw new AdminError("The source import does not have a confirmed report period.", {code: "PERIOD_NOT_CONFIRMED", status: 409});
  const value = safeJson(row.normalizedValues);
  const exportedTitle = typeof value.exportedTitle === "string" ? value.exportedTitle : "";
  const exportedReleaseDate = typeof value.exportedReleaseDate === "string" ? new Date(`${value.exportedReleaseDate}T00:00:00.000Z`) : null;
  const listeners = value.listeners;
  const streams = value.streams;
  const saves = value.saves;
  if (!exportedTitle || !exportedReleaseDate || Number.isNaN(exportedReleaseDate.getTime()) || !Number.isInteger(listeners) || !Number.isInteger(streams) || !Number.isInteger(saves)) throw new AdminError("The row lacks normalized song metrics required to create a snapshot.", {code: "MAPPING_ROW_NOT_ELIGIBLE", status: 409});
  const existing = await db.songPeriodSnapshot.findFirst({where: {importId: row.importId, releaseId, periodStart, periodEnd}});
  if (existing) throw new AdminError("A snapshot for this release and import period already exists.", {code: "SNAPSHOT_ALREADY_EXISTS", status: 409});
  return db.songPeriodSnapshot.create({data: {id: createId(), importId: row.importId, releaseId, periodStart, periodEnd, exportedTitle, exportedReleaseDate, listeners: listeners as number, streams: streams as number, saves: saves as number, mappingRowId: row.id, createdAt: now}});
}

export async function confirmMapping(rowId: string, input: {actor: MappingActor; releaseId: string; createAlias?: boolean; acknowledgeNoDateAlias?: boolean; reason?: string; now?: Date}) {
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await requireRow(rowId, tx);
      assertEligible(row);
      if (row.mappingStatus === "CONFIRMED") throw new AdminError("Mapping is already confirmed; use remap to change it.", {code: "MAPPING_ALREADY_CONFIRMED", status: 409});
      const release = await requireCompatibleRelease(cleanText(input.releaseId, 200), row.import.artistProfileId, tx);
      const duplicate = await tx.analyticsImportRow.findFirst({where: {importId: row.importId, confirmedReleaseId: release.id, mappingStatus: "CONFIRMED", id: {not: row.id}}});
      if (duplicate) throw new AdminError("Another row in this import is already mapped to that release.", {code: "MAPPING_CONFLICT", status: 409});
      const aliasResult = input.createAlias ? await createOrReuseAlias(tx, row, release.id, input.actor, now, Boolean(input.acknowledgeNoDateAlias)) : null;
      await createSnapshotIfMissing(tx, row, release.id, now);
      await tx.analyticsImportRow.update({where: {id: row.id}, data: {mappingStatus: "CONFIRMED", mappingReason: aliasResult ? aliasResult.created ? "MANUAL_CONFIRMATION_ALIAS_CREATED" : "EXISTING_ALIAS_REUSED" : "MANUAL_CONFIRMATION", confirmedReleaseId: release.id, confirmedScopeKey: buildConfirmedMappingScope(row.importId, release.id), suggestedReleaseId: release.id, mappingConfidence: aliasResult ? "EXACT_ALIAS" : "EXACT_TITLE_UNIQUE", mappingEvidence: json({manualConfirmation: true, reason: cleanText(input.reason), aliasId: aliasResult?.alias.id ?? null}), appliedAliasId: aliasResult?.alias.id ?? null, confirmedById: input.actor.userId, confirmedByUsername: cleanText(input.actor.username, 120), confirmedAt: now, unmatchedReason: null, unmatchedNote: "", unmatchedById: null, unmatchedByUsername: "", unmatchedAt: null, mappingVersion: {increment: 1}, updatedAt: now}});
      await createAudit(tx, {rowId: row.id, importId: row.importId, aliasId: aliasResult?.alias.id, action: aliasResult?.created ? "CONFIRMED_AND_ALIAS_CREATED" : aliasResult ? "CONFIRMED_WITH_ALIAS" : "CONFIRMED", previousMappingStatus: row.mappingStatus, newMappingStatus: "CONFIRMED", previousReleaseId: row.confirmedReleaseId, newReleaseId: release.id, reason: input.reason, evidence: {snapshotCreated: !row.songPeriodSnapshot}, actor: input.actor, now});
      const reconciliation = await refreshImportMappingSummary(tx, row.importId, now, "CONFIRMED");
      return {ok: true as const, code: "MAPPING_CONFIRMED", message: "Mapping confirmed and import resolution refreshed.", rowId: row.id, releaseId: release.id, aliasId: aliasResult?.alias.id ?? null, reconciliation};
    });
  } catch (error) {
    if (error instanceof AdminError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("Mapping or alias changed concurrently.", {code: "MAPPING_CONFLICT", status: 409});
    throw error;
  }
}

export async function leaveMappingUnmatched(rowId: string, input: {actor: MappingActor; reason: string; note?: string; now?: Date}) {
  const reason = cleanText(input.reason, 80);
  if (!UNMATCHED_REASONS.includes(reason as (typeof UNMATCHED_REASONS)[number])) throw new AdminError("Select a supported unmatched reason.", {code: "INVALID_UNMATCHED_REASON", status: 400});
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const row = await requireRow(rowId, tx);
    assertEligible(row);
    await tx.analyticsImportRow.update({where: {id: row.id}, data: {mappingStatus: "UNMATCHED", mappingReason: "EXPLICITLY_UNMATCHED", confirmedReleaseId: null, confirmedScopeKey: null, appliedAliasId: null, confirmedById: null, confirmedByUsername: "", confirmedAt: null, unmatchedReason: reason, unmatchedNote: cleanText(input.note), unmatchedById: input.actor.userId, unmatchedByUsername: cleanText(input.actor.username, 120), unmatchedAt: now, mappingVersion: {increment: 1}, updatedAt: now}});
    await createAudit(tx, {rowId: row.id, importId: row.importId, action: "UNMATCHED", previousMappingStatus: row.mappingStatus, newMappingStatus: "UNMATCHED", previousReleaseId: row.confirmedReleaseId, reason: `${reason}${input.note ? `: ${cleanText(input.note)}` : ""}`, actor: input.actor, now});
    const reconciliation = await refreshImportMappingSummary(tx, row.importId, now, "UNMATCHED");
    return {ok: true as const, code: "MAPPING_LEFT_UNMATCHED", message: "Row remains recoverable in the mapping queue.", rowId: row.id, reconciliation};
  });
}

export async function remapMapping(rowId: string, input: {actor: MappingActor; releaseId: string; reason: string; createAlias?: boolean; acknowledgeNoDateAlias?: boolean; now?: Date}) {
  const reason = cleanText(input.reason);
  if (!reason) throw new AdminError("A remapping reason is required.", {code: "REMAP_REASON_REQUIRED", status: 400});
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await requireRow(rowId, tx);
      assertEligible(row);
      if (row.mappingStatus !== "CONFIRMED" || !row.confirmedReleaseId) throw new AdminError("Only a confirmed row can be remapped.", {code: "MAPPING_ROW_NOT_ELIGIBLE", status: 409});
      const release = await requireCompatibleRelease(cleanText(input.releaseId, 200), row.import.artistProfileId, tx);
      if (release.id === row.confirmedReleaseId) throw new AdminError("Row is already mapped to that release.", {code: "MAPPING_ALREADY_CONFIRMED", status: 409});
      const duplicate = await tx.analyticsImportRow.findFirst({where: {importId: row.importId, confirmedReleaseId: release.id, mappingStatus: "CONFIRMED", id: {not: row.id}}});
      if (duplicate) throw new AdminError("Another row in this import is already mapped to that release.", {code: "MAPPING_CONFLICT", status: 409});
      if (row.appliedAlias?.status === "ACTIVE") {
        await tx.releaseImportAlias.update({where: {id: row.appliedAlias.id}, data: {status: input.createAlias ? "SUPERSEDED" : "REVOKED", activeScopeKey: null, revokedAt: now, revokedById: input.actor.userId, revokedByUsername: cleanText(input.actor.username, 120), revocationReason: reason, updatedAt: now}});
      }
      const aliasResult = input.createAlias ? await createOrReuseAlias(tx, row, release.id, input.actor, now, Boolean(input.acknowledgeNoDateAlias)) : null;
      if (row.appliedAlias?.status === "ACTIVE") {
        if (aliasResult) await tx.releaseImportAlias.update({where: {id: row.appliedAlias.id}, data: {supersededByAliasId: aliasResult.alias.id}});
        await createAudit(tx, {rowId: row.id, importId: row.importId, aliasId: row.appliedAlias.id, action: aliasResult ? "ALIAS_SUPERSEDED" : "ALIAS_REVOKED_DURING_REMAP", previousReleaseId: row.appliedAlias.releaseId, newReleaseId: aliasResult?.alias.releaseId, reason, actor: input.actor, now});
      }
      await tx.analyticsImportRow.update({where: {id: row.id}, data: {mappingStatus: "CONFIRMED", mappingReason: "AUDITED_REMAP", confirmedReleaseId: release.id, confirmedScopeKey: buildConfirmedMappingScope(row.importId, release.id), suggestedReleaseId: release.id, mappingConfidence: aliasResult ? "EXACT_ALIAS" : row.mappingConfidence, mappingEvidence: json({remapped: true, reason, immutableSnapshotReleaseId: row.songPeriodSnapshot?.releaseId ?? null, resolutionReleaseId: release.id}), appliedAliasId: aliasResult?.alias.id ?? null, confirmedById: input.actor.userId, confirmedByUsername: cleanText(input.actor.username, 120), confirmedAt: now, mappingVersion: {increment: 1}, updatedAt: now}});
      await createAudit(tx, {rowId: row.id, importId: row.importId, aliasId: aliasResult?.alias.id, action: "REMAPPED", previousMappingStatus: row.mappingStatus, newMappingStatus: "CONFIRMED", previousReleaseId: row.confirmedReleaseId, newReleaseId: release.id, reason, evidence: {snapshotPreserved: Boolean(row.songPeriodSnapshot), resolutionLayer: true}, actor: input.actor, now});
      const reconciliation = await refreshImportMappingSummary(tx, row.importId, now, "REMAPPED");
      return {ok: true as const, code: "MAPPING_REMAPPED", message: "Mapping resolution changed; the imported snapshot remains immutable.", rowId: row.id, previousReleaseId: row.confirmedReleaseId, releaseId: release.id, aliasId: aliasResult?.alias.id ?? null, reconciliation};
    });
  } catch (error) {
    if (error instanceof AdminError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("Mapping changed concurrently.", {code: "MAPPING_CONFLICT", status: 409});
    throw error;
  }
}

export async function revokeReleaseAlias(aliasId: string, input: {actor: MappingActor; reason: string; now?: Date}) {
  const reason = cleanText(input.reason);
  if (!reason) throw new AdminError("An alias revocation reason is required.", {code: "VALIDATION", status: 400});
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const alias = await tx.releaseImportAlias.findUnique({where: {id: aliasId}});
    if (!alias) throw new AdminError("Alias was not found.", {code: "NOT_FOUND", status: 404});
    if (alias.status !== "ACTIVE") throw new AdminError("Alias is already revoked or superseded.", {code: "ALIAS_REVOKED", status: 409});
    await tx.releaseImportAlias.update({where: {id: alias.id}, data: {status: "REVOKED", activeScopeKey: null, revokedAt: now, revokedById: input.actor.userId, revokedByUsername: cleanText(input.actor.username, 120), revocationReason: reason, updatedAt: now}});
    await createAudit(tx, {aliasId: alias.id, action: "ALIAS_REVOKED", previousReleaseId: alias.releaseId, reason, actor: input.actor, now});
    return {ok: true as const, code: "ALIAS_REVOKED", message: "Alias revoked; prior row mappings remain preserved.", aliasId: alias.id};
  });
}

export async function listMappingQueue(filters: {page?: number; pageSize?: number; importId?: string; exportType?: string; mappingStatus?: string; artistProfileId?: string; confidence?: string; suggestedReleaseId?: string; dateFrom?: Date; dateTo?: Date} = {}) {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const pageSize = Number.isFinite(filters.pageSize) ? Math.min(100, Math.max(1, Math.floor(filters.pageSize!))) : 25;
  const where: Prisma.AnalyticsImportRowWhereInput = {
    ...(filters.importId ? {importId: filters.importId} : {}),
    ...(filters.exportType ? {exportType: filters.exportType} : {}),
    ...(filters.mappingStatus ? {mappingStatus: filters.mappingStatus} : {}),
    ...(filters.confidence ? {mappingConfidence: filters.confidence} : {}),
    ...(filters.suggestedReleaseId ? {suggestedReleaseId: filters.suggestedReleaseId} : {}),
    import: {
      ...(filters.artistProfileId ? {artistProfileId: filters.artistProfileId} : {}),
      ...(filters.dateFrom || filters.dateTo ? {uploadedAt: {gte: filters.dateFrom, lte: filters.dateTo}} : {})
    }
  };
  const [total, rows] = await Promise.all([
    prisma.analyticsImportRow.count({where}),
    prisma.analyticsImportRow.findMany({where, orderBy: [{createdAt: "desc"}, {id: "desc"}], skip: (page - 1) * pageSize, take: pageSize, include: {import: {select: {id: true, originalFilename: true, importType: true, artistProfileId: true, uploadedAt: true, status: true}}, suggestedRelease: {select: {id: true, title: true, releaseDate: true}}, confirmedRelease: {select: {id: true, title: true}}, appliedAlias: {select: {id: true, status: true}}, songPeriodSnapshot: {select: {id: true}}}})
  ]);
  return {page, pageSize, total, items: rows.map((row) => ({id: row.id, sourceRowNumber: row.sourceRowNumber, exportType: row.exportType, safeDisplayValues: safeJson(row.safeDisplayValues), normalizedValues: safeJson(row.normalizedValues), mappingStatus: row.mappingStatus, mappingReason: row.mappingReason, mappingConfidence: row.mappingConfidence, mappingEvidence: safeJson(row.mappingEvidence), suggestedRelease: row.suggestedRelease ? {...row.suggestedRelease, releaseDate: dateOnly(row.suggestedRelease.releaseDate)} : null, confirmedRelease: row.confirmedRelease, alias: row.appliedAlias, import: {...row.import, uploadedAt: row.import.uploadedAt.toISOString()}, observationsAlreadyExist: Boolean(row.songPeriodSnapshot), availableActions: row.structuralOutcome === "REJECTED" ? [] : row.mappingStatus === "CONFIRMED" ? ["REMAP", "UNMATCH"] : ["CONFIRM", "UNMATCH"]}))};
}

export async function readMappingRowDetail(rowId: string) {
  const row = await prisma.analyticsImportRow.findUnique({where: {id: rowId}, include: {import: {select: {id: true, source: true, importType: true, artistProfileId: true, originalFilename: true, uploadedAt: true, status: true, userConfirmedPeriodStart: true, userConfirmedPeriodEnd: true}}, suggestedRelease: {select: {id: true, title: true, releaseDate: true}}, confirmedRelease: {select: {id: true, title: true, releaseDate: true}}, appliedAlias: true, songPeriodSnapshot: {select: {id: true, releaseId: true, periodStart: true, periodEnd: true}}, auditEvents: {orderBy: [{createdAt: "asc"}, {id: "asc"}]}}});
  if (!row) throw new AdminError("Mapping row was not found.", {code: "MAPPING_ROW_NOT_FOUND", status: 404});
  const suggestion = await computeMappingSuggestion(row.id);
  return {id: row.id, sourceRowNumber: row.sourceRowNumber, exportType: row.exportType, rowIdentityKey: row.rowIdentityKey, safeDisplayValues: safeJson(row.safeDisplayValues), normalizedValues: safeJson(row.normalizedValues), structuralOutcome: row.structuralOutcome, mappingStatus: row.mappingStatus, mappingReason: row.mappingReason, mappingConfidence: row.mappingConfidence, mappingEvidence: safeJson(row.mappingEvidence), unmatchedReason: row.unmatchedReason, unmatchedNote: row.unmatchedNote, suggestedRelease: row.suggestedRelease, confirmedRelease: row.confirmedRelease, alias: row.appliedAlias ? {...row.appliedAlias, evidence: safeJson(row.appliedAlias.evidence), activeScopeKey: undefined} : null, immutableSnapshot: row.songPeriodSnapshot, import: row.import, suggestion, auditEvents: row.auditEvents.map(({evidence, ...event}) => ({...event, evidence: safeJson(evidence)}))};
}

export async function listReleaseAliases(filters: {page?: number; pageSize?: number; status?: string; artistProfileId?: string; source?: string; exportType?: string} = {}) {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const pageSize = Number.isFinite(filters.pageSize) ? Math.min(100, Math.max(1, Math.floor(filters.pageSize!))) : 25;
  const where = {status: filters.status, artistProfileId: filters.artistProfileId, source: filters.source, exportType: filters.exportType} satisfies Prisma.ReleaseImportAliasWhereInput;
  const [total, aliases] = await Promise.all([prisma.releaseImportAlias.count({where}), prisma.releaseImportAlias.findMany({where, orderBy: [{createdAt: "desc"}, {id: "desc"}], skip: (page - 1) * pageSize, take: pageSize, include: {release: {select: {id: true, title: true}}, artistProfile: {select: {id: true, displayName: true}}}})]);
  return {page, pageSize, total, items: aliases.map(({activeScopeKey, evidence, ...alias}) => ({...alias, exportedReleaseDate: dateOnly(alias.exportedReleaseDate), confirmedAt: alias.confirmedAt.toISOString(), revokedAt: alias.revokedAt?.toISOString() ?? null, evidence: safeJson(evidence)}))};
}

type BackfillIssue = {importId: string; code: "MISSING_METADATA" | "MALFORMED_METADATA" | "MISSING_ROW_VALUES" | "CONFLICT"; message: string};

export async function backfillStage3AnalyticsImportRows(options: {importId?: string; now?: Date; actor?: MappingActor} = {}) {
  const now = options.now ?? new Date();
  const actor = options.actor ?? {userId: "", username: "stage4-backfill"};
  const imports = await prisma.analyticsImport.findMany({where: {importType: "SONGS_PERIOD", ...(options.importId ? {id: options.importId} : {})}, include: {mappingRows: {select: {sourceRowNumber: true}}, songPeriodSnapshots: true}});
  const result = {importsScanned: imports.length, importsBackfilled: 0, rowsCreated: 0, mappedRows: 0, unmatchedRows: 0, rowsSkipped: 0, issues: [] as BackfillIssue[]};
  for (const record of imports) {
    let metadata: Record<string, unknown>;
    try {
      const parsed = JSON.parse(record.metadata);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata is not an object");
      metadata = parsed as Record<string, unknown>;
    } catch {
      result.issues.push({importId: record.id, code: "MALFORMED_METADATA", message: "Import metadata is not valid JSON."});
      continue;
    }
    if (!Array.isArray(metadata.temporaryMappings)) {
      result.issues.push({importId: record.id, code: "MISSING_METADATA", message: "No Stage 3 temporaryMappings array is present."});
      continue;
    }
    const existingRows = new Set(record.mappingRows.map(({sourceRowNumber}) => sourceRowNumber));
    let createdForImport = 0;
    for (const raw of metadata.temporaryMappings) {
      if (!raw || typeof raw !== "object" || !Number.isInteger((raw as {originalRowNumber?: unknown}).originalRowNumber)) {
        result.issues.push({importId: record.id, code: "MALFORMED_METADATA", message: "A temporary mapping entry lacks a valid source row number."});
        continue;
      }
      const evidence = raw as Record<string, unknown>;
      const sourceRowNumber = evidence.originalRowNumber as number;
      if (existingRows.has(sourceRowNumber)) { result.rowsSkipped += 1; continue; }
      const releaseId = typeof evidence.releaseId === "string" && evidence.releaseId ? evidence.releaseId : null;
      const snapshot = releaseId ? record.songPeriodSnapshots.find((item) => item.releaseId === releaseId) : null;
      const normalized = evidence.normalizedValues && typeof evidence.normalizedValues === "object" ? evidence.normalizedValues as Record<string, unknown> : snapshot ? {exportedTitle: snapshot.exportedTitle, exportedReleaseDate: dateOnly(snapshot.exportedReleaseDate), listeners: snapshot.listeners, streams: snapshot.streams, saves: snapshot.saves} : {exportedTitle: evidence.exportedTitle, exportedReleaseDate: evidence.exportedReleaseDate};
      if (typeof normalized.exportedTitle !== "string" || typeof normalized.exportedReleaseDate !== "string") {
        result.issues.push({importId: record.id, code: "MISSING_ROW_VALUES", message: `Row ${sourceRowNumber} cannot be reconstructed safely.`});
        continue;
      }
      const exportedTitle = normalized.exportedTitle;
      const exportedReleaseDate = normalized.exportedReleaseDate;
      const isMapped = evidence.decision === "MAPPED" && Boolean(releaseId);
      const rowId = createId();
      try {
        await prisma.$transaction(async (tx) => {
          await tx.analyticsImportRow.create({data: {id: rowId, importId: record.id, sourceRowNumber, exportType: record.importType, rowIdentityKey: `${normalizeMappingTitle(exportedTitle)}|${exportedReleaseDate}`, originalValues: json(normalized), safeDisplayValues: json({exportedTitle: sanitizeSpotifyDisplayValue(exportedTitle).safeValue, exportedReleaseDate}), normalizedValues: json(normalized), structuralOutcome: "ACCEPTED", mappingStatus: isMapped ? "CONFIRMED" : "UNMATCHED", mappingReason: isMapped ? "STAGE3_TEMPORARY_MAPPING" : "STAGE3_EXPLICIT_UNMATCHED", suggestedReleaseId: releaseId, confirmedReleaseId: releaseId, confirmedScopeKey: releaseId ? buildConfirmedMappingScope(record.id, releaseId) : null, mappingConfidence: isMapped ? "EXACT_TITLE_UNIQUE" : "NO_MATCH", mappingEvidence: json({backfilledFrom: "AnalyticsImport.metadata.temporaryMappings", originalEvidence: evidence}), confirmedById: isMapped ? record.uploadedById : null, confirmedByUsername: isMapped ? record.uploadedByUsername : "", confirmedAt: isMapped ? record.acceptedAt : null, unmatchedReason: isMapped ? null : "USER_DEFERRED", unmatchedNote: isMapped ? "" : "Backfilled from Stage 3 explicit unmatched decision.", unmatchedById: isMapped ? null : record.uploadedById, unmatchedByUsername: isMapped ? "" : record.uploadedByUsername, unmatchedAt: isMapped ? null : record.acceptedAt, createdAt: now, updatedAt: now}});
          if (snapshot) await tx.songPeriodSnapshot.update({where: {id: snapshot.id}, data: {mappingRowId: rowId}});
          await createAudit(tx, {rowId, importId: record.id, action: "BACKFILLED_FROM_STAGE3", newMappingStatus: isMapped ? "CONFIRMED" : "UNMATCHED", newReleaseId: releaseId, reason: "Idempotent Stage 4 row normalization", evidence: {sourceRowNumber}, actor: record.uploadedById ? {userId: record.uploadedById, username: record.uploadedByUsername} : actor, now});
        });
        existingRows.add(sourceRowNumber);
        createdForImport += 1;
        result.rowsCreated += 1;
        if (isMapped) result.mappedRows += 1; else result.unmatchedRows += 1;
        if (!isMapped) await refreshMappingSuggestion(rowId, now);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          result.issues.push({importId: record.id, code: "CONFLICT", message: `Row ${sourceRowNumber} conflicts with an existing mapping scope.`});
          continue;
        }
        throw error;
      }
    }
    if (createdForImport) result.importsBackfilled += 1;
  }
  return result;
}
