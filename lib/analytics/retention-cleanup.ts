import "server-only";

import {prisma} from "@/lib/db/prisma";
import {
  deleteStoredAssetStrict,
  listStoredAssetReferences,
  type StoredAssetKind
} from "@/lib/server/asset-storage";
import {writeOperationalLog} from "@/lib/server/operational-log";

const DAY_MS = 86_400_000;

type CleanupCategory = "expiredPreviews" | "expiredRawFiles" | "orphanedRawFiles" | "expiredMetaPreviews" | "expiredMetaRawFiles" | "orphanedMetaRawFiles";
type CleanupError = {category: CleanupCategory; objectId: string; code: "STORAGE_DELETE_FAILED" | "DATABASE_UPDATE_FAILED"};
type CleanupCategoryResult = {discovered: number; attempted: number; deleted: number; alreadyAbsent: number; deferred: number};

export type RetentionCleanupResult = {
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  batchSize: number;
  expiredPreviews: CleanupCategoryResult;
  expiredRawFiles: CleanupCategoryResult;
  orphanedRawFiles: CleanupCategoryResult;
  expiredMetaPreviews: CleanupCategoryResult;
  expiredMetaRawFiles: CleanupCategoryResult;
  orphanedMetaRawFiles: CleanupCategoryResult;
  errors: CleanupError[];
};

type CleanupDependencies = {
  list: (kind: "analytics-preview" | "analytics-raw") => ReturnType<typeof listStoredAssetReferences>;
  metaList?: typeof listStoredAssetReferences;
  remove: typeof deleteStoredAssetStrict;
  now: () => Date;
};

