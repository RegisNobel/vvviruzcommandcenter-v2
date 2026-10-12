import {
  uploadBackupArtifactToBlob,
  type BackupArtifactType
} from "@/lib/backups/blob-storage";
import {checksumSha256, encryptBackupArtifact} from "@/lib/backups/encryption";
import {uploadBackupArtifactToGoogleDrive} from "@/lib/backups/google-drive";
import {attemptBackupDestinations} from "@/lib/backups/destinations";
import {pruneOldBackupCopies} from "@/lib/backups/retention";
import {
  createAssetManifestArtifact,
  createDatabaseSnapshotArtifact
} from "@/lib/backups/snapshot";
import {
  createBackupRun,
  markBackupRunFailed,
  markBackupRunSuccess,
  type BackupRunType
} from "@/lib/repositories/backups";

export type BackupJob = {
  blobType: BackupArtifactType;
  fileStem: string;
  runType: BackupRunType;
  createArtifact: () => Promise<{
    buffer: Buffer;
    checksumSha256: string;
    recordCounts: Record<string, number>;
    sizeBytes: number;
  }>;
};

export const backupJobs: BackupJob[] = [
  {
    blobType: "database-snapshot",
    fileStem: "vcc-db-snapshot",
    runType: "database_snapshot",
    createArtifact: createDatabaseSnapshotArtifact
  },
  {
    blobType: "asset-manifest",
    fileStem: "vcc-asset-manifest",
    runType: "asset_manifest",
    createArtifact: createAssetManifestArtifact
  }
];

export async function runBackupJob(job: BackupJob) {
  const run = await createBackupRun(job.runType);

  try {
    const artifact = await job.createArtifact();
    const encryptedBuffer = encryptBackupArtifact(artifact.buffer);
    const encryptedChecksum = checksumSha256(encryptedBuffer);
    const fileName = `${job.fileStem}-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz.enc`;
    const attempts = await attemptBackupDestinations(() => uploadBackupArtifactToBlob({
      buffer: encryptedBuffer,
      fileStem: job.fileStem,
      type: job.blobType
    }), () => uploadBackupArtifactToGoogleDrive({
      buffer: encryptedBuffer,
      fileName
    }));
    const blob = attempts.blob.value;
    const drive = attempts.drive.value;
    const destinations: string[] = [];
    const warnings = [attempts.blob.error, attempts.drive.error].filter((item): item is string => Boolean(item));
    if (blob) destinations.push("vercel_blob");

    if (drive?.enabled) {
      destinations.push("google_drive");
    } else if (process.env.GOOGLE_DRIVE_BACKUP_ENABLED === "1" && drive) {
      warnings.push(drive.reason);
    }
    if (!destinations.length) throw new Error(warnings.join(" ") || "No backup destination available.");

    await markBackupRunSuccess(run.id, {
      blobPath: blob?.pathname ?? "",
      checksumSha256: encryptedChecksum,
      destination: destinations.join(","),
      googleDriveFileId: drive?.enabled ? drive.fileId : null,
      googleDriveFolderId: drive?.enabled ? drive.folderId : null,
      warning: warnings.join(" ") || null,
      recordCounts: artifact.recordCounts,
      sizeBytes: encryptedBuffer.byteLength
    });

    return {
      blobPath: blob?.pathname ?? "",
      destinations,
      googleDrive: drive?.enabled ? "verified" : drive?.reason ?? "failed",
      warnings,
      recordCounts: artifact.recordCounts,
      runId: run.id,
      sizeBytes: encryptedBuffer.byteLength,
      status: warnings.length ? "degraded" : "success",
      type: job.runType
    };
  } catch (error) {
    await markBackupRunFailed(run.id, error);

    return {
      error: error instanceof Error ? error.message : "Backup failed.",
      runId: run.id,
      status: "failed",
      type: job.runType
    };
  }
}

export async function runAllBackups() {
  const results = [];

  for (const job of backupJobs) {
    results.push(await runBackupJob(job));
  }

  const failed = results.some((result) => result.status !== "success");
  // Enable only after the initial offsite restore rehearsal has been recorded.
  const retention = process.env.BACKUP_VERIFIED_RETENTION_ENABLED === "1"
    ? await pruneOldBackupCopies(4).catch(() => ({deleted: 0, blocked: 1}))
    : {deleted: 0, blocked: 0};

  return {
    ok: !failed && retention.blocked === 0,
    retention,
    results
  };
}
