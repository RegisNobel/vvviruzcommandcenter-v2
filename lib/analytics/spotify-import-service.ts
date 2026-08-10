import "server-only";

import path from "node:path";

import {Prisma} from "@prisma/client";

import {SPOTIFY_EXPORT_NORMALIZATION_VERSION, SPOTIFY_EXPORT_PARSER_VERSION, type SpotifyExportParseResult, type SpotifyNormalizedRow, type SpotifyPreviewPeriod} from "./spotify-export-types";
import {parseSpotifyExport} from "./spotify-export-parser";
import {checksumSpotifyPreviewResult, createSpotifyPreviewToken, readSpotifyPreviewToken, SPOTIFY_PREVIEW_TTL_MS} from "./spotify-preview-token";
import {hashRawSpotifyFile, parseSpotifyDateOnly, sanitizeSpotifyDisplayValue} from "./spotify-export-validation";
import {buildConfirmedMappingScope, buildReleaseAliasScope, normalizeMappingTitle} from "./release-matching";
import {suggestReleaseMapping} from "./release-matching";
import {resolveFinalReviewCounts} from "./import-center-ui";
import {prisma} from "@/lib/db/prisma";
import {AdminError} from "@/lib/server/admin-error-response";
import {deleteAsset, getPrivateAssetStorageDriver, listStoredAssetReferences, readAssetBuffer, storeAsset} from "@/lib/server/asset-storage";
import {appendArtistMetricObservations, appendPlaylistPeriodSnapshots, appendSongPeriodSnapshots, appendTrackMetricObservations, CANONICAL_ANALYTICS_ARTIST_ID, createAnalyticsImport, getRawAnalyticsFileRetentionDays, readCurrentAnalyticsDataset} from "@/lib/repositories/analytics-imports";

export const SPOTIFY_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SPOTIFY_IMPORT_ROW_PREVIEW_LIMIT = 200;

export type SpotifyImportActor = {userId: string; username: string};
export type SpotifyPreviewInput = {
  actor: SpotifyImportActor;
  fileName: string;
  mimeType?: string | null;
  bytes: Uint8Array;
  previewPeriod?: SpotifyPreviewPeriod | null;
  artistProfileId?: string | null;
  releaseId?: string | null;
  reprocessSourceImportId?: string | null;
  allowExistingHashForReprocess?: boolean;
  now?: Date;
};

export type SpotifySongMappingDecision = {
  originalRowNumber: number;
  releaseId?: string | null;
  leaveUnmatched?: boolean;
  unmatchedReason?: string | null;
  unmatchedNote?: string | null;
};

export type SpotifyCommitInput = {
  actor: SpotifyImportActor;
  previewToken: string;
  clientIdempotencyKey: string;
  artistProfileId?: string | null;
  releaseId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  songMappings?: SpotifySongMappingDecision[];
  acknowledgeWarnings?: boolean;
  acknowledgeFilenameNotIdentity?: boolean;
  acknowledgeTrackStreamsNotRetention?: boolean;
  replacementTargetImportId?: string | null;
  now?: Date;
};

function cleanFilename(value: string) {
  return path.basename(value).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 240) || "spotify-export.csv";
}

function dateOnlyToDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function datesOverlap(leftStart: Date | null, leftEnd: Date | null, rightStart: string, rightEnd: string) {
  if (!leftStart || !leftEnd) return false;
  return leftStart <= dateOnlyToDate(rightEnd) && leftEnd >= dateOnlyToDate(rightStart);
}

function importPublicSummary(record: {
  id: string;
  status: string;
  acceptedAt: Date | null;
  withdrawnAt: Date | null;
  replacedByImportId: string | null;
}) {
  return {
    id: record.id,
    status: record.status,
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    active: record.status === "IMPORTED" && !record.withdrawnAt && !record.replacedByImportId,
    withdrawn: Boolean(record.withdrawnAt) || record.status === "WITHDRAWN",
    replaced: Boolean(record.replacedByImportId) || record.status === "REPLACED"
  };
}

async function candidateArtist(artistProfileId: string | null | undefined) {
  const id = artistProfileId?.trim() || CANONICAL_ANALYTICS_ARTIST_ID;
  const artist = await prisma.artistProfile.findUnique({
    where: {id},
    select: {id: true, slug: true, displayName: true, workflowStatus: true, publishedAt: true}
  });
  return artist;
}

async function candidateRelease(releaseId: string | null | undefined) {
  if (!releaseId?.trim()) return null;
  return prisma.release.findUnique({
    where: {id: releaseId.trim()},
    select: {id: true, title: true, slug: true, primaryArtistProfileId: true, catalogScope: true}
  });
}

function parserPeriod(result: SpotifyExportParseResult) {
  if (result.dateRange) return {start: result.dateRange.minimumDate, end: result.dateRange.maximumDate};
  if (result.previewPeriod) return {start: result.previewPeriod.periodStart, end: result.previewPeriod.periodEnd};
  return null;
}

async function findOverlaps(
  result: SpotifyExportParseResult,
  artistProfileId: string,
  releaseId: string | null
) {
  if (!result.detectedType) return [];
  const period = parserPeriod(result);
  if (!period) return [{classification: "UNABLE_TO_DETERMINE", importId: null, message: "The report period is not confirmed."}];
  const imports = await prisma.analyticsImport.findMany({
    where: {
      artistProfileId,
      importType: result.detectedType,
      status: "IMPORTED",
      withdrawnAt: null,
      replacedByImportId: null,
      ...(result.detectedType === "TRACK_STREAM_TIMELINE" && releaseId
        ? {trackMetricObservations: {some: {releaseId}}}
        : {})
    },
    select: {id: true, detectedPeriodStart: true, detectedPeriodEnd: true, userConfirmedPeriodStart: true, userConfirmedPeriodEnd: true}
  });
  const overlaps = imports.filter((item) => datesOverlap(
    item.userConfirmedPeriodStart ?? item.detectedPeriodStart,
    item.userConfirmedPeriodEnd ?? item.detectedPeriodEnd,
    period.start,
    period.end
  ));
  return overlaps.map((item) => ({
    classification: result.detectedType === "TRACK_STREAM_TIMELINE" && !releaseId ? "POTENTIAL" : "CONFIRMED",
    importId: item.id,
    message: result.detectedType === "TRACK_STREAM_TIMELINE" && !releaseId
      ? "A track-stream import overlaps these dates, but release identity is not yet confirmed."
      : "An active import with the same context overlaps this period."
  }));
}

