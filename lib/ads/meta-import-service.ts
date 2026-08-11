import "server-only";

import {randomUUID} from "node:crypto";

import {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {AdminError} from "@/lib/server/admin-error-response";

const META_IMPORT_TRANSACTION_OPTIONS = {maxWait: 10_000, timeout: 60_000} as const;
import {deletePrivateObject, readPrivateObject, storePrivateObject} from "@/lib/server/private-object-storage";
import {
  buildMetaEvidenceBundle,
  META_EVIDENCE_NORMALIZATION_VERSION,
  META_EVIDENCE_PARSER_VERSION,
  resolveCanonicalDaily,
  type MetaEvidenceContext,
  type MetaEvidenceInputFile
} from "./meta-evidence-contract";
import {createMetaPreviewToken, readMetaPreviewToken} from "./meta-preview-token";
import {readCurrentMetaAccountTimezone} from "./meta-account-timezones";

export type MetaImportActor = {userId: string; username: string};

function retentionDays() {
  const value = Number(process.env.ADS_RAW_FILE_RETENTION_DAYS ?? 30);
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 30;
}
function date(value: string | null) { return value ? new Date(`${value}T00:00:00.000Z`) : null; }
function clean(value: string, max: number) { return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max); }
function validIdempotency(value: string) {
  const result = value.trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(result)) throw new AdminError("A valid import idempotency key is required.", {code: "VALIDATION", status: 400});
  return result;
}
function identityParts(identityKey: string) {
  const [accountId, campaignId, adSetId, adId, metricDate, metricFamily, dimensionA, dimensionB] = identityKey.split("|");
  if (metricFamily === "SPEND") return {accountId, campaignId, adSetId, adId, metricDate, currency: dimensionA, metricFamily, metricKey: "SPEND", attributionSetting: "", resultMetricKey: "NONE"};
  return {accountId, campaignId, adSetId, adId, metricDate, currency: "", metricFamily, metricKey: dimensionB || "NONE", attributionSetting: dimensionA || "UNSPECIFIED", resultMetricKey: dimensionB || "NONE"};
}

