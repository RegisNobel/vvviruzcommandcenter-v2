"use server";

import {revalidatePath} from "next/cache";

import {getAdminAccessState} from "@/lib/auth/server";
import {runAllBackups} from "@/lib/backups/runner";
import {listDriveBackupSnapshots, restoreFromGoogleDrive} from "@/lib/backups/restorer";
import {prisma} from "@/lib/db/prisma";

export async function triggerManualBackupAction() {
  const {stage} = await getAdminAccessState();

  if (stage !== "authenticated") {
    return {success: false, message: "Unauthorized."};
  }

  // Prevent double trigger if already running
  const runningCount = await prisma.backupRun.count({
    where: {
      status: "running"
    }
  });

  if (runningCount > 0) {
    return {success: false, message: "A backup is already running. Please wait."};
  }

  try {
    const result = await runAllBackups();

    revalidatePath("/admin/backups");
    revalidatePath("/admin");

    if (!result.ok) {
      return {success: false, message: "Backup completed with errors."};
    }

    return {success: true, message: "Backup completed successfully."};
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Backup failed."
    };
  }
}

export async function listAvailableBackupsAction() {
  const {stage} = await getAdminAccessState();

  if (stage !== "authenticated") {
    return {success: false as const, message: "Unauthorized.", backups: []};
  }

  try {
    const backups = await listDriveBackupSnapshots();
    return {success: true as const, backups};
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to list backups.",
      backups: []
    };
  }
}

export async function triggerRestoreAction(fileId: string) {
  const {stage} = await getAdminAccessState();

  if (stage !== "authenticated") {
    return {success: false, message: "Unauthorized."};
  }

  if (!fileId || typeof fileId !== "string") {
    return {success: false, message: "Invalid backup file ID."};
  }

  // Prevent restore while backup is running
  const runningCount = await prisma.backupRun.count({
    where: {status: "running"}
  });

  if (runningCount > 0) {
    return {success: false, message: "A backup is currently running. Please wait before restoring."};
  }

  try {
    const result = await restoreFromGoogleDrive(fileId);

    revalidatePath("/admin/backups");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Restore completed in ${(result.duration / 1000).toFixed(1)}s. Snapshot from ${result.snapshotDate}.`,
      counts: result.counts
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Restore failed."
    };
  }
}

