import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";

const root = process.cwd();

async function loadEnvFile(fileName: string) {
  const filePath = path.resolve(root, fileName);
  let raw: string;

  try {
    raw = await fs.readFile(filePath, "utf8");
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  await loadEnvFile(".env.production.local");
  await loadEnvFile(".env.local");
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    throw new Error("A production PostgreSQL connection is required.");
  }
  if (!process.env.BACKUP_ENCRYPTION_SECRET || process.env.BACKUP_ENCRYPTION_SECRET.trim().length < 32) {
    throw new Error("BACKUP_ENCRYPTION_SECRET must be configured and at least 32 characters.");
  }

  const [{prisma}, {checksumSha256, encryptBackupArtifact}] = await Promise.all([
    import("../lib/db/prisma"),
    import("../lib/backups/encryption")
  ]);
  const [breakingBarzEntries, breakingBarzVersions, breakingBarzVersionSources, breakingBarzCategories, breakingBarzEntryCategories, breakingBarzSubmissions] = await Promise.all([
    prisma.breakingBarzEntry.findMany(),
    prisma.breakingBarzVersion.findMany(),
    prisma.breakingBarzVersionSource.findMany(),
    prisma.breakingBarzCategory.findMany(),
    prisma.breakingBarzEntryCategory.findMany(),
    prisma.breakingBarzSubmission.findMany()
  ]);
  const releaseAnnotationIds = breakingBarzEntries.flatMap((row) => row.releaseAnnotationId ? [row.releaseAnnotationId] : []);
  const releaseAnnotations = releaseAnnotationIds.length
    ? await prisma.releaseAnnotation.findMany({where: {id: {in: releaseAnnotationIds}}})
    : [];
  const releaseIds = [...new Set([
    ...breakingBarzEntries.flatMap((row) => row.releaseId ? [row.releaseId] : []),
    ...releaseAnnotations.map((row) => row.releaseId)
  ])];
  const releases = releaseIds.length ? await prisma.release.findMany({where: {id: {in: releaseIds}}}) : [];
  const snapshot = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    scope: "gate-a2-breaking-barz-recovery",
    releases,
    releaseAnnotations,
    breakingBarzEntries,
    breakingBarzVersions,
    breakingBarzVersionSources,
    breakingBarzCategories,
    breakingBarzEntryCategories,
    breakingBarzSubmissions
  };
  const compressed = gzipSync(Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), {level: 9});
  const snapshotTables: Record<string, readonly unknown[]> = {
    releases,
    releaseAnnotations,
    breakingBarzEntries,
    breakingBarzVersions,
    breakingBarzVersionSources,
    breakingBarzCategories,
    breakingBarzEntryCategories,
    breakingBarzSubmissions
  };
  const recordCounts = Object.fromEntries(
    Object.entries(snapshotTables).map(([key, value]) => [key, value.length])
  );
  const encrypted = encryptBackupArtifact(compressed);
  const exportedAt = new Date().toISOString();
  const stamp = exportedAt.replace(/[:.]/g, "-");
  const backupId = `gate-a2-breaking-barz-${stamp}`;
  const backupDir = path.resolve(root, "storage", "production-backups");
  const backupPath = path.resolve(backupDir, `${backupId}.json.gz.enc`);
  const metadataPath = path.resolve(backupDir, `${backupId}.metadata.json`);
  if (!backupPath.startsWith(`${backupDir}${path.sep}`)) throw new Error("Unsafe backup path.");
  await fs.mkdir(backupDir, {recursive: true});
  await fs.writeFile(backupPath, encrypted, {flag: "wx", mode: 0o600});

  const relevantCounts = Object.fromEntries(
    [
      "breakingBarzEntries",
      "breakingBarzVersions",
      "breakingBarzVersionSources",
      "breakingBarzCategories",
      "breakingBarzEntryCategories",
      "breakingBarzSubmissions",
      "releases",
      "releaseAnnotations"
    ].map((key) => [key, recordCounts[key] ?? 0])
  );
  const metadata = {
    backupId,
    createdAt: exportedAt,
    source: "production-postgresql",
    encryption: {algorithm: "aes-256-gcm", version: 1},
    encryptedChecksumSha256: checksumSha256(encrypted),
    encryptedSizeBytes: encrypted.byteLength,
    compressedPlaintextChecksumSha256: createHash("sha256").update(compressed).digest("hex"),
    compressedPlaintextSizeBytes: compressed.byteLength,
    relevantRecordCounts: relevantCounts
  };
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {flag: "wx", mode: 0o600});
  console.log(JSON.stringify({...metadata, backupPath, metadataPath}, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
