import {spawnSync} from "node:child_process";

if (process.env.ALLOW_DISPOSABLE_BACKUP_RESTORE !== "1") {
  console.log("Guarded disposable backup verification: disabled.");
  process.exit(0);
}

const rebuild = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["rebuild", "embedded-postgres"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  shell: false
});
if (rebuild.status !== 0) {
  console.error("Guarded disposable PostgreSQL runtime preparation failed.");
  process.exit(1);
}

const verify = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/verify-production-backup-disposable.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: false
});
process.exit(verify.status ?? 1);
