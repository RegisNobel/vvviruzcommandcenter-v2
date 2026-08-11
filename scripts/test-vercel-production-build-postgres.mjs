import crypto from "node:crypto";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const root = process.cwd();
const runtimeRequire = createRequire(path.join(root, ".codex-temp", "gate-c-runtime", "package.json"));
const EmbeddedPostgres = runtimeRequire("embedded-postgres").default ?? runtimeRequire("embedded-postgres");
const {Client} = runtimeRequire("pg");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
    server.on("error", reject);
  });
}

function databaseUrl(port, password, database) {
  return `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
}

function run(label, args, env) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: !npmCli && process.platform === "win32"});
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}.`);
}

const port = await freePort();
const password = crypto.randomBytes(24).toString("base64url");
const database = "vercel_build_rehearsal";
const dataDir = path.join(root, ".codex-temp", "e0-7", `build-postgres-${crypto.randomUUID()}`);
const embedded = new EmbeddedPostgres({databaseDir: dataDir, user: "postgres", password, port, persistent: false, onLog: () => {}, onError: () => {}});
let started = false;

try {
  await embedded.initialise();
  await embedded.start();
  started = true;
  await embedded.createDatabase(database);
  const url = databaseUrl(port, password, database);
  const env = {
    ...process.env,
    AUTH_SECRET: "local-build-auth-secret-000000000000000000000001",
    CRON_SECRET: "local-build-cron-secret-000000000000000000000001",
    BACKUP_ENCRYPTION_SECRET: "local-build-backup-secret-000000000000000000001",
    DATABASE_URL: url,
    DIRECT_URL: url,
    NEXT_PUBLIC_SITE_URL: "https://example.invalid",
    PRIVATE_STORAGE_DRIVER: "local",
  };
  const prisma = spawnSync(process.execPath, ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"], {cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false});
  if (prisma.status !== 0) throw new Error("Disposable PostgreSQL schema setup failed.");
  const client = new Client({connectionString: url});
  client.on("error", () => {});
  await client.connect();
  await client.query(`INSERT INTO "ArtistProfile" (id,slug,"displayName","draftUpdatedAt","createdAt","updatedAt") VALUES ('build-artist','build-artist','Build Artist',now(),now(),now())`);
  await client.end();
  run("Vercel PostgreSQL production build", ["run", "build:vercel"], env);
  console.log(JSON.stringify({suite: "vercel-production-build-postgres", postgres: "disposable", build: "passed", productionConnections: 0, productionMutations: 0}, null, 2));
} finally {
  if (started) await embedded.stop().catch(() => undefined);
}
