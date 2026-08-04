import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

const root = process.cwd();
const tempRoot = path.resolve(root, ".codex-temp");
const runtimeRoot = path.resolve(
  process.env.GATE_A2_POSTGRES_RUNTIME || path.join(tempRoot, "gate-a2-runtime")
);
const packageRoot = path.join(root, "prisma", "deployment", "breaking-barz-access");
const dataDir = path.resolve(tempRoot, `gate-a2-postgres-${crypto.randomUUID()}`);
const password = crypto.randomBytes(24).toString("base64url");
const databaseName = "gate_a2_rehearsal";

assert.ok(dataDir.startsWith(`${tempRoot}${path.sep}`), "Temporary PostgreSQL data must stay inside .codex-temp.");

const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));
const embeddedModule = runtimeRequire("embedded-postgres");
const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
const {Client} = runtimeRequire("pg");

const tables = [
  "BreakingBarzEntry",
  "BreakingBarzVersion",
  "BreakingBarzVersionSource",
  "BreakingBarzCategory",
  "BreakingBarzEntryCategory",
  "BreakingBarzSubmission"
];

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function npmInvocation(args) {
  if (process.env.npm_execpath) {
    return {command: process.execPath, args: [process.env.npm_execpath, ...args]};
  }
  return {command: commandName("npm"), args};
}