const dependencies: CleanupDependencies = {
  list: listStoredAssetReferences,
  metaList: listStoredAssetReferences,
  remove: deleteStoredAssetStrict,
  now: () => new Date()
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function readRetentionCleanupConfig() {
  return {
    batchSize: boundedInteger(process.env.ANALYTICS_CLEANUP_BATCH_SIZE, 100, 1, 500),
    previewRetentionHours: boundedInteger(process.env.ANALYTICS_PREVIEW_RETENTION_HOURS, 24, 1, 168),
    metaPreviewRetentionMinutes: boundedInteger(process.env.ADS_PREVIEW_RETENTION_MINUTES, 15, 15, 1440),
    orphanRetentionDays: boundedInteger(process.env.ANALYTICS_ORPHAN_RETENTION_DAYS, 7, 1, 90)
  };
}

function emptyCategory(discovered: number): CleanupCategoryResult {
  return {discovered, attempted: 0, deleted: 0, alreadyAbsent: 0, deferred: 0};
}

function opaqueObjectId(value: string) {
  const fileName = value.split(/[\\/]/).at(-1) ?? "unknown";
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

async function deleteCandidates(
  category: CleanupCategory,
  kind: StoredAssetKind,
  candidates: Array<{objectId: string; storedPath: string}>,
  result: CleanupCategoryResult,
  errors: CleanupError[],
  options: {dryRun: boolean; afterDelete?: (candidate: {objectId: string; storedPath: string}) => Promise<void>},
  deps: CleanupDependencies
) {
  for (const candidate of candidates) {
    result.attempted += 1;
    if (options.dryRun) {
      result.deferred += 1;
      continue;
    }
    try {
      const removed = await deps.remove(kind, candidate.storedPath);
      if (options.afterDelete) {
        try {
          await options.afterDelete(candidate);
        } catch {
          errors.push({category, objectId: candidate.objectId, code: "DATABASE_UPDATE_FAILED"});
          continue;
        }
      }
      if (removed.alreadyAbsent) result.alreadyAbsent += 1;
      else result.deleted += 1;
    } catch {
      errors.push({category, objectId: candidate.objectId, code: "STORAGE_DELETE_FAILED"});
    }
  }
}

export async function runRetentionCleanup(
  options: {dryRun?: boolean; batchSize?: number} = {},
  deps: CleanupDependencies = dependencies
): Promise<RetentionCleanupResult> {
  const startedAt = deps.now();
  const config = readRetentionCleanupConfig();
  const batchSize = Math.min(500, Math.max(1, options.batchSize ?? config.batchSize));
  const dryRun = options.dryRun ?? true;
  const previewCutoff = new Date(startedAt.getTime() - config.previewRetentionHours * 60 * 60 * 1000);
  const metaPreviewCutoff = new Date(startedAt.getTime() - config.metaPreviewRetentionMinutes * 60 * 1000);
  const orphanCutoff = new Date(startedAt.getTime() - config.orphanRetentionDays * DAY_MS);

  const [previewObjects, rawObjects, expiredImports, referencedImports, metaPreviewObjects, metaRawObjects, expiredMetaFiles, referencedMetaFiles] = await Promise.all([
    deps.list("analytics-preview"),
    deps.list("analytics-raw"),
    prisma.analyticsImport.findMany({
      where: {
        acceptedAt: {not: null},
        rawFileStorageKey: {not: null},
        rawFileDeletedAt: null,
        rawFileExpiresAt: {lte: startedAt}
      },
      orderBy: [{rawFileExpiresAt: "asc"}, {id: "asc"}],
      take: batchSize,
      select: {id: true, rawFileStorageKey: true}
    }),
    prisma.analyticsImport.findMany({
      where: {rawFileStorageKey: {not: null}},
      select: {rawFileStorageKey: true}
    }),
    deps.metaList ? deps.metaList("ads-preview") : Promise.resolve([]),
    deps.metaList ? deps.metaList("ads-raw") : Promise.resolve([]),
    prisma.metaImportFile.findMany({where: {rawStorageKey: {not: null}, rawDeletedAt: null, rawExpiresAt: {lte: startedAt}}, orderBy: [{rawExpiresAt: "asc"}, {id: "asc"}], take: batchSize, select: {id: true, rawStorageKey: true}}),
    prisma.metaImportFile.findMany({where: {rawStorageKey: {not: null}}, select: {rawStorageKey: true}})
  ]);

  const expiredPreviews = previewObjects
    .filter((item) => item.updatedAt <= previewCutoff)
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const referenced = new Set(referencedImports.flatMap((item) => item.rawFileStorageKey ? [item.rawFileStorageKey] : []));
  const orphans = rawObjects
    .filter((item) => item.updatedAt <= orphanCutoff && !referenced.has(item.storedPath))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const expiredMetaPreviews = metaPreviewObjects.filter((item) => item.updatedAt <= metaPreviewCutoff).sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const referencedMeta = new Set(referencedMetaFiles.flatMap((item) => item.rawStorageKey ? [item.rawStorageKey] : []));
  const metaOrphans = metaRawObjects.filter((item) => item.updatedAt <= orphanCutoff && !referencedMeta.has(item.storedPath)).sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  const result: RetentionCleanupResult = {
    dryRun,
    startedAt: startedAt.toISOString(),
    completedAt: "",
    batchSize,
    expiredPreviews: emptyCategory(expiredPreviews.length),
    expiredRawFiles: emptyCategory(expiredImports.length),
    orphanedRawFiles: emptyCategory(orphans.length),
    expiredMetaPreviews: emptyCategory(expiredMetaPreviews.length),
    expiredMetaRawFiles: emptyCategory(expiredMetaFiles.length),
    orphanedMetaRawFiles: emptyCategory(metaOrphans.length),
    errors: []
  };

  await deleteCandidates(
    "expiredPreviews",
    "analytics-preview",
    expiredPreviews.slice(0, batchSize).map((item) => ({objectId: opaqueObjectId(item.id), storedPath: item.storedPath})),
    result.expiredPreviews,
    result.errors,
    {dryRun},
    deps
  );
  result.expiredPreviews.deferred += Math.max(0, expiredPreviews.length - batchSize);

  await deleteCandidates(
    "expiredRawFiles",
    "analytics-raw",
    expiredImports.flatMap((item) => item.rawFileStorageKey ? [{objectId: item.id, storedPath: item.rawFileStorageKey}] : []),
    result.expiredRawFiles,
    result.errors,
    {
      dryRun,
      afterDelete: async (candidate) => {
        const updated = await prisma.analyticsImport.updateMany({
          where: {id: candidate.objectId, rawFileDeletedAt: null},
          data: {rawFileDeletedAt: deps.now(), updatedAt: deps.now()}
        });
        if (updated.count !== 1) throw new Error("Import cleanup state changed concurrently.");
      }
    },
    deps
  );

  await deleteCandidates(
    "orphanedRawFiles",
    "analytics-raw",
    orphans.slice(0, batchSize).map((item) => ({objectId: opaqueObjectId(item.id), storedPath: item.storedPath})),
    result.orphanedRawFiles,
    result.errors,
    {dryRun},
    deps
  );
  result.orphanedRawFiles.deferred += Math.max(0, orphans.length - batchSize);
  await deleteCandidates("expiredMetaPreviews", "ads-preview", expiredMetaPreviews.slice(0, batchSize).map((item) => ({objectId: opaqueObjectId(item.id), storedPath: item.storedPath})), result.expiredMetaPreviews, result.errors, {dryRun}, deps);
  result.expiredMetaPreviews.deferred += Math.max(0, expiredMetaPreviews.length - batchSize);
  await deleteCandidates("expiredMetaRawFiles", "ads-raw", expiredMetaFiles.flatMap((item) => item.rawStorageKey ? [{objectId: item.id, storedPath: item.rawStorageKey}] : []), result.expiredMetaRawFiles, result.errors, {dryRun, afterDelete: async (candidate) => {
    const updated = await prisma.metaImportFile.updateMany({where: {id: candidate.objectId, rawDeletedAt: null}, data: {rawDeletedAt: deps.now()}});
    if (updated.count !== 1) throw new Error("Meta raw cleanup state changed concurrently.");
  }}, deps);
  await deleteCandidates("orphanedMetaRawFiles", "ads-raw", metaOrphans.slice(0, batchSize).map((item) => ({objectId: opaqueObjectId(item.id), storedPath: item.storedPath})), result.orphanedMetaRawFiles, result.errors, {dryRun}, deps);
  result.orphanedMetaRawFiles.deferred += Math.max(0, metaOrphans.length - batchSize);
  result.completedAt = deps.now().toISOString();

  writeOperationalLog(result.errors.length ? "warn" : "info", "analytics.cleanup.completed", {
    dryRun,
    durationMs: deps.now().getTime() - startedAt.getTime(),
    expiredPreviewDeleted: result.expiredPreviews.deleted,
    expiredRawDeleted: result.expiredRawFiles.deleted,
    orphanDeleted: result.orphanedRawFiles.deleted,
    expiredMetaPreviewDeleted: result.expiredMetaPreviews.deleted,
    expiredMetaRawDeleted: result.expiredMetaRawFiles.deleted,
    orphanMetaDeleted: result.orphanedMetaRawFiles.deleted,
    errorCount: result.errors.length
  });
  return result;
}
