import {backfillStage3AnalyticsImportRows} from "../lib/analytics/release-mapping-service";
import {prisma} from "../lib/db/prisma";

async function main() {
  const result = await backfillStage3AnalyticsImportRows();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Analytics mapping backfill failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
