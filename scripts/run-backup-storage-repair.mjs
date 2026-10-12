import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {spawnSync} from "node:child_process";

if (process.env.RUN_BACKUP_STORAGE_REPAIR !== "1") process.exit(0);
assert.equal(process.env.VERCEL_ENV, "production");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vcc-storage-repair-"));
const env = {...process.env, BACKUP_REPAIR_DIRECTORY: directory};
function run(args, environment = env, showOutput = false) {
  const result = spawnSync(process.execPath, args, {env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 900_000});
  if (showOutput) process.stdout.write(result.stdout || "");
  if (result.status !== 0) throw new Error(`Backup repair phase failed: ${args.at(-1)}`);
}
let restored = false;
try {
  console.log("Backup repair: verifying a real offsite copy before any cleanup.");
  run(["--conditions=react-server", "--import", "tsx", "scripts/repair-backup-storage.ts", "prepare"], env, true);
  const target = `file:${path.join(directory, "restore.db")}`;
  assert.ok(target.startsWith(`file:${os.tmpdir()}`));
  const localEnv = {...env, DATABASE_URL: target, DIRECT_URL: target, ALLOW_DATABASE_URL_OVERRIDE: "1", DB_SNAPSHOT_PATH: path.join(directory, "snapshot.json"), IMPORT_AUTH: "1"};
  try {
    run(["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.prisma"], localEnv);
    run(["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"], localEnv);
    run(["--conditions=react-server", "--import", "tsx", "scripts/import-db-snapshot.ts"], localEnv);
    run(["--conditions=react-server", "--import", "tsx", "scripts/check-backup-repair-restore.ts"], localEnv, true);
    restored = true;
  } finally {
    run(["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"]);
  }
  assert.ok(restored);
  run(["--conditions=react-server", "--import", "tsx", "scripts/repair-backup-storage.ts", "cleanup"], env, true);
} finally {
  // Only our freshly allocated temporary directory is removed.
  assert.ok(directory.startsWith(path.join(os.tmpdir(), "vcc-storage-repair-")));
  await fs.rm(directory, {recursive: true, force: true});
}