export async function createMetaImportPreview(input: {
  actor: MetaImportActor;
  files: MetaEvidenceInputFile[];
  context: MetaEvidenceContext & {releaseId?: string | null; name?: string; notes?: string; batchType?: string};
  now?: Date;
}) {
  const now = input.now ?? new Date();
  let effectiveContext = input.context;
  let bundle = buildMetaEvidenceBundle(input.files, effectiveContext);
  const reviewedTimezone = bundle.accountId ? await readCurrentMetaAccountTimezone(bundle.accountId) : null;
  if (reviewedTimezone && bundle.normalizedTimezone && reviewedTimezone.ianaTimezone !== bundle.normalizedTimezone) {
    throw new AdminError("The export timezone conflicts with the reviewed Meta account timezone. Resolve the account setting before previewing this import.", {code: "TIMEZONE_CONFLICT_REVIEW_REQUIRED", status: 409});
  }
  if (reviewedTimezone && !bundle.normalizedTimezone) {
    effectiveContext = {...input.context, manualTimezone: reviewedTimezone.ianaTimezone, manualTimezoneOrigin: reviewedTimezone.sourceOrigin as "META_SOURCE" | "USER_CONFIRMED"};
    bundle = buildMetaEvidenceBundle(input.files, effectiveContext);
  }
  const [existingBundle, existingFiles] = await Promise.all([
    prisma.adImportBatch.findFirst({where: {bundleHash: bundle.bundleHash, importState: "ACCEPTED"}, select: {id: true}}),
    prisma.metaImportFile.findMany({where: {sha256: {in: bundle.files.map((file) => file.sha256)}}, select: {sha256: true, importBatchId: true}})
  ]);
  const duplicateHashes = [...new Set(existingFiles.map((file) => file.sha256))];
  const duplicateClassification = existingBundle ? "EXACT_BUNDLE" : duplicateHashes.length ? "PARTIAL_FILE_DUPLICATE" : "NONE";
  const references: Array<{key: string; sha256: string; fileName: string; sizeBytes: number}> = [];
  try {
    if (duplicateClassification === "NONE") {
      for (const [index, file] of input.files.entries()) {
        const stored = await storePrivateObject({namespace: "ads-preview", data: Buffer.from(file.bytes)});
        references.push({key: stored.key, sha256: bundle.files[index].sha256, fileName: bundle.files[index].sanitizedFileName, sizeBytes: file.bytes.byteLength});
      }
    }
  } catch (error) {
    await Promise.all(references.map(({key}) => deletePrivateObject("ads-preview", key).catch(() => undefined)));
    throw error;
  }
  const created = duplicateClassification === "NONE" ? createMetaPreviewToken({
    userId: input.actor.userId, bundleHash: bundle.bundleHash, fileReferences: references,
    context: {
      attributionSetting: clean(effectiveContext.attributionSetting, 300), sourceAsOf: effectiveContext.sourceAsOf?.trim() || null,
      sourceAsOfOrigin: effectiveContext.sourceAsOf?.trim() ? (effectiveContext.sourceAsOfOrigin ?? "USER_CONFIRMED") : "UNKNOWN",
      confirmedCurrency: effectiveContext.confirmedCurrency?.trim().toUpperCase() || null,
      manualTimezone: effectiveContext.manualTimezone?.trim() || null, manualTimezoneOrigin: effectiveContext.manualTimezoneOrigin ?? null, expectedGranularity: effectiveContext.expectedGranularity ?? null,
      releaseId: input.context.releaseId?.trim() || null, name: clean(input.context.name ?? "", 300), notes: clean(input.context.notes ?? "", 4000),
      batchType: clean(input.context.batchType ?? (bundle.sourceGranularity === "DAILY" ? "Daily Export" : "Rolling Snapshot"), 120)
    }
  }, now) : null;
  return {
    ok: true as const,
    code: existingBundle ? "DUPLICATE_BUNDLE" : duplicateHashes.length ? "PARTIAL_DUPLICATE_BUNDLE" : "PREVIEW_READY",
    message: existingBundle ? "This exact Meta export bundle is already imported." : duplicateHashes.length ? "One or more exact source files already belong to an import." : "Meta export preview is ready for final review.",
    canCommit: duplicateClassification === "NONE", duplicateClassification, existingImportId: existingBundle?.id ?? existingFiles[0]?.importBatchId ?? null,
    previewToken: created?.token ?? null, previewId: created?.payload.previewId ?? null,
    expiresAt: created ? new Date(created.payload.expiresAt).toISOString() : null,
    bundle: {
      bundleHash: bundle.bundleHash, sourceGranularity: bundle.sourceGranularity, campaignIntervalEligible: bundle.campaignIntervalEligible,
      campaignEligibility: bundle.campaignEligibility, eligibilityReasons: bundle.eligibilityReasons, coreTimingEligible: bundle.coreTimingEligible,
      coreTimingEligibilityReasons: bundle.coreTimingEligibilityReasons, enrichmentCompatibility: bundle.enrichmentCompatibility, enrichmentWarnings: bundle.enrichmentWarnings, accountId: bundle.accountId,
      accountName: bundle.accountName, accountTimezone: bundle.accountTimezone, normalizedTimezone: bundle.normalizedTimezone,
      timezoneSource: bundle.timezoneSource, currency: bundle.currency, currencyOrigin: bundle.currencyOrigin, reportingStart: bundle.reportingStart, reportingEnd: bundle.reportingEnd,
      commonReportingStart: bundle.commonReportingStart, commonReportingEnd: bundle.commonReportingEnd, commonObservedDateCount: bundle.commonObservedDateCount,
      sourceAsOf: bundle.sourceAsOf, sourceAsOfOrigin: bundle.sourceAsOfOrigin, warnings: bundle.warnings, rowCount: bundle.files.reduce((sum, file) => sum + file.rowCount, 0),
      mergedDailyRowCount: bundle.mergedDailyRows.length, metricObservationCount: bundle.metricObservations.length,
      viewConflicts: bundle.viewConflicts.map(({field, code, conflictClass, primaryView, observedViews, blocksCampaignEligibility, blocksCoreTimingEligibility, blocksEnrichmentCompatibility}) => ({field, code, conflictClass, primaryView, observedViews, blocksCampaignEligibility, blocksCoreTimingEligibility, blocksEnrichmentCompatibility})),
      files: bundle.files.map(({sha256, sanitizedFileName, sourceView, viewRole, rowCount, reportingStart, reportingEnd, observedDateCount, expectedDateCount, adCount, missingCoreDateCount, coverageState, sizeBytes, warnings}) => ({sha256, sanitizedFileName, sourceView, viewRole, rowCount, reportingStart, reportingEnd, observedDateCount, expectedDateCount, adCount, missingCoreDateCount, coverageState, sizeBytes, warnings}))
    }
  };
}