function requiredActions(result: SpotifyExportParseResult, duplicate: boolean) {
  if (duplicate) return ["RESOLVE_DUPLICATE_FILE"];
  if (!result.detectedType || result.blockingErrors.length || result.rejectedCount) return ["FIX_FILE_ERRORS"];
  const actions: string[] = [];
  if (result.detectedType !== "TRACK_STREAM_TIMELINE") actions.push("CONFIRM_ARTIST");
  if (result.requiresPeriodConfirmation) actions.push("CONFIRM_REPORT_PERIOD");
  if (result.detectedType === "TRACK_STREAM_TIMELINE") {
    actions.push("CONFIRM_RELEASE", "ACKNOWLEDGE_FILENAME_NOT_IDENTITY", "ACKNOWLEDGE_TRACK_STREAMS_NOT_RETENTION");
  }
  if (result.detectedType === "SONGS_PERIOD") actions.push("MAP_OR_LEAVE_UNMATCHED_EACH_SONG");
  const warningCodes = [...result.fileWarnings, ...result.rows.flatMap(({warnings}) => warnings)]
    .filter(({code}) => code !== "UTF8_BOM_REMOVED" && code !== "PERIOD_CONFIRMATION_REQUIRED");
  if (warningCodes.length) actions.push("ACKNOWLEDGE_WARNINGS");
  return actions;
}

export async function createSpotifyImportPreview(input: SpotifyPreviewInput) {
  const now = input.now ?? new Date();
  const fileName = cleanFilename(input.fileName);
  const bytes = new Uint8Array(input.bytes);
  const result = parseSpotifyExport({
    fileName,
    bytes,
    mimeType: input.mimeType,
    previewPeriod: input.previewPeriod,
    limits: {maxFileBytes: SPOTIFY_IMPORT_MAX_FILE_BYTES}
  });
  const existing = result.fileMetadata.sha256
    ? await prisma.analyticsImport.findUnique({
        where: {fileHash: result.fileMetadata.sha256},
        select: {id: true, status: true, acceptedAt: true, withdrawnAt: true, replacedByImportId: true}
      })
    : null;
  const artist = await candidateArtist(input.artistProfileId);
  const release = await candidateRelease(input.releaseId);
  const mappingCandidates = artist && result.detectedType === "SONGS_PERIOD"
    ? await prisma.release.findMany({
        select: {id: true, title: true, releaseDate: true, primaryArtistProfileId: true, spotifyUrl: true, isrc: true, upc: true}
      })
    : [];
  const mappingAliases = artist && result.detectedType === "SONGS_PERIOD"
    ? await prisma.releaseImportAlias.findMany({
        where: {artistProfileId: artist.id, source: "SPOTIFY_FOR_ARTISTS", exportType: "SONGS_PERIOD", status: "ACTIVE"},
        select: {id: true, activeScopeKey: true, status: true, releaseId: true}
      })
    : [];
  const candidateById = new Map(mappingCandidates.map((candidate) => [candidate.id, candidate]));
  const rowPreview = result.rows.slice(0, SPOTIFY_IMPORT_ROW_PREVIEW_LIMIT).map((row) => {
    const normalized = row.normalizedValues;
    if (!artist || result.detectedType !== "SONGS_PERIOD" || !normalized || !("exportedTitle" in normalized)) return row;
    const suggestion = suggestReleaseMapping({
      artistProfileId: artist.id,
      source: "SPOTIFY_FOR_ARTISTS",
      exportType: result.detectedType,
      evidence: {exportedTitle: normalized.exportedTitle, exportedReleaseDate: normalized.exportedReleaseDate},
      candidates: mappingCandidates,
      aliases: mappingAliases.flatMap((alias) => alias.activeScopeKey ? [{id: alias.id, scopeKey: alias.activeScopeKey, status: alias.status, releaseId: alias.releaseId}] : [])
    });
    const suggested = suggestion.candidateReleaseId ? candidateById.get(suggestion.candidateReleaseId) : null;
    return {
      ...row,
      mappingSuggestion: {
        candidateRelease: suggested ? {id: suggested.id, title: suggested.title, releaseDate: suggested.releaseDate?.toISOString().slice(0, 10) ?? null} : null,
        matchMethod: suggestion.matchMethod,
        confidence: suggestion.confidence,
        competingCandidates: suggestion.competingCandidates,
        existingAliasId: suggestion.aliasId,
        manualConfirmationRequired: suggestion.manualConfirmationRequired,
        mayAutoApply: suggestion.mayAutoApply
      }
    };
  });
  const previewReconciliation = artist && result.detectedType
    ? await buildReconciliation(
        result,
        artist.id,
        release?.id ?? null,
        result.previewPeriod
          ? {periodStart: result.previewPeriod.periodStart, periodEnd: result.previewPeriod.periodEnd}
          : null
      )
    : {thresholds: {warningPercent: 5, highPercent: 20}, entries: []};
  const duplicateBlocked = Boolean(existing && !input.allowExistingHashForReprocess);
  const canCommit = Boolean(result.detectedType && !result.blockingErrors.length && !result.rejectedCount && !duplicateBlocked);
  let previewToken: string | null = null;
  let previewId: string | null = null;
  let expiresAt: string | null = null;

  if (canCommit) {
    const temporaryFileName = `${crypto.randomUUID()}.csv`;
    const stored = await storeAsset({
      kind: "analytics-preview",
      fileName: temporaryFileName,
      data: Buffer.from(bytes),
      access: "private",
      contentType: input.mimeType?.trim() || "text/csv"
    });
    const created = createSpotifyPreviewToken({
      userId: input.actor.userId,
      fileHash: result.fileMetadata.sha256!,
      parserVersion: result.parserVersion,
      normalizationVersion: result.normalizationVersion,
      detectedType: result.detectedType!,
      parsedResultChecksum: checksumSpotifyPreviewResult(result),
      temporaryRawFileReference: stored.storedPath,
      originalFileName: fileName,
      mimeType: input.mimeType?.trim() || null,
      sizeBytes: bytes.byteLength,
      previewPeriod: result.previewPeriod,
      candidateArtistProfileId: artist?.id ?? null,
      candidateReleaseId: release?.id ?? null,
      reprocessSourceImportId: input.reprocessSourceImportId?.trim() || null
    }, {now});
    previewToken = created.token;
    previewId = created.payload.previewId;
    expiresAt = new Date(created.payload.expiresAt).toISOString();
  }

  return {
    ok: true as const,
    code: duplicateBlocked ? "DUPLICATE_FILE" : canCommit ? "PREVIEW_READY" : "PREVIEW_BLOCKED",
    message: duplicateBlocked
      ? "These exact file bytes already exist and cannot create another import."
      : canCommit
        ? "Spotify export preview is ready for confirmation."
        : "The file requires correction before it can be committed.",
    previewToken,
    previewId,
    expiresAt,
    detectedType: result.detectedType,
    performanceLabel: result.dataLabel,
    fileHash: result.fileMetadata.sha256,
    duplicateFile: Boolean(existing),
    existingImport: existing ? importPublicSummary(existing) : null,
    duplicateRecommendation: existing
      ? existing.status === "FAILED" ? "REPROCESS_EXISTING" : existing.status === "WITHDRAWN" ? "REVIEW_WITHDRAWN_IMPORT" : "OPEN_EXISTING_IMPORT"
      : null,
    parserVersion: result.parserVersion,
    normalizationVersion: result.normalizationVersion,
    originalFilename: fileName,
    safeDisplayFilename: sanitizeSpotifyDisplayValue(fileName).safeValue,
    fileSizeBytes: bytes.byteLength,
    dateRange: result.dateRange,
    previewPeriod: result.previewPeriod,
    requiresPeriodConfirmation: result.requiresPeriodConfirmation,
    counts: {
      total: result.rowCount,
      structurallyValid: result.rowCount - result.rejectedCount,
      accepted: result.acceptedCount,
      warnings: result.warningCount,
      rejected: result.rejectedCount,
      unmatched: result.unmatchedCount
    },
    rowPreview,
    rowPreviewTruncated: result.rows.length > SPOTIFY_IMPORT_ROW_PREVIEW_LIMIT,
    blockingErrors: result.blockingErrors,
    fileWarnings: result.fileWarnings,
    requiredActions: requiredActions(result, duplicateBlocked),
    overlaps: artist ? await findOverlaps(result, artist.id, release?.id ?? null) : [],
    candidateArtist: artist,
    candidateRelease: release,
    reconciliation: previewReconciliation
  };
}

function validateIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(normalized)) {
    throw new AdminError("Client idempotency key must be 8-200 safe characters.", {code: "VALIDATION", status: 400});
  }
  return normalized;
}

function validateConfirmedPeriod(start: string | null | undefined, end: string | null | undefined) {
  const periodStart = start ? parseSpotifyDateOnly(start) : null;
  const periodEnd = end ? parseSpotifyDateOnly(end) : null;
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    throw new AdminError("A valid report period with start on or before end is required.", {code: "MISSING_CONFIRMATION", status: 400});
  }
  return {periodStart, periodEnd};
}

function hasAcknowledgementWarnings(result: SpotifyExportParseResult) {
  return [...result.fileWarnings, ...result.rows.flatMap(({warnings}) => warnings)]
    .some(({code}) => code !== "UTF8_BOM_REMOVED" && code !== "PERIOD_CONFIRMATION_REQUIRED");
}

async function validArtist(id: string | null | undefined) {
  if (!id?.trim()) throw new AdminError("Artist confirmation is required.", {code: "MISSING_CONFIRMATION", status: 400});
  const artist = await prisma.artistProfile.findUnique({where: {id: id.trim()}});
  if (!artist || artist.workflowStatus === "ARCHIVED") {
    throw new AdminError("The selected artist is unavailable for analytics imports.", {code: "INVALID_MAPPING", status: 400});
  }
  return artist;
}

async function validRelease(id: string | null | undefined, artistProfileId: string) {
  if (!id?.trim()) throw new AdminError("A confirmed release is required.", {code: "MISSING_CONFIRMATION", status: 400});
  const release = await prisma.release.findUnique({where: {id: id.trim()}});
  if (!release) throw new AdminError("The selected release does not exist.", {code: "INVALID_MAPPING", status: 400});
  if (release.primaryArtistProfileId && release.primaryArtistProfileId !== artistProfileId) {
    throw new AdminError("The selected release belongs to a different artist profile.", {code: "INVALID_MAPPING", status: 400});
  }
  return release;
}

type ReconciliationEntry = {
  key: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  sourceValue: number | null;
  comparableValue: number | null;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  severity: "ALIGNED" | "WARNING" | "HIGH" | "UNAVAILABLE";
  message: string;
};

function comparison(key: string, sourceValue: number, comparableValue: number | null, label: string): ReconciliationEntry {
  if (comparableValue === null) return {key, status: "UNAVAILABLE", sourceValue, comparableValue: null, absoluteDifference: null, percentageDifference: null, severity: "UNAVAILABLE", message: `${label} comparison is unavailable.`};
  const absoluteDifference = sourceValue - comparableValue;
  const percentageDifference = comparableValue === 0 ? null : (absoluteDifference / comparableValue) * 100;
  const magnitude = Math.abs(percentageDifference ?? (absoluteDifference === 0 ? 0 : 100));
  const warning = Number(process.env.ANALYTICS_RECONCILIATION_WARNING_PERCENT) || 5;
  const high = Number(process.env.ANALYTICS_RECONCILIATION_HIGH_PERCENT) || 20;
  return {key, status: "AVAILABLE", sourceValue, comparableValue, absoluteDifference, percentageDifference, severity: magnitude >= high ? "HIGH" : magnitude >= warning ? "WARNING" : "ALIGNED", message: `${label} differs by ${absoluteDifference} (${percentageDifference === null ? "percentage unavailable" : `${percentageDifference.toFixed(2)}%`}).`};
}

