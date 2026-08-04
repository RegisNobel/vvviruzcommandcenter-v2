import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function loadEnvFile(fileName: string) {
  const raw = await fs.readFile(path.resolve(root, fileName), "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  assert.equal(
    process.env.GATE_A3_CONFIRM_CLEANUP,
    "REMOVE_EXACT_BREAKING_BARZ_FIXTURE",
    "Explicit Gate A3 cleanup confirmation is required."
  );
  assert.ok(process.env.GATE_A3_ENV_FILE, "GATE_A3_ENV_FILE is required.");
  const entryId = process.env.GATE_A3_ENTRY_ID?.trim() || "";
  const expectedTitle = process.env.GATE_A3_EXPECTED_TITLE?.trim() || "";
  assert.ok(entryId, "GATE_A3_ENTRY_ID is required.");
  assert.ok(expectedTitle.startsWith("Gate A3 Auth Rotation Verification"));
  await loadEnvFile(process.env.GATE_A3_ENV_FILE);

  process.env.DATABASE_URL =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  assert.ok(process.env.DATABASE_URL?.startsWith("postgres"));

  const {prisma} = await import("../lib/db/prisma");

  try {
    const fixture = await prisma.breakingBarzEntry.findUnique({
      where: {id: entryId},
      include: {
        versions: {include: {sources: true}},
        categories: true,
        promotedSubmissions: true
      }
    });
    assert.ok(fixture, "Exact Breaking Barz fixture was not found.");
    assert.equal(fixture.songTitle, expectedTitle);
    assert.equal(fixture.releaseId, null);
    assert.equal(fixture.releaseAnnotationId, null);
    assert.equal(fixture.promotedSubmissions.length, 0);

    const evidence = {
      statusBeforeCleanup: fixture.status,
      versionsRemoved: fixture.versions.length,
      sourcesRemoved: fixture.versions.reduce((sum, version) => sum + version.sources.length, 0),
      categoryAssignmentsRemoved: fixture.categories.length
    };

    await prisma.breakingBarzEntry.delete({where: {id: entryId}});
    assert.equal(await prisma.breakingBarzEntry.count({where: {id: entryId}}), 0);
    assert.equal(await prisma.breakingBarzVersion.count({where: {entryId}}), 0);

    console.log(
      JSON.stringify({
        productionMutation: "remove-exact-gate-a3-breaking-barz-fixture",
        entryRemoved: true,
        ...evidence
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