async function recalculateResolution(tx: Prisma.TransactionClient, identityKey: string, now: Date) {
  const observations = await tx.metaDailySourceObservation.findMany({
    where: {identityKey, importBatch: {coreTimingEligible: true, importState: "ACCEPTED", withdrawnAt: null}},
    include: {importBatch: {select: {importState: true}}}
  });
  const resolved = resolveCanonicalDaily(observations.map((item) => ({
    ...item, metricDate: item.metricDate.toISOString().slice(0, 10), sourceFileHash: "", sourceFileName: "", sourceRowNumber: 0, sourceView: "delivery" as const,
    reportingStart: item.sourceReportingDate, reportingEnd: item.sourceReportingDate, timezoneSource: item.timezoneSource as "META_SOURCE" | "USER_CONFIRMED" | "UNKNOWN",
    spend: item.spend, currencyOrigin: item.currencyOrigin as "SOURCE_COLUMN" | "METRIC_HEADER" | "USER_CONFIRMED" | "UNKNOWN", sourceAsOf: item.sourceAsOf?.toISOString() ?? null, sourceAsOfOrigin: item.sourceAsOfOrigin as "META_EXPORT" | "USER_CONFIRMED" | "IMPORT_ACCEPTED_FALLBACK" | "UNKNOWN", acceptedAt: item.acceptedAt.toISOString(), importState: item.importBatch.importState as "ACCEPTED"
  })))[0];
  const existing = await tx.metaDailyResolution.findUnique({where: {identityKey}});
  if (!resolved) {
    if (existing) await tx.metaDailyResolution.delete({where: {id: existing.id}});
    return;
  }
  const parts = identityParts(identityKey);
  const resolution = existing
    ? await tx.metaDailyResolution.update({where: {id: existing.id}, data: {currentObservationId: resolved.winner.id, currencyOrigin: resolved.winner.currencyOrigin, resolvedAt: now, resolutionVersion: {increment: existing.currentObservationId === resolved.winner.id ? 0 : 1}}})
    : await tx.metaDailyResolution.create({data: {id: randomUUID(), identityKey, ...parts, currencyOrigin: resolved.winner.currencyOrigin, metricDate: date(parts.metricDate)!, currentObservationId: resolved.winner.id, resolvedAt: now}});
  if (!existing || existing.currentObservationId !== resolved.winner.id) {
    await tx.metaDailyResolutionEvent.create({data: {id: randomUUID(), resolutionId: resolution.id, previousObservationId: existing?.currentObservationId ?? null, currentObservationId: resolved.winner.id, reason: existing ? "AUTHORITATIVE_SOURCE_SUPERSEDED" : "INITIAL_RESOLUTION", precedenceEvidence: JSON.stringify({precedence: resolved.precedence}), createdAt: now}});
  }
}