async function buildReconciliation(result: SpotifyExportParseResult, artistProfileId: string, releaseId: string | null, period: {periodStart: string; periodEnd: string} | null) {
  const entries: ReconciliationEntry[] = [];
  const rows = result.rows.flatMap(({normalizedValues}) => normalizedValues ? [normalizedValues] : []);
  if (result.detectedType === "SONGS_PERIOD" && period) {
    const current = await readCurrentAnalyticsDataset(artistProfileId);
    const artistRows = current.artistMetricObservations.filter(({metricDate}) => {
      const date = metricDate.toISOString().slice(0, 10);
      return date >= period.periodStart && date <= period.periodEnd;
    });
    const comparableStreams = artistRows.length ? artistRows.reduce((sum, row) => sum + row.streams, 0) : null;
    const comparableSaves = artistRows.length ? artistRows.reduce((sum, row) => sum + row.saves, 0) : null;
    entries.push(comparison("SONGS_VS_ARTIST_STREAMS", rows.reduce((sum, row) => sum + ("streams" in row ? row.streams : 0), 0), comparableStreams, "Song-period streams versus artist timeline streams"));
    entries.push(comparison("SONGS_VS_ARTIST_SAVES", rows.reduce((sum, row) => sum + ("saves" in row ? row.saves : 0), 0), comparableSaves, "Song-period saves versus artist timeline saves"));
  } else if (result.detectedType === "TRACK_STREAM_TIMELINE" && releaseId && result.dateRange) {
    const matches = await prisma.songPeriodSnapshot.findMany({
      where: {releaseId, periodStart: dateOnlyToDate(result.dateRange.minimumDate), periodEnd: dateOnlyToDate(result.dateRange.maximumDate), import: {status: "IMPORTED", withdrawnAt: null, replacedByImportId: null}},
      include: {import: {select: {acceptedAt: true}}}
    });
    matches.sort((a, b) => (b.import.acceptedAt?.getTime() ?? 0) - (a.import.acceptedAt?.getTime() ?? 0));
    entries.push(comparison("TRACK_VS_SONG_STREAMS", rows.reduce((sum, row) => sum + ("streams" in row ? row.streams : 0), 0), matches[0]?.streams ?? null, "Track timeline streams versus song-period streams"));
  } else if (result.detectedType === "PLAYLISTS_PERIOD" && period) {
    const current = await readCurrentAnalyticsDataset(artistProfileId);
    const songRows = current.songPeriodSnapshots.filter(({periodStart, periodEnd}) =>
      periodStart.toISOString().slice(0, 10) === period.periodStart &&
      periodEnd.toISOString().slice(0, 10) === period.periodEnd
    );
    const playlistStreams = rows.reduce((sum, row) => sum + ("streams" in row ? row.streams : 0), 0);
    const songStreams = songRows.length ? songRows.reduce((sum, row) => sum + row.streams, 0) : null;
    const ratio = songStreams && songStreams > 0 ? (playlistStreams / songStreams) * 100 : null;
    entries.push({key: "PLAYLIST_SHARE_OF_SONG_STREAMS", status: ratio === null ? "UNAVAILABLE" : "AVAILABLE", sourceValue: playlistStreams, comparableValue: songStreams, absoluteDifference: null, percentageDifference: ratio, severity: ratio === null ? "UNAVAILABLE" : "ALIGNED", message: ratio === null ? "Playlist share of song streams is unavailable." : `Playlist streams are ${ratio.toFixed(2)}% of song-period streams.`});
  }
  return {thresholds: {warningPercent: Number(process.env.ANALYTICS_RECONCILIATION_WARNING_PERCENT) || 5, highPercent: Number(process.env.ANALYTICS_RECONCILIATION_HIGH_PERCENT) || 20}, entries};
}

function parserSummary(result: SpotifyExportParseResult) {
  return {
    detectedType: result.detectedType,
    parserVersion: result.parserVersion,
    normalizationVersion: result.normalizationVersion,
    counts: {rowCount: result.rowCount, acceptedCount: result.acceptedCount, warningCount: result.warningCount, rejectedCount: result.rejectedCount, unmatchedCount: result.unmatchedCount},
    dateRange: result.dateRange,
    missingDates: result.missingDates,
    fileWarnings: result.fileWarnings,
    blockingErrors: result.blockingErrors
  };
}

