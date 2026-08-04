import assert from "node:assert/strict";

import {prisma} from "../lib/db/prisma";

const entryId = "gate-b-private-backup-entry";
const versionId = "gate-b-private-backup-version";
const categoryId = "gate-b-private-backup-category";

async function seed() {
  const now = new Date("2026-08-04T18:00:00.000Z");
  await prisma.breakingBarzCategory.create({
    data: {
      id: categoryId,
      name: "Gate B Fixture",
      slug: "gate-b-private-backup-fixture",
      description: "Disposable private backup verification fixture.",
      sortOrder: 999,
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.breakingBarzEntry.create({
    data: {
      id: entryId,
      slug: "gate-b-private-backup-entry",
      songTitle: "Gate B Private Backup",
      artistNames: JSON.stringify(["Synthetic Artist"]),
      status: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.breakingBarzVersion.create({
    data: {
      id: versionId,
      entryId,
      version: 1,
      songTitle: "Gate B Private Backup",
      artistNames: JSON.stringify(["Synthetic Artist"]),
      categorySlugs: JSON.stringify(["gate-b-private-backup-fixture"]),
      lyricExcerpt: "Synthetic encrypted backup fixture.",
      summary: "Synthetic fixture used only in a disposable database.",
      breakdown: "Confirms Breaking Barz records survive private backup restore.",
      editorialStatus: "published",
      publishedAt: now,
      createdAt: now
    }
  });
  await prisma.breakingBarzEntry.update({
    where: {id: entryId},
    data: {currentPublishedVersionId: versionId}
  });
  await prisma.breakingBarzEntryCategory.create({
    data: {entryId, categoryId}
  });
}

async function verify() {
  const entry = await prisma.breakingBarzEntry.findUnique({
    where: {id: entryId},
    include: {versions: true, categories: true}
  });
  assert.ok(entry);
  assert.equal(entry.status, "published");
  assert.equal(entry.currentPublishedVersionId, versionId);
  assert.equal(entry.versions.length, 1);
  assert.equal(entry.categories.length, 1);
}

async function main() {
  const mode = process.argv[2];
  if (mode === "seed") await seed();
  else if (mode === "verify") await verify();
  else throw new Error("Expected seed or verify mode.");
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Gate B fixture failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