export async function commitMetaImport(input: {
  actor: MetaImportActor;
  previewToken: string;
  clientIdempotencyKey: string;
  confirmFinalReview: boolean;
  acknowledgeWarnings: boolean;
  replacementTargetBatchId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date(); const idempotencyKey = validIdempotency(input.clientIdempotencyKey);
  const replay = await prisma.adImportBatch.findUnique({where: {idempotencyKey}});
  if (replay) return {ok: true as const, code: "IMPORT_COMMIT_REPLAYED", importId: replay.id, replayed: true};
  const token = readMetaPreviewToken(input.previewToken);
  if (!token) throw new AdminError("Preview token is invalid or has been tampered with.", {code: "INVALID_PREVIEW", status: 400});
  if (token.userId !== input.actor.userId) throw new AdminError("This preview belongs to another administrator.", {code: "FORBIDDEN", status: 403});
  if (token.expiresAt <= now.getTime()) throw new AdminError("Preview has expired.", {code: "EXPIRED_PREVIEW", status: 410});
  if (!input.confirmFinalReview) throw new AdminError("Final review confirmation is required.", {code: "MISSING_CONFIRMATION", status: 400});
  const rawFiles: MetaEvidenceInputFile[] = [];
  for (const reference of token.fileReferences) {
    const stored = await readPrivateObject("ads-preview", reference.key, {expectedSha256: reference.sha256});
    if (stored.buffer.byteLength !== reference.sizeBytes) throw new AdminError("Preview file integrity check failed.", {code: "INVALID_PREVIEW", status: 409});
    rawFiles.push({fileName: reference.fileName, bytes: stored.buffer});
  }
  const bundle = buildMetaEvidenceBundle(rawFiles, token.context);
  if (bundle.bundleHash !== token.bundleHash) throw new AdminError("Preview bundle integrity check failed.", {code: "INVALID_PREVIEW", status: 409});
  if (bundle.warnings.length && !input.acknowledgeWarnings) throw new AdminError("Import warnings must be acknowledged.", {code: "MISSING_CONFIRMATION", status: 400});
  const exact = await prisma.adImportBatch.findFirst({where: {bundleHash: bundle.bundleHash, importState: "ACCEPTED"}});
  if (exact) throw new AdminError("This exact Meta bundle is already imported.", {code: "DUPLICATE_FILE", status: 409});
  if (await prisma.metaImportFile.findFirst({where: {sha256: {in: bundle.files.map((file) => file.sha256)}}})) throw new AdminError("A source file was committed by another import.", {code: "CONFLICT", status: 409});
  if (token.context.releaseId && !(await prisma.release.findUnique({where: {id: token.context.releaseId}, select: {id: true}}))) throw new AdminError("The selected release no longer exists.", {code: "VALIDATION", status: 400});
  const replacement = input.replacementTargetBatchId ? await prisma.adImportBatch.findUnique({where: {id: input.replacementTargetBatchId}}) : null;
  if (input.replacementTargetBatchId && (!replacement || replacement.importState !== "ACCEPTED" || replacement.withdrawnAt)) throw new AdminError("Replacement target is not an active Meta import.", {code: "CONFLICT", status: 409});
  const permanent: Array<{key: string; sha256: string; sizeBytes: number}> = [];
  try {
    for (const file of rawFiles) {
      const stored = await storePrivateObject({namespace: "ads-raw", data: Buffer.from(file.bytes)});
      permanent.push({key: stored.key, sha256: stored.checksumSha256, sizeBytes: stored.sizeBytes});
    }
  } catch (error) {
    await Promise.all(permanent.map(({key}) => deletePrivateObject("ads-raw", key).catch(() => undefined))); throw error;
  }
  const importId = randomUUID();
  const effectiveSourceAsOf = bundle.sourceAsOf ? new Date(bundle.sourceAsOf) : now;
  const effectiveSourceAsOfOrigin = bundle.sourceAsOf ? bundle.sourceAsOfOrigin : "IMPORT_ACCEPTED_FALLBACK";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.adImportBatch.create({data: {
        id: importId, source: "meta", name: token.context.name, releaseId: token.context.releaseId, reportingStart: date(bundle.reportingStart), reportingEnd: date(bundle.reportingEnd),
        exportedAt: bundle.sourceAsOf ? new Date(bundle.sourceAsOf) : null, attributionSetting: token.context.attributionSetting, batchType: token.context.batchType,
        fileNames: JSON.stringify(bundle.files.map((file) => file.sanitizedFileName)), notes: token.context.notes, bundleHash: bundle.bundleHash, idempotencyKey,
        sourceGranularity: bundle.sourceGranularity, campaignIntervalEligible: bundle.coreTimingEligible,
        eligibilityReason: bundle.coreTimingEligible ? "CORE_TIMING_CONTRACT_SATISFIED" : bundle.coreTimingEligibilityReasons.join(","),
        coreTimingEligible: bundle.coreTimingEligible, coreTimingEligibilityReason: bundle.coreTimingEligible ? "CORE_TIMING_CONTRACT_SATISFIED" : bundle.coreTimingEligibilityReasons.join(","),
        enrichmentCompatibility: bundle.enrichmentCompatibility, enrichmentWarnings: JSON.stringify(bundle.enrichmentWarnings),
        coreTimingStart: date(bundle.reportingStart), coreTimingEnd: date(bundle.reportingEnd), commonCoverageStart: date(bundle.commonReportingStart), commonCoverageEnd: date(bundle.commonReportingEnd), commonCoverageDateCount: bundle.commonObservedDateCount,
        validationState: bundle.coreTimingEligible ? bundle.enrichmentCompatibility === "INCOMPATIBLE" ? "ACCEPTED_WITH_LIMITATIONS" : "ACCEPTED" : "ACCEPTED_WITH_LIMITATIONS",
        accountId: bundle.accountId, accountName: bundle.accountName, accountTimezone: bundle.accountTimezone, normalizedTimezone: bundle.normalizedTimezone,
        timezoneSource: bundle.timezoneSource, currency: bundle.currency, currencyOrigin: bundle.currencyOrigin, sourceAsOf: effectiveSourceAsOf, sourceAsOfOrigin: effectiveSourceAsOfOrigin,
        parserVersion: META_EVIDENCE_PARSER_VERSION, normalizationVersion: META_EVIDENCE_NORMALIZATION_VERSION,
        acceptedById: input.actor.userId, acceptedByUsername: clean(input.actor.username, 120), acceptedAt: now, importState: "ACCEPTED",
        warnings: JSON.stringify(bundle.warnings), replacesBatchId: replacement?.id ?? null, createdAt: now, updatedAt: now
      }});
      const rowIds = new Map<string, string[]>();
      const fileIdsByHash = new Map<string, string>();
      for (const [fileIndex, file] of bundle.files.entries()) {
        const fileId = randomUUID();
        fileIdsByHash.set(file.sha256, fileId);
        await tx.metaImportFile.create({data: {id: fileId, importBatchId: importId, sha256: file.sha256, sanitizedFileName: file.sanitizedFileName, sourceView: file.sourceView, viewRole: file.viewRole, rowCount: file.rowCount, reportingStart: date(file.reportingStart), reportingEnd: date(file.reportingEnd), observedDateCount: file.observedDateCount, expectedDateCount: file.expectedDateCount, adCount: file.adCount, missingCoreDateCount: file.missingCoreDateCount, coverageState: file.coverageState, compatibilityState: file.sourceView === "delivery" ? bundle.coreTimingEligible ? "COMPATIBLE" : "INCOMPATIBLE" : bundle.enrichmentCompatibility, compatibilityWarnings: JSON.stringify(file.sourceView === "delivery" ? bundle.coreTimingEligibilityReasons : bundle.enrichmentWarnings), rawStorageKey: permanent[fileIndex].key, rawStorageSha256: permanent[fileIndex].sha256, rawSizeBytes: permanent[fileIndex].sizeBytes, rawExpiresAt: new Date(now.getTime() + retentionDays() * 86_400_000), validationWarnings: JSON.stringify(file.warnings), parserMetadata: JSON.stringify({parserVersion: META_EVIDENCE_PARSER_VERSION, normalizationVersion: META_EVIDENCE_NORMALIZATION_VERSION}), createdAt: now}});
        for (const row of file.rows) {
          const rowId = randomUUID(); const sourceKey = row.identityKey ?? `${file.sha256}:${row.sourceRowNumber}`;
          rowIds.set(sourceKey, [...(rowIds.get(sourceKey) ?? []), rowId]);
          await tx.metaImportFileRow.create({data: {id: rowId, importFileId: fileId, sourceRowNumber: row.sourceRowNumber, sourceView: row.sourceView, sourceIdentityKey: sourceKey, normalizedPayload: JSON.stringify(row), parserVersion: META_EVIDENCE_PARSER_VERSION, normalizationVersion: META_EVIDENCE_NORMALIZATION_VERSION, createdAt: now}});
        }
      }
      for (const row of bundle.metricObservations) {
        if (!row.identityKey || !row.metricDate) continue;
        const observationId = randomUUID();
        const sourceEntityKey = row.identityKey.split("|").slice(0, 5).join("|");
        await tx.metaDailySourceObservation.create({data: {id: observationId, importBatchId: importId, sourceFileIds: JSON.stringify(row.sourceFileHash.split(",").flatMap((hash) => fileIdsByHash.get(hash) ?? [])), sourceRowIds: JSON.stringify(rowIds.get(sourceEntityKey) ?? []), accountId: row.accountId, accountName: row.accountName, campaignId: row.campaignId, campaignName: row.campaignName, adSetId: row.adSetId, adSetName: row.adSetName, adId: row.adId, adName: row.adName, metricDate: date(row.metricDate)!, sourceReportingDate: row.metricDate, accountTimezone: row.accountTimezone, normalizedTimezone: row.normalizedTimezone, timezoneSource: row.timezoneSource, currency: row.currency, currencyOrigin: row.currencyOrigin, metricFamily: row.metricFamily, metricKey: row.metricKey, attributionSetting: row.metricFamily === "SPEND" ? "" : row.attributionSetting, resultMetricKey: row.metricFamily === "SPEND" ? "NONE" : row.resultMetricKey, spend: row.metricFamily === "SPEND" ? row.spend : null, impressions: row.metricFamily === "SPEND" ? row.impressions : null, reach: row.metricFamily === "SPEND" ? row.reach : null, results: row.metricFamily === "ATTRIBUTION_RESULT" ? row.results : null, resultIndicator: row.metricFamily === "ATTRIBUTION_RESULT" ? row.resultIndicator : "", deliveryStatus: row.deliveryStatus, urlParameters: row.urlParameters, sourceAsOf: row.sourceAsOf ? new Date(row.sourceAsOf) : effectiveSourceAsOf, sourceAsOfOrigin: row.sourceAsOf ? row.sourceAsOfOrigin : effectiveSourceAsOfOrigin, acceptedAt: now, parserVersion: META_EVIDENCE_PARSER_VERSION, normalizationVersion: META_EVIDENCE_NORMALIZATION_VERSION, identityKey: row.identityKey, createdAt: now}});
      }
      for (const row of bundle.mergedDailyRows) {
        if (!row.metricDate) continue;
        await tx.adCreativeReport.create({data: {id: randomUUID(), importBatchId: importId, releaseId: token.context.releaseId, campaignName: row.campaignName || null, adSetName: row.adSetName || null, adName: row.adName || row.adId, adDelivery: row.deliveryStatus || null, reportingStart: date(row.metricDate), reportingEnd: date(row.metricDate), spend: row.spend, impressions: row.impressions, reach: row.reach, results: row.results, resultIndicator: row.resultIndicator || null, createdAt: now, updatedAt: now}});
      }
      await tx.metaImportAuditEvent.create({data: {id: randomUUID(), importBatchId: importId, action: "IMPORT_ACCEPTED", newValues: JSON.stringify({bundleHash: bundle.bundleHash, sourceGranularity: bundle.sourceGranularity, coreTimingEligible: bundle.coreTimingEligible, enrichmentCompatibility: bundle.enrichmentCompatibility}), actorId: input.actor.userId, actorUsername: input.actor.username, createdAt: now}});
      if (replacement) {
        const changed = await tx.adImportBatch.updateMany({where: {id: replacement.id, importState: "ACCEPTED", withdrawnAt: null}, data: {importState: "REPLACED", updatedAt: now}});
        if (changed.count !== 1) throw new AdminError("Replacement target changed during commit.", {code: "CONFLICT", status: 409});
      }
      for (const identityKey of bundle.metricObservations.map((row) => row.identityKey)) await recalculateResolution(tx, identityKey, now);
    }, META_IMPORT_TRANSACTION_OPTIONS);
  } catch (error) {
    await Promise.all(permanent.map(({key}) => deletePrivateObject("ads-raw", key).catch(() => undefined)));
    if (error instanceof AdminError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("This file, bundle, or idempotency key was committed concurrently.", {code: "CONFLICT", status: 409});
    throw new AdminError("The Meta import transaction failed; no database rows were committed.", {code: "TRANSACTION_FAILURE", status: 500, retryable: true});
  }
  await Promise.all(token.fileReferences.map(({key}) => deletePrivateObject("ads-preview", key).catch(() => undefined)));
  return {ok: true as const, code: "IMPORT_COMMITTED", importId, replayed: false};
}