export async function commitSpotifyImport(input: SpotifyCommitInput) {
  const now = input.now ?? new Date();
  const idempotencyKey = validateIdempotencyKey(input.clientIdempotencyKey);
  const replay = await prisma.analyticsImport.findUnique({where: {commitIdempotencyKey: idempotencyKey}});
  const token = readSpotifyPreviewToken(input.previewToken);
  if (!token) throw new AdminError("Preview token is invalid or has been tampered with.", {code: "INVALID_PREVIEW", status: 400});
  if (token.userId !== input.actor.userId) throw new AdminError("This preview belongs to another administrator.", {code: "FORBIDDEN", status: 403});
  if (token.expiresAt <= now.getTime()) throw new AdminError("Preview has expired. Create a new preview.", {code: "EXPIRED_PREVIEW", status: 410});
  if (replay) {
    if (replay.fileHash !== token.fileHash) throw new AdminError("This idempotency key was already used for another file.", {code: "CONFLICT", status: 409});
    return {ok: true as const, code: "IMPORT_COMMIT_REPLAYED", message: "The prior successful import was returned.", importId: replay.id, replayed: true};
  }
  if (token.parserVersion !== SPOTIFY_EXPORT_PARSER_VERSION || token.normalizationVersion !== SPOTIFY_EXPORT_NORMALIZATION_VERSION) {
    throw new AdminError("Parser or normalization version changed. Create a new preview.", {code: "INVALID_PREVIEW", status: 409});
  }
  const alreadyImported = await prisma.analyticsImport.findUnique({where: {fileHash: token.fileHash}});
  if (alreadyImported) {
    if (alreadyImported.commitIdempotencyKey === idempotencyKey) {
      return {ok: true as const, code: "IMPORT_COMMIT_REPLAYED", message: "The concurrent successful import was returned.", importId: alreadyImported.id, replayed: true};
    }
    throw new AdminError("These exact file bytes already exist as another import.", {code: "DUPLICATE_FILE", status: 409});
  }

  let rawBytes: Buffer;
  try {
    rawBytes = await readAssetBuffer("analytics-preview", token.temporaryRawFileReference, "private");
  } catch {
    throw new AdminError("The private preview file is unavailable.", {code: "RAW_FILE_UNAVAILABLE", status: 410});
  }
  if (rawBytes.byteLength !== token.sizeBytes || hashRawSpotifyFile(rawBytes) !== token.fileHash) {
    throw new AdminError("Preview file integrity check failed.", {code: "INVALID_PREVIEW", status: 409});
  }
  const result = parseSpotifyExport({fileName: token.originalFileName, bytes: rawBytes, mimeType: token.mimeType, previewPeriod: token.previewPeriod});
  if (result.parserVersion !== token.parserVersion || result.normalizationVersion !== token.normalizationVersion || checksumSpotifyPreviewResult(result) !== token.parsedResultChecksum) {
    throw new AdminError("Preview contents no longer match the trusted parse result.", {code: "INVALID_PREVIEW", status: 409});
  }
  if (!result.detectedType || result.detectedType !== token.detectedType || result.blockingErrors.length || result.rejectedCount) {
    throw new AdminError("Rejected or blocking rows cannot be committed.", {code: "INVALID_FILE", status: 400});
  }
  if (hasAcknowledgementWarnings(result) && !input.acknowledgeWarnings) {
    throw new AdminError("Warnings must be acknowledged before commit.", {code: "MISSING_CONFIRMATION", status: 400});
  }

  let artistProfileId = input.artistProfileId?.trim() || "";
  let releaseId: string | null = null;
  let period: {periodStart: string; periodEnd: string} | null = null;
  if (result.detectedType === "TRACK_STREAM_TIMELINE") {
    if (!input.acknowledgeFilenameNotIdentity || !input.acknowledgeTrackStreamsNotRetention) {
      throw new AdminError("Track identity and stream-performance acknowledgements are required.", {code: "MISSING_CONFIRMATION", status: 400});
    }
    const requestedReleaseId = input.releaseId?.trim();
    const initialRelease = requestedReleaseId ? await prisma.release.findUnique({where: {id: requestedReleaseId}}) : null;
    artistProfileId = input.artistProfileId?.trim() || initialRelease?.primaryArtistProfileId || CANONICAL_ANALYTICS_ARTIST_ID;
    await validArtist(artistProfileId);
    releaseId = (await validRelease(requestedReleaseId, artistProfileId)).id;
  } else {
    artistProfileId = (await validArtist(artistProfileId)).id;
  }
  if (result.requiresPeriodConfirmation) period = validateConfirmedPeriod(input.periodStart, input.periodEnd);

  const normalizedRows = result.rows.flatMap((row) => row.normalizedValues ? [{rowNumber: row.originalRowNumber, value: row.normalizedValues}] : []);
  const songEvidence: Array<{originalRowNumber: number; exportedTitle: string; safeDisplayExportedTitle: string; exportedReleaseDate: string; decision: "MAPPED" | "UNMATCHED"; releaseId: string | null; normalizedValues: SpotifyNormalizedRow; originalValues: Record<string, string>; safeDisplayValues: Record<string, string>; appliedAliasId: string | null; mappingReason: string; unmatchedReason: string | null; unmatchedNote: string}> = [];
  if (result.detectedType === "SONGS_PERIOD") {
    const decisions = new Map<number, SpotifySongMappingDecision>();
    for (const decision of input.songMappings ?? []) {
      if (decisions.has(decision.originalRowNumber)) throw new AdminError("Each song row must have exactly one mapping decision.", {code: "INVALID_MAPPING", status: 400});
      decisions.set(decision.originalRowNumber, decision);
    }
    for (const row of normalizedRows) {
      const value = row.value;
      if (!("exportedTitle" in value)) continue;
      const parsedRow = result.rows.find(({originalRowNumber}) => originalRowNumber === row.rowNumber)!;
      let decision = decisions.get(row.rowNumber);
      let appliedAliasId: string | null = null;
      let mappingReason = "STAGE3_MANUAL_CONFIRMATION";
      if (!decision) {
        const scopeKey = buildReleaseAliasScope({artistProfileId, source: "SPOTIFY_FOR_ARTISTS", exportType: result.detectedType, exportedTitle: value.exportedTitle, exportedReleaseDate: value.exportedReleaseDate});
        const alias = await prisma.releaseImportAlias.findUnique({where: {activeScopeKey: scopeKey}, include: {release: {select: {primaryArtistProfileId: true}}}});
        if (alias) {
          if (alias.release.primaryArtistProfileId !== artistProfileId) throw new AdminError("A reusable alias points to a release owned by another artist.", {code: "ALIAS_CONFLICT", status: 409});
          decision = {originalRowNumber: row.rowNumber, releaseId: alias.releaseId};
          appliedAliasId = alias.id;
          mappingReason = "EXISTING_ALIAS_REUSED";
        }
      }
      if (!decision || Boolean(decision.releaseId) === Boolean(decision.leaveUnmatched)) {
        throw new AdminError(`Song row ${row.rowNumber} needs either a release mapping or an explicit unmatched decision.`, {code: "MISSING_CONFIRMATION", status: 400});
      }
      if (decision.releaseId) {
        const mapped = await validRelease(decision.releaseId, artistProfileId);
        songEvidence.push({originalRowNumber: row.rowNumber, exportedTitle: value.exportedTitle, safeDisplayExportedTitle: sanitizeSpotifyDisplayValue(value.exportedTitle).safeValue, exportedReleaseDate: value.exportedReleaseDate, decision: "MAPPED", releaseId: mapped.id, normalizedValues: value, originalValues: parsedRow.originalValues, safeDisplayValues: parsedRow.safeDisplayValues, appliedAliasId, mappingReason, unmatchedReason: null, unmatchedNote: ""});
      } else {
        const unmatchedReason = decision.unmatchedReason?.trim() || "USER_DEFERRED";
        if (!["RELEASE_NOT_IN_CATALOG", "AMBIGUOUS_MATCH", "WRONG_ARTIST", "DUPLICATE_EXPORT_ROW", "VERSION_NOT_SUPPORTED", "USER_DEFERRED", "OTHER"].includes(unmatchedReason)) throw new AdminError(`Song row ${row.rowNumber} has an invalid unmatched reason.`, {code: "INVALID_MAPPING", status: 400});
        songEvidence.push({originalRowNumber: row.rowNumber, exportedTitle: value.exportedTitle, safeDisplayExportedTitle: sanitizeSpotifyDisplayValue(value.exportedTitle).safeValue, exportedReleaseDate: value.exportedReleaseDate, decision: "UNMATCHED", releaseId: null, normalizedValues: value, originalValues: parsedRow.originalValues, safeDisplayValues: parsedRow.safeDisplayValues, appliedAliasId: null, mappingReason: "STAGE3_EXPLICIT_UNMATCHED", unmatchedReason, unmatchedNote: (decision.unmatchedNote || "").trim().slice(0, 500)});
      }
    }
    if ([...decisions.keys()].some((rowNumber) => !normalizedRows.some((row) => row.rowNumber === rowNumber))) throw new AdminError("Song mapping decisions contain unknown row numbers.", {code: "INVALID_MAPPING", status: 400});
  }

  const existingHash = await prisma.analyticsImport.findUnique({where: {fileHash: token.fileHash}});
  if (existingHash) {
    if (existingHash.commitIdempotencyKey === idempotencyKey) {
      return {ok: true as const, code: "IMPORT_COMMIT_REPLAYED", message: "The concurrent successful import was returned.", importId: existingHash.id, replayed: true};
    }
    throw new AdminError("These exact file bytes already exist as another import.", {code: "DUPLICATE_FILE", status: 409});
  }
  const replacement = input.replacementTargetImportId?.trim()
    ? await prisma.analyticsImport.findUnique({where: {id: input.replacementTargetImportId.trim()}})
    : null;
  if (input.replacementTargetImportId && (!replacement || replacement.status !== "IMPORTED" || replacement.withdrawnAt || replacement.replacedByImportId || replacement.artistProfileId !== artistProfileId || replacement.importType !== result.detectedType)) {
    throw new AdminError("Replacement target is no longer an active compatible import.", {code: "CONFLICT", status: 409});
  }

  const reconciliation = await buildReconciliation(result, artistProfileId, releaseId, period);
  const permanent = await storeAsset({kind: "analytics-raw", fileName: `${crypto.randomUUID()}.csv`, data: rawBytes, access: "private", contentType: token.mimeType || "text/csv"});
  const importId = crypto.randomUUID();
  const periodFromParser = parserPeriod(result);
  const mappedSongCount = songEvidence.filter(({decision}) => decision === "MAPPED").length;
  const unmatchedSongCount = songEvidence.filter(({decision}) => decision === "UNMATCHED").length;
  const resolvedReviewCounts = resolveFinalReviewCounts(result.detectedType, {
    total: result.rowCount,
    structurallyValid: result.rowCount - result.rejectedCount,
    accepted: result.acceptedCount,
    warnings: result.warningCount,
    rejected: result.rejectedCount,
    unmatched: result.unmatchedCount
  }, {
    releaseConfirmed: Boolean(releaseId),
    mappedSongRows: mappedSongCount,
    unmatchedSongRows: unmatchedSongCount,
    warningAcknowledgementRequired: hasAcknowledgementWarnings(result),
    warningsAcknowledged: Boolean(input.acknowledgeWarnings)
  });
  try {
    await prisma.$transaction(async (tx) => {
      await createAnalyticsImport({
        id: importId,
        source: "SPOTIFY_FOR_ARTISTS",
        importType: result.detectedType!,
        originalFilename: token.originalFileName,
        fileHash: token.fileHash,
        commitIdempotencyKey: idempotencyKey,
        artistProfileId,
        uploadedById: input.actor.userId,
        uploadedByUsername: input.actor.username,
        uploadedAt: now,
        status: "IMPORTED",
        reportingTimezone: "UTC",
        detectedPeriodStart: periodFromParser ? dateOnlyToDate(periodFromParser.start) : null,
        detectedPeriodEnd: periodFromParser ? dateOnlyToDate(periodFromParser.end) : null,
        userConfirmedPeriodStart: period ? dateOnlyToDate(period.periodStart) : null,
        userConfirmedPeriodEnd: period ? dateOnlyToDate(period.periodEnd) : null,
        periodDatesUserConfirmed: Boolean(period),
        rowCount: result.rowCount,
        acceptedRowCount: result.detectedType === "ARTIST_AUDIENCE_TIMELINE" ? result.rowCount : resolvedReviewCounts.accepted,
        rejectedRowCount: resolvedReviewCounts.rejected,
        unmatchedRowCount: result.detectedType === "SONGS_PERIOD" || result.detectedType === "TRACK_STREAM_TIMELINE" ? resolvedReviewCounts.unmatched : 0,
        warningCount: result.rows.filter(({warnings}) => warnings.length > 0).length,
        validationSummary: JSON.stringify({...parserSummary(result), reconciliation}),
        metadata: JSON.stringify({previewId: token.previewId, previewResultChecksum: token.parsedResultChecksum, reprocessSourceImportId: token.reprocessSourceImportId, confirmations: {acknowledgeWarnings: Boolean(input.acknowledgeWarnings), acknowledgeFilenameNotIdentity: Boolean(input.acknowledgeFilenameNotIdentity), acknowledgeTrackStreamsNotRetention: Boolean(input.acknowledgeTrackStreamsNotRetention)}, temporaryMappings: songEvidence, mappingPolicy: "NORMALIZED_ROWS_WITH_SCOPED_ALIAS_REUSE"}),
        normalizationVersion: result.normalizationVersion,
        rawFileStorageDriver: getPrivateAssetStorageDriver(),
        rawFileStorageKey: permanent.storedPath,
        rawFileSizeBytes: rawBytes.byteLength,
        rawFileExpiresAt: new Date(now.getTime() + getRawAnalyticsFileRetentionDays() * 86_400_000),
        acceptedAt: now
      }, tx);

      const mappingRowIds = new Map<number, string>();
      if (result.detectedType === "SONGS_PERIOD") {
        for (const evidence of songEvidence) {
          const rowId = crypto.randomUUID();
          mappingRowIds.set(evidence.originalRowNumber, rowId);
          await tx.analyticsImportRow.create({data: {id: rowId, importId, sourceRowNumber: evidence.originalRowNumber, exportType: result.detectedType, rowIdentityKey: `${normalizeMappingTitle(evidence.exportedTitle)}|${evidence.exportedReleaseDate}`, originalValues: JSON.stringify(evidence.originalValues), safeDisplayValues: JSON.stringify(evidence.safeDisplayValues), normalizedValues: JSON.stringify(evidence.normalizedValues), structuralOutcome: "ACCEPTED", mappingStatus: evidence.decision === "MAPPED" ? "CONFIRMED" : "UNMATCHED", mappingReason: evidence.mappingReason, suggestedReleaseId: evidence.releaseId, confirmedReleaseId: evidence.releaseId, confirmedScopeKey: evidence.releaseId ? buildConfirmedMappingScope(importId, evidence.releaseId) : null, mappingConfidence: evidence.appliedAliasId ? "EXACT_ALIAS" : evidence.releaseId ? "EXACT_TITLE_UNIQUE" : "NO_MATCH", mappingEvidence: JSON.stringify({stage3Decision: evidence.decision, appliedAliasId: evidence.appliedAliasId}), appliedAliasId: evidence.appliedAliasId, confirmedById: evidence.releaseId ? input.actor.userId : null, confirmedByUsername: evidence.releaseId ? input.actor.username : "", confirmedAt: evidence.releaseId ? now : null, unmatchedReason: evidence.releaseId ? null : evidence.unmatchedReason, unmatchedNote: evidence.releaseId ? "" : evidence.unmatchedNote, unmatchedById: evidence.releaseId ? null : input.actor.userId, unmatchedByUsername: evidence.releaseId ? "" : input.actor.username, unmatchedAt: evidence.releaseId ? null : now, createdAt: now, updatedAt: now}});
          await tx.mappingAuditEvent.create({data: {id: crypto.randomUUID(), rowId, importId, aliasId: evidence.appliedAliasId, action: evidence.appliedAliasId ? "ALIAS_REUSED_DURING_IMPORT" : evidence.releaseId ? "CONFIRMED_DURING_IMPORT" : "UNMATCHED_DURING_IMPORT", newMappingStatus: evidence.releaseId ? "CONFIRMED" : "UNMATCHED", newReleaseId: evidence.releaseId, reason: evidence.mappingReason, evidence: JSON.stringify({sourceRowNumber: evidence.originalRowNumber}), actorId: input.actor.userId, actorUsername: input.actor.username, createdAt: now}});
        }
      }

      if (result.detectedType === "ARTIST_AUDIENCE_TIMELINE") {
        await appendArtistMetricObservations(normalizedRows.map(({value}) => {
          if (!("metricDate" in value) || !("listeners" in value)) throw new Error("Unexpected artist row shape.");
          return {importId, artistProfileId, metricDate: dateOnlyToDate(value.metricDate), listeners: value.listeners, monthlyListeners: value.monthlyListeners, monthlyActiveListeners: value.monthlyActiveListeners, streams: value.streams, playlistAdds: value.playlistAdds, saves: value.saves, followers: value.followers};
        }), tx);
      } else if (result.detectedType === "TRACK_STREAM_TIMELINE") {
        await appendTrackMetricObservations(normalizedRows.map(({value}) => {
          if (!("metricDate" in value) || "listeners" in value) throw new Error("Unexpected track row shape.");
          return {importId, releaseId: releaseId!, spotifyTrackId: null, metricDate: dateOnlyToDate(value.metricDate), streams: value.streams, listeners: null, saves: null, playlistAdds: null};
        }), tx);
      } else if (result.detectedType === "SONGS_PERIOD") {
        const byRow = new Map(normalizedRows.map((row) => [row.rowNumber, row.value]));
        await appendSongPeriodSnapshots(songEvidence.filter(({decision}) => decision === "MAPPED").map((evidence) => {
          const value = byRow.get(evidence.originalRowNumber);
          if (!value || !("exportedTitle" in value)) throw new Error("Unexpected song row shape.");
          return {importId, releaseId: evidence.releaseId!, periodStart: dateOnlyToDate(period!.periodStart), periodEnd: dateOnlyToDate(period!.periodEnd), exportedTitle: value.exportedTitle, exportedReleaseDate: dateOnlyToDate(value.exportedReleaseDate), listeners: value.listeners, streams: value.streams, saves: value.saves, mappingRowId: mappingRowIds.get(evidence.originalRowNumber)!};
        }), tx);
      } else {
        await appendPlaylistPeriodSnapshots(normalizedRows.map(({value}) => {
          if (!("playlistTitle" in value)) throw new Error("Unexpected playlist row shape.");
          return {importId, playlistTitle: value.playlistTitle, playlistAuthor: value.playlistAuthor, playlistSpotifyId: null, periodStart: dateOnlyToDate(period!.periodStart), periodEnd: dateOnlyToDate(period!.periodEnd), listeners: value.listeners, streams: value.streams, dateAdded: value.dateAdded ? dateOnlyToDate(value.dateAdded) : null};
        }), tx);
      }
      if (replacement) {
        const updated = await tx.analyticsImport.updateMany({where: {id: replacement.id, status: "IMPORTED", withdrawnAt: null, replacedByImportId: null}, data: {status: "REPLACED", replacedByImportId: importId, updatedAt: now}});
        if (updated.count !== 1) throw new AdminError("Replacement target changed during commit.", {code: "CONFLICT", status: 409});
      }
    });
  } catch (error) {
    await deleteAsset("analytics-raw", permanent.storedPath);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.analyticsImport.findFirst({where: {OR: [{fileHash: token.fileHash}, {commitIdempotencyKey: idempotencyKey}]}});
      if (winner?.commitIdempotencyKey === idempotencyKey && winner.fileHash === token.fileHash) return {ok: true as const, code: "IMPORT_COMMIT_REPLAYED", message: "The concurrent successful import was returned.", importId: winner.id, replayed: true};
      throw new AdminError("This file or idempotency key was committed concurrently.", {code: winner?.fileHash === token.fileHash ? "DUPLICATE_FILE" : "CONFLICT", status: 409});
    }
    if (error instanceof AdminError) throw error;
    throw new AdminError("The analytics import transaction failed; no database rows were committed.", {code: "TRANSACTION_FAILURE", status: 500, retryable: true});
  }
  await deleteAsset("analytics-preview", token.temporaryRawFileReference);
  return {ok: true as const, code: "IMPORT_COMMITTED", message: "Spotify analytics import committed successfully.", importId, replayed: false, reconciliation};
}

