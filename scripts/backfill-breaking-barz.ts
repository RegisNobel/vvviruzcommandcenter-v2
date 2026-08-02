import {PrismaClient} from "@prisma/client";

import {syncReleaseAnnotationToBreakingBarz} from "../lib/repositories/breaking-barz";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const confirmProductionWrite = process.argv.includes("--confirm-production-write");
const databaseUrl = process.env.DATABASE_URL || "";

if (apply && databaseUrl && !databaseUrl.startsWith("file:") && !confirmProductionWrite) {
  throw new Error("Production writes require --confirm-production-write after a reviewed dry run.");
}

async function main() {
  const annotations = await prisma.releaseAnnotation.findMany({
    include: {
      sources: {orderBy: {sortOrder: "asc"}},
      release: {
        select: {
          id: true,
          title: true,
          isPublished: true,
          catalogScope: true,
          collaborator: true,
          collaboratorName: true,
          spotifyUrl: true,
          appleMusicUrl: true,
          youtubeUrl: true,
          primaryArtistProfile: {select: {displayName: true}},
          artistCredits: {
            orderBy: {displayOrder: "asc"},
            select: {artistProfile: {select: {displayName: true}}}
          }
        }
      }
    },
    orderBy: {createdAt: "asc"}
  });

  const report = {total: annotations.length, publish: 0, draft: 0, archive: 0, skipped: 0, failed: 0};
  for (const annotation of annotations) {
    const excerpt = annotation.excerptSnapshot || annotation.lyricExcerpt;
    if (!excerpt.trim() || !annotation.summary.trim() || !annotation.explanation.trim()) {
      report.skipped += 1;
      console.warn(`skip ${annotation.id}: missing excerpt, summary, or breakdown`);
      continue;
    }
    const action = annotation.status === "archived"
      ? "archive"
      : annotation.status === "ready" && annotation.isPublic && annotation.release.isPublished
        ? "publish"
        : "draft";
    report[action] += 1;
    if (!apply) continue;
    try {
      await prisma.$transaction((tx) => syncReleaseAnnotationToBreakingBarz(tx, {
        annotationId: annotation.id,
        release: annotation.release,
        annotation: {
          title: annotation.title,
          type: annotation.type,
          excerpt,
          summary: annotation.summary,
          breakdown: annotation.explanation,
          confidence: annotation.confidence,
          sources: annotation.sources.map(({label, url}) => ({label, url}))
        },
        action
      }));
    } catch (error) {
      report.failed += 1;
      console.error(`failed ${annotation.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(JSON.stringify({mode: apply ? "apply" : "dry-run", ...report}, null, 2));
  if (report.failed) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
