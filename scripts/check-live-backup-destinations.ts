import assert from "node:assert/strict";
import {runAllBackups} from "../lib/backups/runner";
import {prisma} from "../lib/db/prisma";

async function main() {
  assert.equal(process.env.VERCEL_ENV, "production");
  assert.equal(process.env.RUN_BACKUP_DESTINATION_CHECK, "1");
  const result = await runAllBackups();
  for (const job of result.results) {
    console.log(JSON.stringify({backupDestinationCheck: job.type, status: job.status, driveVerified: "googleDrive" in job && job.googleDrive === "verified", runId: job.runId}));
    assert.ok("googleDrive" in job && job.googleDrive === "verified", "The fresh offsite backup did not verify.");
  }
  console.log(JSON.stringify({backupDestinationCheck: "passed", fullRedundancy: result.ok}));
}
void main().catch(() => {console.error("Live backup destination check failed; existing backups remain intact."); process.exitCode = 1;}).finally(() => prisma.$disconnect());
