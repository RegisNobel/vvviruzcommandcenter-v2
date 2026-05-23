import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getGeneratedPrismaProvider(): string | null {
  try {
    const root = process.cwd();
    const schemaPath = path.join(root, "node_modules", ".prisma", "client", "schema.prisma");
    if (!fs.existsSync(schemaPath)) {
      return null;
    }
    const content = fs.readFileSync(schemaPath, "utf8");
    const match = content.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function findEnvValue(root: string, files: string[], targetKey: string): string | null {
  for (const file of files) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === targetKey) {
        return value;
      }
    }
  }
  return null;
}

export function ensureDatabaseUrl() {
  const root = process.cwd();
  const provider = getGeneratedPrismaProvider();

  if (provider === "sqlite") {
    const localDbUrl = findEnvValue(root, [".env.local", ".env"], "DATABASE_URL");
    if (localDbUrl && localDbUrl.startsWith("file:")) {
      process.env.DATABASE_URL = localDbUrl;
    } else {
      process.env.DATABASE_URL = "file:../storage/vvviruz-command-center.db";
    }
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  } else {
    loadEnvFile(path.join(root, ".env"));
    loadEnvFile(path.join(root, ".env.local"));

    if (!process.env.DATABASE_URL?.trim()) {
      if (process.env.POSTGRES_PRISMA_URL?.trim()) {
        process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
      } else if (process.env.POSTGRES_URL?.trim()) {
        process.env.DATABASE_URL = process.env.POSTGRES_URL;
      }
    }

    if (!process.env.DIRECT_URL?.trim()) {
      if (process.env.POSTGRES_URL_NON_POOLING?.trim()) {
        process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
      } else if (process.env.DATABASE_URL?.trim()) {
        process.env.DIRECT_URL = process.env.DATABASE_URL;
      }
    }
  }

  return process.env.DATABASE_URL;
}




