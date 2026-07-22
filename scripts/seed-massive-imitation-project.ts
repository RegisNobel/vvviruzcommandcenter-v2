import {prisma} from "../lib/db/prisma";

const trackOrder = ["Introduction", "BOSSS", "Real", "Switch 2 (Deja Vu)", "Arrive"];
const description =
  "Massive Imitation is a five-track project about influence, reinvention, ambition, and identity. Each song draws from a different corner of rap and reshapes that inspiration through vvviruz's own writing, multilingual delivery, beat switches, and perspective.\n\nAcross bold introductions, victory-lap energy, swagger, nostalgia, and reflections on pressure and authenticity, the project explores the difference between copying what came before and transforming it into something personal.";

async function main() {
  const releases = await prisma.release.findMany({
    where: {title: {in: trackOrder}},
    select: {
      coverArtPath: true,
      coverArtUrl: true,
      id: true,
      title: true
    }
  });
  const byTitle = new Map(releases.map((release) => [release.title.toLowerCase(), release]));
  const ordered = trackOrder
    .map((title) => byTitle.get(title.toLowerCase()))
    .filter((release): release is NonNullable<typeof release> => Boolean(release));

  if (ordered.length === 0) {
    throw new Error("No Massive Imitation releases were found.");
  }

  const existing = await prisma.releaseCategory.findUnique({where: {slug: "mi"}});
  const now = new Date();
  const project = await prisma.releaseCategory.upsert({
    where: {slug: "mi"},
    create: {
      id: "category-massive-imitation",
      name: "Massive Imitation",
      slug: "mi",
      description,
      projectType: "mixtape",
      artworkPath: ordered[0].coverArtPath || ordered[0].coverArtUrl || "",
      artworkAltText: "Massive Imitation mixtape artwork",
      projectReleaseDate: new Date("2026-01-07T12:00:00.000Z"),
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    update: {
      description: existing?.description.trim() || description,
      projectType: "mixtape",
      artworkPath:
        existing?.artworkPath.trim() || ordered[0].coverArtPath || ordered[0].coverArtUrl || "",
      artworkAltText: existing?.artworkAltText.trim() || "Massive Imitation mixtape artwork",
      projectReleaseDate: existing?.projectReleaseDate || new Date("2026-01-07T12:00:00.000Z"),
      updatedAt: now
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.releaseCategoryAssignment.deleteMany({where: {categoryId: project.id}});
    await tx.releaseCategoryAssignment.createMany({
      data: ordered.map((release, sortOrder) => ({
        id: crypto.randomUUID(),
        categoryId: project.id,
        releaseId: release.id,
        sortOrder,
        createdAt: now,
        updatedAt: now
      }))
    });
  });

  console.log(
    `Massive Imitation project seeded with ${ordered.length} releases: ${ordered.map((release) => release.title).join(", ")}`
  );
}

main().finally(() => prisma.$disconnect());
