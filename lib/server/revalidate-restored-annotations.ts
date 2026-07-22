import type {PrismaClient} from "@prisma/client";

import {validateReleaseAnnotationAnchor} from "@/lib/server/release-annotation-anchors";

type AnnotationRestoreClient = Pick<PrismaClient, "releaseAnnotation">;

export async function revalidateRestoredReleaseAnnotations(
  client: AnnotationRestoreClient
) {
  const annotations = await client.releaseAnnotation.findMany({
    where: {status: {not: "archived"}},
    include: {release: {select: {lyrics: true}}}
  });
  let valid = 0;
  let needsReanchoring = 0;

  for (const annotation of annotations) {
    const validation = validateReleaseAnnotationAnchor(
      annotation.release.lyrics,
      annotation
    );

    if (!validation.valid) {
      needsReanchoring += 1;
      await client.releaseAnnotation.update({
        where: {id: annotation.id},
        data: {
          status: "needs_reanchoring",
          isPublic: false,
          updatedAt: new Date()
        }
      });
      continue;
    }

    valid += 1;
    await client.releaseAnnotation.update({
      where: {id: annotation.id},
      data: {
        ...validation.anchor,
        lyricExcerpt: validation.anchor.excerptSnapshot,
        updatedAt: new Date()
      }
    });
  }

  return {valid, needsReanchoring};
}
