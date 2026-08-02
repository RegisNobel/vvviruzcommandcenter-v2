import {PrismaClient} from "@prisma/client";
import {ensureDatabaseUrl} from "../lib/db/load-env";

ensureDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const [annotationTotal, publicAnnotations, incompleteAnnotations, entries, publishedEntries, pendingSubmissions] = await Promise.all([
    prisma.releaseAnnotation.count(),
    prisma.releaseAnnotation.count({where: {status: "ready", isPublic: true}}),
    prisma.releaseAnnotation.count({
      where: {OR: [{summary: ""}, {explanation: ""}, {excerptSnapshot: ""}]}
    }),
    prisma.breakingBarzEntry.count(),
    prisma.breakingBarzEntry.count({where: {status: "published", currentPublishedVersionId: {not: null}}}),
    prisma.breakingBarzSubmission.count({where: {status: "pending"}})
  ]);
  console.log(JSON.stringify({
    readOnly: true,
    releaseAnnotations: {total: annotationTotal, public: publicAnnotations, incomplete: incompleteAnnotations},
    entries: {total: entries, published: publishedEntries},
    submissions: {pending: pendingSubmissions}
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
