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
    process.env.GATE_A3_CONFIRM_RESET,
    "RESET_UNRECOVERABLE_TOTP",
    "Explicit Gate A3 reset confirmation is required."
  );
  assert.ok(process.env.GATE_A3_ENV_FILE, "GATE_A3_ENV_FILE is required.");
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
    const before = await prisma.adminUser.findMany({
      select: {
        id: true,
        totpMethod: true,
        totpEncryptedSecret: true,
        totpEnrolledAt: true
      }
    });
    assert.equal(before.length, 1, "Exactly one production administrator is required.");
    assert.equal(before[0].totpMethod, "totp", "Administrator must have TOTP enrolled.");
    assert.ok(before[0].totpEncryptedSecret, "Encrypted TOTP secret must be present.");
    assert.ok(before[0].totpEnrolledAt, "TOTP enrollment timestamp must be present.");
    const sessionsBefore = await prisma.authSession.count();

    const result = await prisma.$transaction(async (transaction) => {
      const deletedSessions = await transaction.authSession.deleteMany();
      const updatedAdmin = await transaction.adminUser.update({
        where: {id: before[0].id},
        data: {
          totpMethod: null,
          totpEncryptedSecret: null,
          totpEnrolledAt: null,
          updatedAt: new Date()
        },
        select: {
          totpMethod: true,
          totpEncryptedSecret: true,
          totpEnrolledAt: true
        }
      });

      return {deletedSessions, updatedAdmin};
    });

    assert.equal(result.deletedSessions.count, sessionsBefore);
    assert.equal(result.updatedAdmin.totpMethod, null);
    assert.equal(result.updatedAdmin.totpEncryptedSecret, null);
    assert.equal(result.updatedAdmin.totpEnrolledAt, null);
    assert.equal(await prisma.authSession.count(), 0);

    console.log(
      JSON.stringify({
        productionMutation: "controlled-totp-reenrollment-reset",
        administratorsUpdated: 1,
        sessionsDeleted: result.deletedSessions.count,
        totpEnrollmentCleared: true,
        postMutationSessionCount: 0
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
