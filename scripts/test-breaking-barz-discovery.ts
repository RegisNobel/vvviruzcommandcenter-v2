import assert from "node:assert/strict";

import {prisma} from "../lib/db/prisma";
import {
  getPublicBreakingBarzEntry,
  saveExternalBreakingBarzEntry,
  syncReleaseAnnotationToBreakingBarz
} from "../lib/repositories/breaking-barz";

async function main() {
  const created = await saveExternalBreakingBarzEntry({
    songTitle: "Breaking Barz Verification Song",
    artistNames: ["Test Artist"],
    lyricExcerpt: "A test line with a second meaning",
    summary: "The initial public summary.",
    breakdown: "The initial full breakdown used to verify version stability.",
    verificationStatus: "interpretation",
    categorySlugs: ["wordplay"],
    action: "publish"
  });
  const row = await prisma.breakingBarzEntry.findUniqueOrThrow({where: {id: created.id}});
  const firstPublic = await getPublicBreakingBarzEntry(row.slug);
  assert.equal(firstPublic?.songTitle, "Breaking Barz Verification Song");
  assert.equal(firstPublic?.categories[0]?.slug, "wordplay");

  await saveExternalBreakingBarzEntry({
    id: created.id,
    songTitle: "Private Revision Title",
    artistNames: ["Revised Artist"],
    lyricExcerpt: "A private revised line",
    summary: "A private revised summary.",
    breakdown: "A private revised breakdown that must not leak before publish.",
    verificationStatus: "verified_breakdown",
    categorySlugs: ["metaphor"],
    action: "draft"
  });
  const stablePublic = await getPublicBreakingBarzEntry(row.slug);
  assert.equal(stablePublic?.songTitle, "Breaking Barz Verification Song");
  assert.equal(stablePublic?.version.summary, "The initial public summary.");
  assert.equal(stablePublic?.categories[0]?.slug, "wordplay");

  await saveExternalBreakingBarzEntry({
    id: created.id,
    songTitle: "Private Revision Title",
    artistNames: ["Revised Artist"],
    lyricExcerpt: "A private revised line",
    summary: "A private revised summary.",
    breakdown: "A private revised breakdown that must not leak before publish.",
    verificationStatus: "verified_breakdown",
    categorySlugs: ["metaphor"],
    action: "publish"
  });
  const revisedPublic = await getPublicBreakingBarzEntry(row.slug);
  assert.equal(revisedPublic?.songTitle, "Private Revision Title");
  assert.equal(revisedPublic?.categories[0]?.slug, "metaphor");

  const annotation = await prisma.releaseAnnotation.findFirst({
    where: {summary: {not: ""}, explanation: {not: ""}},
    include: {
      sources: true,
      release: {
        select: {
          id: true,
          title: true,
          catalogScope: true,
          collaborator: true,
          collaboratorName: true,
          spotifyUrl: true,
          appleMusicUrl: true,
          youtubeUrl: true,
          primaryArtistProfile: {select: {displayName: true}},
          artistCredits: {select: {artistProfile: {select: {displayName: true}}}}
        }
      }
    }
  });
  if (annotation) {
    await prisma.$transaction((tx) => syncReleaseAnnotationToBreakingBarz(tx, {
      annotationId: annotation.id,
      release: annotation.release,
      annotation: {
        title: annotation.title,
        type: annotation.type,
        excerpt: annotation.excerptSnapshot || annotation.lyricExcerpt,
        summary: annotation.summary,
        breakdown: annotation.explanation,
        confidence: annotation.confidence,
        sources: annotation.sources.map(({label, url}) => ({label, url}))
      },
      action: "draft"
    }));
  }

  await prisma.breakingBarzEntry.delete({where: {id: created.id}});
  console.log("Breaking Barz discovery checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
