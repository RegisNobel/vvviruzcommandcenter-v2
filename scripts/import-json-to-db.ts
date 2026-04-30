import fs from "node:fs/promises";
import path from "node:path";

import type {AdminUserRecord, AuthSessionRecord} from "../lib/auth/types";
import {writeAdminUser, writeSession} from "../lib/repositories/auth";
import {saveCopy} from "../lib/repositories/copies";
import {saveRelease} from "../lib/repositories/releases";
import {hydrateCopy} from "../lib/copy";
import {hydrateRelease} from "../lib/releases";
import {ensureStorageDirs, storageRoot} from "../lib/server/storage";
import type {CopyRecord, ReleaseRecord} from "../lib/types";
import {prisma} from "../lib/db/prisma";

const authRoot = path.join(storageRoot, "auth");
const sessionsDir = path.join(authRoot, "sessions");
const adminUserPath = path.join(authRoot, "admin-user.json");
const releasesDir = path.join(storageRoot, "releases");
const copiesDir = path.join(storageRoot, "copies");

type ImportCounters = {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
};

type ImportSummary = {
  releases: ImportCounters;
  copies: ImportCounters;
  adminUsers: ImportCounters;
  sessions: ImportCounters;
};

function createCounters(): ImportCounters {
  return {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0
  };
}

function createSummary(): ImportSummary {
  return {
    releases: createCounters(),
    copies: createCounters(),
    adminUsers: createCounters(),
    sessions: createCounters()
  };
}

async function readJsonFiles<T>(directoryPath: string) {
  try {
    const files = (await fs.readdir(directoryPath)).filter((fileName) =>
      fileName.endsWith(".json")
    );

    return Promise.all(
      files.map(async (fileName) => ({
        fileName,
        payload: JSON.parse(
          await fs.readFile(path.join(directoryPath, fileName), "utf8")
        ) as T
      }))
    );
  } catch {
    return [];
  }
}

async function importReleases(summary: ImportSummary) {
  const releases = await readJsonFiles<ReleaseRecord>(releasesDir);

  for (const releaseFile of releases) {
    try {
      const existing = await prisma.release.findUnique({
        where: {
          id: releaseFile.payload.id
        },
        select: {
          id: true
        }
      });

      await saveRelease(hydrateRelease(releaseFile.payload));

      if (existing) {
        summary.releases.updated += 1;
      } else {
        summary.releases.created += 1;
      }
    } catch (error) {
      summary.releases.failed += 1;
      console.error(`[release] ${releaseFile.fileName}:`, error);
    }
  }
}

async function importCopies(summary: ImportSummary) {
  const copies = await readJsonFiles<CopyRecord>(copiesDir);

  for (const copyFile of copies) {
    try {
      const existing = await prisma.copyEntry.findUnique({
        where: {
          id: copyFile.payload.id
        },
        select: {
          id: true
        }
      });

      await saveCopy(hydrateCopy(copyFile.payload));

      if (existing) {
        summary.copies.updated += 1;
      } else {
        summary.copies.created += 1;
      }
    } catch (error) {
      summary.copies.failed += 1;
      console.error(`[copy] ${copyFile.fileName}:`, error);
    }
  }
}

async function importAdminUser(summary: ImportSummary) {
  try {
    const raw = await fs.readFile(adminUserPath, "utf8");
    const payload = JSON.parse(raw) as AdminUserRecord;
    const existing = await prisma.adminUser.findUnique({
      where: {
        id: payload.id
      },
      select: {
        id: true
      }
    });

    await writeAdminUser(payload);

    if (existing) {
      summary.adminUsers.updated += 1;
    } else {
      summary.adminUsers.created += 1;
    }
  } catch {
    summary.adminUsers.skipped += 1;
  }
}

async function importSessions(summary: ImportSummary) {
  const sessions = await readJsonFiles<AuthSessionRecord>(sessionsDir);

  for (const sessionFile of sessions) {
    try {
      const expiresAt = Date.parse(sessionFile.payload.expiresAt);

      if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
        summary.sessions.skipped += 1;
        continue;
      }

      const existing = await prisma.authSession.findUnique({
        where: {
          id: sessionFile.payload.id
        },
        select: {
          id: true
        }
      });

      await writeSession(sessionFile.payload);

      if (existing) {
        summary.sessions.updated += 1;
      } else {
        summary.sessions.created += 1;
      }
    } catch (error) {
      summary.sessions.failed += 1;
      console.error(`[session] ${sessionFile.fileName}:`, error);
    }
  }
}

async function main() {
  await ensureStorageDirs();
  const summary = createSummary();

  await importReleases(summary);
  await importCopies(summary);
  await importAdminUser(summary);
  await importSessions(summary);

  console.log(
    JSON.stringify(
      {
        message: "JSON to SQLite import complete.",
        summary
      },
      null,
      2
    )
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Database import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