function safeJson(value: string) {
  try { return JSON.parse(value) as unknown; } catch { return {}; }
}

function rawAvailability(record: {rawFileStorageKey: string | null; rawFileDeletedAt: Date | null; rawFileExpiresAt: Date | null}, now = new Date()) {
  if (!record.rawFileStorageKey) return "NOT_STORED";
  if (record.rawFileDeletedAt) return "DELETED";
  if (record.rawFileExpiresAt && record.rawFileExpiresAt <= now) return "EXPIRED";
  return "AVAILABLE";
}

export async function listSpotifyImports(filters: {page?: number; pageSize?: number; status?: string; importType?: string; artistProfileId?: string; uploadedFrom?: Date; uploadedTo?: Date; withdrawn?: boolean} = {}) {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page!)) : 1;
  const pageSize = Number.isFinite(filters.pageSize) ? Math.min(100, Math.max(1, Math.floor(filters.pageSize!))) : 25;
  if (filters.uploadedFrom && Number.isNaN(filters.uploadedFrom.getTime())) throw new AdminError("uploaded_from must be a valid date.", {code: "VALIDATION", status: 400});
  if (filters.uploadedTo && Number.isNaN(filters.uploadedTo.getTime())) throw new AdminError("uploaded_to must be a valid date.", {code: "VALIDATION", status: 400});
  const where: Prisma.AnalyticsImportWhereInput = {
    ...(filters.status ? {status: filters.status} : {}),
    ...(filters.importType ? {importType: filters.importType} : {}),
    ...(filters.artistProfileId ? {artistProfileId: filters.artistProfileId} : {}),
    ...(filters.uploadedFrom || filters.uploadedTo ? {uploadedAt: {gte: filters.uploadedFrom, lte: filters.uploadedTo}} : {}),
    ...(filters.withdrawn === true ? {withdrawnAt: {not: null}} : filters.withdrawn === false ? {withdrawnAt: null} : {})
  };
  const [total, records] = await Promise.all([
    prisma.analyticsImport.count({where}),
    prisma.analyticsImport.findMany({where, orderBy: [{uploadedAt: "desc"}, {id: "desc"}], skip: (page - 1) * pageSize, take: pageSize, select: {id: true, source: true, importType: true, originalFilename: true, fileHash: true, artistProfileId: true, uploadedByUsername: true, uploadedAt: true, status: true, rowCount: true, acceptedRowCount: true, rejectedRowCount: true, unmatchedRowCount: true, warningCount: true, acceptedAt: true, detectedPeriodStart: true, detectedPeriodEnd: true, userConfirmedPeriodStart: true, userConfirmedPeriodEnd: true, withdrawnAt: true, replacedByImportId: true, rawFileStorageKey: true, rawFileExpiresAt: true, rawFileDeletedAt: true}})
  ]);
  return {page, pageSize, total, items: records.map(({rawFileStorageKey, ...record}) => ({...record, fileHash: record.fileHash, originalFilename: record.originalFilename, uploadedAt: record.uploadedAt.toISOString(), acceptedAt: record.acceptedAt?.toISOString() ?? null, detectedPeriodStart: record.detectedPeriodStart?.toISOString().slice(0, 10) ?? null, detectedPeriodEnd: record.detectedPeriodEnd?.toISOString().slice(0, 10) ?? null, userConfirmedPeriodStart: record.userConfirmedPeriodStart?.toISOString().slice(0, 10) ?? null, userConfirmedPeriodEnd: record.userConfirmedPeriodEnd?.toISOString().slice(0, 10) ?? null, withdrawnAt: record.withdrawnAt?.toISOString() ?? null, rawFileExpiresAt: record.rawFileExpiresAt?.toISOString() ?? null, rawFileDeletedAt: record.rawFileDeletedAt?.toISOString() ?? null, rawFileAvailability: rawAvailability({...record, rawFileStorageKey})}))};
}

