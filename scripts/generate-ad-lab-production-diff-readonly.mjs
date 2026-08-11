import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root = process.cwd();

async function loadEnvFile(fileName) {
  let raw;
  try {
    raw = await fs.readFile(path.resolve(root, fileName), "utf8");
  } catch {
    return;
  }
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

await loadEnvFile(process.env.PRODUCTION_ENV_FILE || ".env.production.local");
const direct = process.env.POSTGRES_URL_NON_POOLING;
if (!direct) throw new Error("POSTGRES_URL_NON_POOLING is unavailable.");
const identity = new URL(direct);
if (!identity.hostname.endsWith("pooler.supabase.com") || identity.port !== "5432" || !decodeURIComponent(identity.username).includes("qkwifxvfrotmmnjluhbt")) {
  throw new Error("Production database identity check failed.");
}

const result = spawnSync(process.execPath, [
  "scripts/run-prisma.mjs",
  "migrate",
  "diff",
  "--from-url",
  direct,
  "--to-schema-datamodel",
  "prisma/schema.postgres.prisma",
  "--script",
], {cwd: root, env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});

if (result.status !== 0) {
  throw new Error(`Read-only Prisma migration diff failed (exit ${result.status}).`);
}

const sql = `${result.stdout.replaceAll(direct, "[REDACTED_DATABASE_URL]").replace(/\r\n/g, "\n").trimEnd()}\n`;
const outputPath = path.join(root, ".codex-temp", "e0-7", "prisma-production-diff.sql");
await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, sql, "utf8");

const statements = sql.split(";\n").map((statement) => statement.trim()).filter(Boolean);
const occurrenceCount = (pattern) => [...sql.matchAll(pattern)].length;
const destructive = statements.filter((statement) => /\b(?:DROP\s+(?:TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE|ALTER\s+COLUMN[^;]*TYPE)\b/i.test(statement));
const unexpected = statements.filter((statement) => !/^(?:--|CREATE\s+(?:TABLE|INDEX|UNIQUE INDEX)|ALTER\s+TABLE[^;]+ADD\s+(?:COLUMN|CONSTRAINT)|DO\s+\$\$)/is.test(statement));

console.log(JSON.stringify({
  productionIdentityVerified: true,
  operation: "READ_ONLY_DIFF",
  output: path.relative(root, outputPath).replaceAll("\\", "/"),
  sha256: crypto.createHash("sha256").update(sql).digest("hex"),
  bytes: Buffer.byteLength(sql),
  statements: statements.length,
  classifications: {
    newTables: occurrenceCount(/\bCREATE TABLE\b/gi),
    additiveColumns: occurrenceCount(/\bADD COLUMN\b/gi),
    foreignKeys: occurrenceCount(/\bFOREIGN KEY\b/gi),
    indexes: occurrenceCount(/\bCREATE (?:UNIQUE )?INDEX\b/gi),
    destructive: destructive.length,
    unexpected: unexpected.length,
  },
  destructiveStatements: destructive.map(() => "REDACTED_UNEXPECTED_OPERATION"),
  unexpectedStatements: unexpected.map((statement) => statement.split(/\r?\n/).at(-1)?.slice(0, 120)),
  secretPrinted: false,
}, null, 2));
