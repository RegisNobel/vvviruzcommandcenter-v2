"use server";

import {revalidatePath} from "next/cache";

import {getAdminAccessState} from "@/lib/auth/server";
import {runAllBackups} from "@/lib/backups/runner";
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
