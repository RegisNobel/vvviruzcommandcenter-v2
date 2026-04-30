import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";

export type BackupRunStatus = "running" | "success" | "failed";
export type BackupRunType = "database_snapshot" | "asset_manifest";

export async function createBackupRun(type: BackupRunType) {
  const now = new Date();

  return prisma.backupRun.create({
    data: {
      id: createId(),
      type,
      status: "running",
      startedAt: now,
      createdAt: now
    }
  });
}

export async function markBackupRunSuccess(
  id: string,
  values: {
    blobPath: string;
    checksumSha256: string;
    destination: string;
    googleDriveFileId?: string | null;
    googleDriveFolderId?: string | null;
    recordCounts: Record<string, number>;
    sizeBytes: number;
  }
) {
  return prisma.backupRun.update({
    where: {
      id
    },
    data: {
      status: "success",
      destination: values.destination,
      blobPath: values.blobPath,
      googleDriveFileId: values.googleDriveFileId ?? null,
      googleDriveFolderId: values.googleDriveFolderId ?? null,
      sizeBytes: values.sizeBytes,
      checksumSha256: values.checksumSha256,
      recordCounts: JSON.stringify(values.recordCounts),
      finishedAt: new Date()
    }
  });
}

export async function markBackupRunFailed(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Backup failed.";

  return prisma.backupRun.update({
    where: {
      id
    },
    data: {
      status: "failed",
      errorMessage: message.slice(0, 1200),
      finishedAt: new Date()
    }
  });
}