function runCommand(label, command, args, env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {...process.env, ...env},
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
  });
  if (result.error || result.status !== 0) {
    const failure = result.error ? `${result.error.name}: ${result.error.message}` : `exit ${result.status}`;
    throw new Error(`${label} failed (${failure}).\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return `${result.stdout}${result.stderr}`.trim();
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function sqlFile(name) {
  return fs.readFile(path.join(packageRoot, name), "utf8");
}

async function expectDenied(client, role, sql, operation) {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query(sql);
    assert.fail(`${role} ${operation} unexpectedly succeeded.`);
  } catch (error) {
    assert.equal(error.code, "42501", `${role} ${operation} must fail with insufficient_privilege.`);
  } finally {
    await client.query("ROLLBACK");
  }
  return {role, operation, code: "42501"};
}

async function roleDenialChecks(client) {
  const results = [];
  for (const role of ["anon", "authenticated"]) {
    results.push(await expectDenied(client, role, 'SELECT * FROM public."BreakingBarzEntry" LIMIT 0', "select"));
    results.push(await expectDenied(client, role, `INSERT INTO public."BreakingBarzSubmission" (id, "songTitle", "lyricExcerpt") VALUES ('denied-${role}', 'Denied', 'Denied')`, "insert"));
    results.push(await expectDenied(client, role, `UPDATE public."BreakingBarzEntry" SET "songTitle"='Denied' WHERE id='gate-a2-published'`, "update"));
    results.push(await expectDenied(client, role, `DELETE FROM public."BreakingBarzEntry" WHERE id='gate-a2-published'`, "delete"));
  }
  results.push(await expectDenied(client, "service_role", 'SELECT * FROM public."BreakingBarzEntry" LIMIT 0', "select"));
  results.push(await expectDenied(client, "service_role", `INSERT INTO public."BreakingBarzSubmission" (id, "songTitle", "lyricExcerpt") VALUES ('denied-service', 'Denied', 'Denied')`, "insert"));
  return results;
}

async function hardeningState(client) {
  const state = await client.query(`
    SELECT c.relname AS table_name,
           pg_get_userbyid(c.relowner) AS owner,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS force_rls,
           (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count,
           has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
           has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
           has_table_privilege('service_role', c.oid, 'SELECT') AS service_select
    FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relname = ANY($1)
    ORDER BY c.relname
  `, [tables]);
  assert.equal(state.rows.length, tables.length);
  for (const row of state.rows) {
    assert.equal(row.owner, "postgres");
    assert.equal(row.rls_enabled, true);
    assert.equal(row.force_rls, false);
    assert.equal(row.policy_count, 0);
    assert.equal(row.anon_select, false);
    assert.equal(row.authenticated_select, false);
    assert.equal(row.service_select, false);
  }
  return state.rows;
}

async function main() {
  const port = await availablePort();
  assert.ok(port);
  const embedded = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password,
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {}
  });
  let client;
  let started = false;
  const connectionUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${databaseName}?schema=public`;
  const databaseEnv = {DATABASE_URL: connectionUrl, DIRECT_URL: connectionUrl};

  try {
    await embedded.initialise();
    await embedded.start();
    started = true;
    await embedded.createDatabase(databaseName);

    runCommand(
      "Prisma PostgreSQL db push",
      "node",
      ["scripts/run-prisma.mjs", "db", "push", "--schema", "prisma/schema.postgres.prisma", "--skip-generate"],
      databaseEnv
    );

    client = new Client({connectionString: connectionUrl});
    await client.connect();
    const version = await client.query("SELECT current_setting('server_version') AS version");
    assert.match(version.rows[0].version, /^17\./);

    await client.query(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;

      INSERT INTO public."Release" (id, title, slug, "isPublished", "createdOn", "updatedOn")
      VALUES ('gate-a2-release', 'Gate A2 Release', 'gate-a2-release', true, now(), now());

      INSERT INTO public."ReleaseAnnotation" (
        id, "releaseId", title, summary, explanation, status, "isPublic",
        "excerptSnapshot", "lyricExcerpt", "createdAt", "updatedAt"
      ) VALUES (
        'gate-a2-annotation', 'gate-a2-release', 'Gate A2 annotation',
        'Published summary', 'Published explanation', 'ready', true,
        'Published line', 'Published line', now(), now()
      );

      INSERT INTO public."BreakingBarzCategory" (id, name, slug, "sortOrder", "isActive", "createdAt", "updatedAt")
      VALUES
        ('gate-a2-category', 'Wordplay', 'wordplay', 10, true, now(), now()),
        ('gate-a2-category-metaphor', 'Metaphor', 'metaphor', 20, true, now(), now());

      INSERT INTO public."BreakingBarzEntry" (
        id, slug, "releaseId", "releaseAnnotationId", "songTitle", "artistNames",
        status, "publishedAt", "createdAt", "updatedAt"
      ) VALUES (
        'gate-a2-published', 'gate-a2-published', 'gate-a2-release', 'gate-a2-annotation',
        'Published song', '["Test Artist"]', 'published', now(), now(), now()
      );

      INSERT INTO public."BreakingBarzVersion" (
        id, "entryId", version, "songTitle", "artistNames", "categorySlugs",
        "lyricExcerpt", summary, breakdown, "verificationStatus", "verificationNote",
        "editorialStatus", "createdAt", "publishedAt"
      ) VALUES (
        'gate-a2-version-published', 'gate-a2-published', 1, 'Published song',
        '["Test Artist"]', '["wordplay"]', 'Published line', 'Published summary',
        'Published explanation', 'verified_breakdown', '', 'published', now(), now()
      );

      UPDATE public."BreakingBarzEntry"
      SET "currentPublishedVersionId"='gate-a2-version-published'
      WHERE id='gate-a2-published';

      INSERT INTO public."BreakingBarzVersionSource" (id, "versionId", label, url, "sortOrder", "createdAt")
      VALUES ('gate-a2-source', 'gate-a2-version-published', 'Source', 'https://example.com/source', 0, now());

      INSERT INTO public."BreakingBarzEntryCategory" ("entryId", "categoryId")
      VALUES ('gate-a2-published', 'gate-a2-category');

      INSERT INTO public."BreakingBarzEntry" (
        id, slug, "songTitle", "artistNames", status, "withdrawnAt", "createdAt", "updatedAt"
      ) VALUES (
        'gate-a2-withdrawn', 'gate-a2-withdrawn', 'Withdrawn song', '["Test Artist"]',
        'withdrawn', now(), now(), now()
      );

      INSERT INTO public."BreakingBarzVersion" (
        id, "entryId", version, "songTitle", "artistNames", "lyricExcerpt", summary,
        breakdown, "verificationStatus", "verificationNote", "editorialStatus", "createdAt"
      ) VALUES (
        'gate-a2-version-draft', 'gate-a2-withdrawn', 1, 'Draft song', '["Test Artist"]',
        'Draft line', 'Draft summary', 'Draft explanation', 'interpretation',
        'Private verification note', 'draft', now()
      );

      INSERT INTO public."BreakingBarzSubmission" (
        id, "songTitle", "artistNames", "lyricExcerpt", summary, breakdown, "songUrl",
        "submitterName", "submitterEmail", status, "reviewNote", "submittedAt"
      ) VALUES (
        'gate-a2-submission', 'Submitted song', '["Fan Artist"]', 'Submitted line',
        'Submitted summary', 'Submitted explanation', 'https://example.com/song',
        'Private Test Name', 'private-test@example.com', 'pending', '', now()
      );
    `);

    await client.query(`GRANT ALL PRIVILEGES ON TABLE ${tables.map((table) => `public."${table}"`).join(", ")} TO anon, authenticated, service_role`);
    for (const table of tables) await client.query(`ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY`);

    const broad = await client.query(`
      SELECT count(*)::int AS count
      FROM unnest($1::text[]) table_name
      CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) role_name
      WHERE has_table_privilege(role_name, format('public.%I', table_name), 'SELECT')
        AND has_table_privilege(role_name, format('public.%I', table_name), 'INSERT')
        AND has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE')
        AND has_table_privilege(role_name, format('public.%I', table_name), 'DELETE')
    `, [tables]);
    assert.equal(broad.rows[0].count, tables.length * 3);

    await client.query(await sqlFile("01-preflight.sql"));
    await client.query(await sqlFile("02-enable-rls-and-revoke.sql"));
    await client.query(await sqlFile("03-verify.sql"));
    const firstState = await hardeningState(client);
    const firstDenials = await roleDenialChecks(client);

    const ownerCount = await client.query('SELECT count(*)::int AS count FROM public."BreakingBarzEntry"');
    assert.equal(ownerCount.rows[0].count, 2);

    await client.query(await sqlFile("04-rollback.sql"));
    const rollbackState = await client.query(`
      SELECT count(*)::int AS count
      FROM pg_class c
      WHERE c.relnamespace='public'::regnamespace
        AND c.relname = ANY($1)
        AND NOT c.relrowsecurity
        AND has_table_privilege('anon', c.oid, 'SELECT')
        AND has_table_privilege('authenticated', c.oid, 'INSERT')
        AND has_table_privilege('service_role', c.oid, 'DELETE')
    `, [tables]);
    assert.equal(rollbackState.rows[0].count, tables.length);
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE anon");
    const rollbackRead = await client.query('SELECT count(*)::int AS count FROM public."BreakingBarzEntry"');
    await client.query("ROLLBACK");
    assert.equal(rollbackRead.rows[0].count, 2);

    await client.query(await sqlFile("02-enable-rls-and-revoke.sql"));
    await client.query(await sqlFile("03-verify.sql"));
    const finalState = await hardeningState(client);
    const finalDenials = await roleDenialChecks(client);

    runCommand(
      "Prisma PostgreSQL generation",
      "node",
      ["scripts/run-prisma.mjs", "generate", "--schema", "prisma/schema.postgres.prisma"],
      databaseEnv
    );
    const discoveryCommand = npmInvocation(["run", "test:breaking-barz-discovery"]);
    const discoveryOutput = runCommand(
      "Breaking Barz discovery compatibility",
      discoveryCommand.command,
      discoveryCommand.args,
      databaseEnv
    );
    assert.match(discoveryOutput, /Breaking Barz discovery checks passed/);
    const inventoryCommand = npmInvocation(["run", "breaking-barz:inventory"]);
    const inventoryOutput = runCommand(
      "Breaking Barz inventory compatibility",
      inventoryCommand.command,
      inventoryCommand.args,
      databaseEnv
    );
    assert.match(inventoryOutput, /"readOnly": true/);
    const backfillCommand = npmInvocation(["run", "breaking-barz:backfill"]);
    const backfillOutput = runCommand(
      "Breaking Barz backfill dry-run compatibility",
      backfillCommand.command,
      backfillCommand.args,
      databaseEnv
    );
    assert.match(backfillOutput, /"mode": "dry-run"/);

    const representative = await client.query(`
      SELECT
        (SELECT count(*)::int FROM public."BreakingBarzEntry" WHERE status='published') AS published_entries,
        (SELECT count(*)::int FROM public."BreakingBarzVersion" WHERE "editorialStatus"='draft') AS draft_versions,
        (SELECT count(*)::int FROM public."BreakingBarzEntry" WHERE status IN ('archived','withdrawn')) AS hidden_entries,
        (SELECT count(*)::int FROM public."BreakingBarzCategory" WHERE "isActive") AS active_categories,
        (SELECT count(*)::int FROM public."BreakingBarzEntryCategory") AS category_relationships,
        (SELECT count(*)::int FROM public."BreakingBarzSubmission" WHERE status='pending' AND btrim("submitterEmail") <> '') AS private_pending_submissions
    `);
    const policyCount = await client.query(`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname='public' AND tablename = ANY($1)`, [tables]);
    assert.equal(policyCount.rows[0].count, 0);

    console.log(JSON.stringify({
      postgresVersion: version.rows[0].version,
      representativeData: representative.rows[0],
      firstHardening: {tables: firstState.length, deniedOperations: firstDenials.length},
      rollback: {tablesRestoredToBroadAccess: rollbackState.rows[0].count, anonReadSucceeded: true},
      reappliedHardening: {tables: finalState.length, deniedOperations: finalDenials.length, policyCount: 0},
      prismaCompatibility: {discovery: "passed", inventory: "passed", backfillDryRun: "passed"}
    }, null, 2));
  } finally {
    if (client) await client.end().catch(() => {});
    if (started) await embedded.stop().catch(() => {});
    runCommand("Restore SQLite Prisma generation", "node", ["scripts/run-prisma.mjs", "generate"], {});
    await fs.rm(dataDir, {recursive: true, force: true});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