export async function readSpotifyImportDetail(id: string) {
  const record = await prisma.analyticsImport.findUnique({
    where: {id},
    include: {artistProfile: {select: {id: true, displayName: true, slug: true}}, replacedBy: {select: {id: true, status: true}}, replaces: {select: {id: true, status: true}}, _count: {select: {artistMetricObservations: true, trackMetricObservations: true, songPeriodSnapshots: true, playlistPeriodSnapshots: true}}}
  });
  if (!record) throw new AdminError("Analytics import was not found.", {code: "NOT_FOUND", status: 404});
  const {rawFileStorageKey, commitIdempotencyKey, validationSummary, metadata, ...safe} = record;
  return {...safe, uploadedAt: record.uploadedAt.toISOString(), acceptedAt: record.acceptedAt?.toISOString() ?? null, withdrawnAt: record.withdrawnAt?.toISOString() ?? null, rawFileExpiresAt: record.rawFileExpiresAt?.toISOString() ?? null, rawFileDeletedAt: record.rawFileDeletedAt?.toISOString() ?? null, detectedPeriodStart: record.detectedPeriodStart?.toISOString().slice(0, 10) ?? null, detectedPeriodEnd: record.detectedPeriodEnd?.toISOString().slice(0, 10) ?? null, userConfirmedPeriodStart: record.userConfirmedPeriodStart?.toISOString().slice(0, 10) ?? null, userConfirmedPeriodEnd: record.userConfirmedPeriodEnd?.toISOString().slice(0, 10) ?? null, validationSummary: safeJson(validationSummary), metadata: safeJson(metadata), rawFileAvailability: rawAvailability(record), dataProvenance: {source: record.source, fileHash: record.fileHash, parserVersion: (safeJson(validationSummary) as {parserVersion?: string}).parserVersion ?? null, normalizationVersion: record.normalizationVersion}};
}

