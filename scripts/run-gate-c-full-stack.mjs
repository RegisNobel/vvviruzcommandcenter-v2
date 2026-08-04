import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const root = process.cwd();
const tempRoot = path.resolve(root, ".codex-temp");
const rehearsalRoot = path.join(tempRoot, "gate-c-rehearsal");
const statePath = path.join(rehearsalRoot, "state.json");
const runtimeRoot = path.resolve(process.env.GATE_C_POSTGRES_RUNTIME || path.join(tempRoot, "gate-c-runtime"));
const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const embeddedModule = runtimeRequire("embedded-postgres");
const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;

function run(label, args, env, timeoutMs = 300_000) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
    shell: !npmCli && process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (${result.error?.message || `exit ${result.status}`}).\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function passwordHash(password) {
  const salt = "676174652d632d646973706f7361626c65";
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

const state = JSON.parse(await fs.readFile(statePath, "utf8"));
assert.ok(state.deployment, "Gate C deployment rehearsal must pass before the HTTP journey.");
const connectionUrl = `postgresql://postgres:${encodeURIComponent(state.password)}@127.0.0.1:${state.port}/${state.database}?schema=public`;
const password = "Gate-C-Disposable-Admin-Password-2026";
const authSecret = "gate-c-disposable-auth-secret-2026-08-04-not-production";
const env = {
  ...process.env,
  DATABASE_URL: connectionUrl,
  DIRECT_URL: connectionUrl,
  GATE_C_DATABASE_URL: connectionUrl,
  GATE_C_DIRECT_URL: connectionUrl,
  GATE_C_ADMIN_PASSWORD: password,
  GATE_C_RETAIN_FIXTURES: "1",
  AUTH_SECRET: authSecret,
  ADMIN_USERNAME: "gate-c-admin",
  ADMIN_PASSWORD_HASH: passwordHash(password),
  CRON_SECRET: "gate-c-disposable-cron-secret-2026-08-04",
  BACKUP_ENCRYPTION_SECRET: process.env.GATE_C_BACKUP_ENCRYPTION_SECRET || "gate-c-disposable-backup-secret-2026-08-04-strong-synthetic-only",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3009",
  PRIVATE_STORAGE_DRIVER: "vercel-blob",
  PRIVATE_STORAGE_PREVIEW_NAMESPACE: "analytics-preview",
  PRIVATE_STORAGE_RAW_NAMESPACE: "analytics-raw",
  PRIVATE_STORAGE_BACKUP_NAMESPACE: "database-backups",
  PRIVATE_STORAGE_MAX_OBJECT_BYTES: "536870912",
  ANALYTICS_RAW_RETENTION_DAYS: "30"
};
const suitesOnly = process.argv.includes("--postgres-suites");
assert.ok(env.PRIVATE_BLOB_READ_WRITE_TOKEN, "Non-production private Blob credential is required.");
assert.notEqual(env.PRIVATE_BLOB_READ_WRITE_TOKEN, env.BLOB_READ_WRITE_TOKEN, "Public and private Blob credentials must differ.");

const embedded = new EmbeddedPostgres({
  databaseDir: path.join(rehearsalRoot, "postgres-data"),
  user: "postgres",
  password: state.password,
  port: state.port,
  persistent: true,
  onLog: () => {},
  onError: () => {}
});
let started = false;
try {
  await embedded.start();
  started = true;
  if (suitesOnly) {
    const suites = ["test:release-mapping", "test:campaign-timeline", "test:retention-data", "analytics:profile-dashboard"];
    const performancePath = path.join(rehearsalRoot, "postgres-performance.json");
    for (const name of suites) run(`PostgreSQL ${name}`, ["run", name], {...env, ASSET_STORAGE_DRIVER: "local", ...(name === "analytics:profile-dashboard" ? {RETENTION_PROFILE_OUTPUT_PATH: performancePath} : {})}, 600_000);
    state.postgresSuites = {verifiedAt: new Date().toISOString(), suites, result: "passed", performance: JSON.parse(await fs.readFile(performancePath, "utf8"))};
  } else {
    const buildOutput = run("Vercel production build", ["run", "build:vercel"], env, 600_000);
    assert.match(buildOutput, /Compiled successfully|Creating an optimized production build/);
    const browserOutput = run("Gate C PostgreSQL full-stack Playwright", ["exec", "--", "playwright", "test", "tests/retention-stage10-full-stack.spec.ts", "--project=chromium"], env, 600_000);
    assert.match(browserOutput, /1 passed/);
    state.fullStack = {
      verifiedAt: new Date().toISOString(),
      realHttp: true,
      realPasswordLogin: true,
      realTotpChallenge: true,
      privateNonProductionBlob: true,
      playwright: "passed",
      browserPerformance: JSON.parse(await fs.readFile(path.join(rehearsalRoot, "workflow.json"), "utf8")).browserPerformance
    };
  }
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  console.log(JSON.stringify(suitesOnly ? {mode: "postgres-suites", ...state.postgresSuites} : {mode: "full-stack", ...state.fullStack}, null, 2));
} finally {
  if (started) await embedded.stop().catch(() => undefined);
}
