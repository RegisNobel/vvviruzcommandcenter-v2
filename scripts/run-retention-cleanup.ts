import {runRetentionCleanup} from "../lib/analytics/retention-cleanup";

async function main() {
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--apply");
  const result = await runRetentionCleanup({dryRun});
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Analytics cleanup failed.");
  process.exitCode = 1;
});