export async function withdrawSpotifyImport(id: string, actor: SpotifyImportActor, reason: string, now = new Date()) {
  const normalizedReason = reason.trim().slice(0, 500);
  if (!normalizedReason) throw new AdminError("Withdrawal reason is required.", {code: "VALIDATION", status: 400});
  return prisma.$transaction(async (tx) => {
    const current = await tx.analyticsImport.findUnique({where: {id}});
    if (!current) throw new AdminError("Analytics import was not found.", {code: "NOT_FOUND", status: 404});
    if (current.status === "WITHDRAWN" || current.withdrawnAt) return {ok: true as const, code: "IMPORT_ALREADY_WITHDRAWN", message: "Import was already withdrawn.", importId: id, replayed: true};
    if (current.status !== "IMPORTED") throw new AdminError("Only an active imported dataset can be withdrawn.", {code: "CONFLICT", status: 409});
    const updated = await tx.analyticsImport.updateMany({where: {id, status: "IMPORTED", withdrawnAt: null}, data: {status: "WITHDRAWN", withdrawnAt: now, withdrawnById: actor.userId, withdrawalReason: normalizedReason, updatedAt: now}});
    if (updated.count !== 1) {
      const latest = await tx.analyticsImport.findUnique({where: {id}});
      if (latest?.status === "WITHDRAWN" || latest?.withdrawnAt) return {ok: true as const, code: "IMPORT_ALREADY_WITHDRAWN", message: "Import was already withdrawn.", importId: id, replayed: true};
      throw new AdminError("Import changed during withdrawal. Refresh and retry.", {code: "CONFLICT", status: 409});
    }
    return {ok: true as const, code: "IMPORT_WITHDRAWN", message: "Import withdrawn; normalized history was preserved.", importId: id, replayed: false};
  });
}

export async function reprocessSpotifyImport(id: string, actor: SpotifyImportActor, now = new Date()) {
  const record = await prisma.analyticsImport.findUnique({where: {id}, include: {trackMetricObservations: {select: {releaseId: true}, take: 1}}});
  if (!record) throw new AdminError("Analytics import was not found.", {code: "NOT_FOUND", status: 404});
  if (rawAvailability(record, now) !== "AVAILABLE" || !record.rawFileStorageKey) throw new AdminError("The retained raw file has expired, was deleted, or is unavailable.", {code: "RAW_FILE_UNAVAILABLE", status: 410});
  let bytes: Buffer;
  try { bytes = await readAssetBuffer("analytics-raw", record.rawFileStorageKey, "private"); }
  catch { throw new AdminError("The retained raw file could not be read.", {code: "RAW_FILE_UNAVAILABLE", status: 410}); }
  return createSpotifyImportPreview({actor, fileName: record.originalFilename, mimeType: "text/csv", bytes, previewPeriod: record.userConfirmedPeriodStart && record.userConfirmedPeriodEnd ? {periodStart: record.userConfirmedPeriodStart.toISOString().slice(0, 10), periodEnd: record.userConfirmedPeriodEnd.toISOString().slice(0, 10)} : null, artistProfileId: record.artistProfileId, releaseId: record.trackMetricObservations[0]?.releaseId ?? null, reprocessSourceImportId: id, allowExistingHashForReprocess: true, now});
}

export async function listExpiredSpotifyPreviewFiles(now = new Date()) {
  const files = await listStoredAssetReferences("analytics-preview");
  return files.filter(({updatedAt}) => updatedAt.getTime() + SPOTIFY_PREVIEW_TTL_MS <= now.getTime());
}

export async function listExpiredSpotifyImportFiles(now = new Date()) {
  return prisma.analyticsImport.findMany({where: {rawFileStorageKey: {not: null}, rawFileDeletedAt: null, rawFileExpiresAt: {lte: now}}, select: {id: true, rawFileStorageDriver: true, rawFileSizeBytes: true, rawFileExpiresAt: true}});
}

export async function listOrphanedSpotifyRawFiles(now = new Date(), graceMs = 60 * 60 * 1000) {
  const [stored, imports] = await Promise.all([
    listStoredAssetReferences("analytics-raw"),
    prisma.analyticsImport.findMany({where: {rawFileStorageKey: {not: null}}, select: {rawFileStorageKey: true}})
  ]);
  const referenced = new Set(imports.flatMap(({rawFileStorageKey}) => rawFileStorageKey ? [rawFileStorageKey] : []));
  return stored.filter(({storedPath, updatedAt}) => !referenced.has(storedPath) && updatedAt.getTime() + graceMs <= now.getTime());
}
