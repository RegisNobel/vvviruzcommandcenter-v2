import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {cwd: process.cwd(), env, encoding: "utf8", shell: false});
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function main() {
  const tempRoot = path.resolve(process.cwd(), ".codex-temp");
  await fs.mkdir(tempRoot, {recursive: true});
  const directory = await fs.mkdtemp(path.join(tempRoot, "stage10-restore-"));
  const relativeDirectory = path.relative(process.cwd(), directory).replace(/\\/g, "/");
  const sourceDb = `../${relativeDirectory}/source.db`;
  const restoredDb = `../${relativeDirectory}/restored.db`;
  const sourceDbPath = path.join(directory, "source.db");
  const restoredDbPath = path.join(directory, "restored.db");
  const blankDbPath = path.join(directory, "blank.db");
  const snapshotPath = path.join(directory, "snapshot.json");
  const fingerprintPath = path.join(directory, "fingerprint.json");
  const baseEnv = {...process.env, ALLOW_DATABASE_URL_OVERRIDE: "1"};
  try {
    const localTemplate = path.resolve(process.cwd(), "storage", "vvviruz-command-center.db");
    await fs.access(localTemplate);
    await fs.copyFile(localTemplate, sourceDbPath);
    const sourceEnv = {...baseEnv, DATABASE_URL: `file:${sourceDb}`, DIRECT_URL: `file:${sourceDb}`, DB_SNAPSHOT_PATH: snapshotPath, STAGE10_FINGERPRINT_PATH: fingerprintPath};
    run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.prisma", "--force-reset", "--skip-generate"], sourceEnv);
    await fs.copyFile(sourceDbPath, blankDbPath);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "seed"], sourceEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "fingerprint"], sourceEnv);
    run(process.execPath, ["--import", "tsx", "scripts/export-db-snapshot.ts"], sourceEnv);
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
    assert.ok(Array.isArray(snapshot.analyticsImportRows) && snapshot.analyticsImportRows.length === 1);
    assert.ok(Array.isArray(snapshot.releaseImportAliases) && snapshot.releaseImportAliases.length === 2);
    assert.ok(Array.isArray(snapshot.mappingAuditEvents) && snapshot.mappingAuditEvents.length === 1);

    const restoredEnv = {...baseEnv, DATABASE_URL: `file:${restoredDb}`, DIRECT_URL: `file:${restoredDb}`, DB_SNAPSHOT_PATH: snapshotPath, STAGE10_FINGERPRINT_PATH: fingerprintPath, IMPORT_AUTH: "1"};
    await fs.copyFile(blankDbPath, restoredDbPath);
    run(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.prisma", "--force-reset", "--skip-generate"], restoredEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], restoredEnv);
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/stage10-backup-fixture.ts", "verify"], restoredEnv);
    console.log("Disposable database export, destruction/recreation, restore, current resolution, calculation equivalence, supersession, audit, and raw-byte exclusion passed.");
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
