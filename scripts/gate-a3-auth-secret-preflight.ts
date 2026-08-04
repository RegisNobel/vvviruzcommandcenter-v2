import assert from "node:assert/strict";
import {createDecipheriv, createHash} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function loadEnvFile(fileName: string) {
  let raw: string;
  try { raw = await fs.readFile(path.resolve(root, fileName), "utf8"); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function decryptTotpSecret(payload: string, authSecret: string) {
  const [prefix, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split("$");
  assert.equal(prefix, "enc");
  assert.ok(ivEncoded && tagEncoded && ciphertextEncoded);
  const key = createHash("sha256").update(`${authSecret}:totp-secret`, "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

async function main() {
  await loadEnvFile(process.env.GATE_A3_ENV_FILE || ".env.production.local");
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL || process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET?.trim() || "";
  const backupSecret = process.env.BACKUP_ENCRYPTION_SECRET?.trim() || "";
  const cronSecret = process.env.CRON_SECRET?.trim() || "";
  assert.ok(process.env.DATABASE_URL?.startsWith("postgres"));
  assert.ok(authSecret);

  const {prisma} = await import("../lib/db/prisma");
  try {
    const admins = await prisma.adminUser.findMany({
      select: {totpMethod: true, totpEncryptedSecret: true, totpEnrolledAt: true}
    });
    assert.equal(admins.length, 1, "Exactly one production administrator is required.");
    const admin = admins[0];
    assert.equal(admin.totpMethod, "totp");
    assert.ok(admin.totpEncryptedSecret);
    let totpDecryptable = false;
    try {
      const decrypted = decryptTotpSecret(admin.totpEncryptedSecret, authSecret);
      totpDecryptable = /^[A-Z2-7]+=*$/i.test(decrypted) && decrypted.replace(/=+$/, "").length >= 16;
    } catch {
      totpDecryptable = false;
    }
    const sessionCount = await prisma.authSession.count();
    console.log(JSON.stringify({
      environment: {project: "vvviruzcommandcenter-v2", target: "production"},
      authSecret: {configured: true, encodedLength: authSecret.length, meetsMinimum: authSecret.length >= 32},
      separation: {
        backupEncryptionSecretConfigured: Boolean(backupSecret),
        backupEncryptionSecretMeetsRecommendedLength: backupSecret.length >= 32,
        cronSecretConfigured: Boolean(cronSecret),
        cronSecretMeetsRecommendedLength: cronSecret.length >= 24,
        backupEncryptionSecretDistinct: Boolean(backupSecret) && backupSecret !== authSecret,
        cronSecretDistinct: Boolean(cronSecret) && cronSecret !== authSecret
      },
      administrator: {
        count: admins.length,
        totpMethod: admin.totpMethod,
        totpEnrolled: Boolean(admin.totpEnrolledAt),
        encryptedTotpDecryptable: totpDecryptable,
        requiresControlledReenrollment: !totpDecryptable
      },
      sessions: {currentCount: sessionCount, rotationInvalidatesAll: true},
      expectedInvalidation: {
        adminSessionCookies: true,
        spotifyPreviewTokens: true,
        shortLinkAttributionTokens: true,
        passwordResetTokens: false,
        invitationTokens: false,
        artistPreviewTokens: false,
        artistIntakeTokens: false
      }
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
