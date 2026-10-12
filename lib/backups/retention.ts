import "server-only";
import {prisma} from "@/lib/db/prisma";
import {verifyGoogleDriveBackupCopy} from "@/lib/backups/google-drive";
import {deletePrivateObject} from "@/lib/server/private-object-storage";
import {pruneVerifiedBackupCopies, selectBackupPruneCandidates} from "@/lib/backups/retention-policy";

export async function pruneOldBackupCopies(limit = 2) {
  const runs = await prisma.backupRun.findMany({where: {status: "success", blobPath: {not: ""}}});
  // Only the current private namespace is automated. Historical public backups
  // require a separate, individually verified migration and cleanup.
  const candidates = selectBackupPruneCandidates(runs)
    .filter((run) => run.blobPath.startsWith(`${process.env.PRIVATE_STORAGE_BACKUP_NAMESPACE?.trim() || "database-backups"}/`))
    // Process newly expired copies first, so old unverifiable copies cannot
    // occupy every daily cleanup slot and prevent future retention.
    .reverse()
    .slice(0, limit);
  return pruneVerifiedBackupCopies(candidates, {
    async verify(run) {
      const {document} = await verifyGoogleDriveBackupCopy({
        fileId: run.googleDriveFileId!, sizeBytes: run.sizeBytes!, checksumSha256: run.checksumSha256!
      });
      if (run.type === "database_snapshot" && (!Array.isArray(document.releases) || !Array.isArray(document.adminUsers))) {
        throw new Error("Database snapshot structure is invalid.");
      }
      if (run.type === "asset_manifest" && !Array.isArray(document.assets)) {
        throw new Error("Asset manifest structure is invalid.");
      }
      const counts = JSON.parse(run.recordCounts) as Record<string, number>;
      if (!Object.keys(counts).length) throw new Error("Backup record counts are unavailable.");
      for (const [table, count] of Object.entries(counts)) {
        if (!Array.isArray(document[table]) || document[table].length !== count) {
          throw new Error("Backup record counts do not match.");
        }
      }
    },
    async remove(run) {
      await deletePrivateObject("database-backups", run.blobPath);
      await prisma.backupRun.update({where: {id: run.id}, data: {blobPath: "", destination: "google_drive"}});
    }
  });
}