export async function withdrawMetaImport(input: {actor: MetaImportActor; importId: string; reason: string; now?: Date}) {
  const now = input.now ?? new Date(); const reason = clean(input.reason, 1000); if (!reason) throw new AdminError("Withdrawal reason is required.", {code: "VALIDATION", status: 400});
  await prisma.$transaction(async (tx) => {
    const record = await tx.adImportBatch.findUnique({where: {id: input.importId}, include: {dailySourceObservations: {select: {identityKey: true}}}});
    if (!record) throw new AdminError("Meta import was not found.", {code: "NOT_FOUND", status: 404});
    if (record.importState !== "ACCEPTED" || record.withdrawnAt) throw new AdminError("Meta import is not active.", {code: "CONFLICT", status: 409});
    await tx.adImportBatch.update({where: {id: record.id}, data: {importState: "WITHDRAWN", withdrawnAt: now, withdrawnById: input.actor.userId, withdrawnByUsername: input.actor.username, withdrawalReason: reason, updatedAt: now}});
    await tx.metaImportAuditEvent.create({data: {id: randomUUID(), importBatchId: record.id, action: "IMPORT_WITHDRAWN", reason, actorId: input.actor.userId, actorUsername: input.actor.username, createdAt: now}});
    for (const identityKey of new Set(record.dailySourceObservations.map((item) => item.identityKey))) await recalculateResolution(tx, identityKey, now);
  }, META_IMPORT_TRANSACTION_OPTIONS);
  return {ok: true as const, code: "IMPORT_WITHDRAWN"};
}
