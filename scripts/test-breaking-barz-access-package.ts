import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(root, "prisma", "deployment", "breaking-barz-access");
const tables = [
  "BreakingBarzEntry",
  "BreakingBarzVersion",
  "BreakingBarzVersionSource",
  "BreakingBarzCategory",
  "BreakingBarzEntryCategory",
  "BreakingBarzSubmission"
];

async function read(relativePath: string) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function main() {
  const [readme, preflight, harden, verify, rollback, audit, repository, submissionRoute, adminActions, snapshot, restorer, packageJson] = await Promise.all([
    fs.readFile(path.join(packageDir, "README.md"), "utf8"),
    fs.readFile(path.join(packageDir, "01-preflight.sql"), "utf8"),
    fs.readFile(path.join(packageDir, "02-enable-rls-and-revoke.sql"), "utf8"),
    fs.readFile(path.join(packageDir, "03-verify.sql"), "utf8"),
    fs.readFile(path.join(packageDir, "04-rollback.sql"), "utf8"),
    read("docs/operations/breaking-barz-access-audit.md"),
    read("lib/repositories/breaking-barz.ts"),
    read("app/api/breaking-barz/submissions/route.ts"),
    read("app/admin/(protected)/breaking-barz/actions.ts"),
    read("lib/backups/snapshot.ts"),
    read("lib/backups/restorer.ts"),
    read("package.json")
  ]);

  for (const table of tables) {
    for (const [name, content] of Object.entries({preflight, harden, verify, rollback, audit})) {
      assert.match(content, new RegExp(table), `${name} must cover ${table}`);
    }
    const clientName = table[0].toLowerCase() + table.slice(1);
    assert.match(snapshot, new RegExp(clientName), `snapshot must include ${table}`);
    assert.match(restorer, new RegExp(clientName), `restore must include ${table}`);
  }

  assert.equal((harden.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, tables.length);
  assert.match(harden, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/);
  assert.doesNotMatch(harden, /CREATE\s+POLICY/i);
  assert.match(harden, /existing policies require review/i);
  assert.match(verify, /unexpected policies exist/i);
  assert.match(verify, /SELECT[\s\S]*INSERT[\s\S]*UPDATE[\s\S]*DELETE[\s\S]*TRUNCATE[\s\S]*REFERENCES[\s\S]*TRIGGER[\s\S]*MAINTAIN/);
  assert.equal((rollback.match(/DISABLE ROW LEVEL SECURITY/g) ?? []).length, tables.length);
  assert.match(rollback, /TO anon, authenticated, service_role;/);
  assert.match(rollback, /EMERGENCY ONLY/);

  assert.match(repository, /^import "server-only";/);
  assert.match(repository, /status: "published"/);
  assert.match(repository, /currentPublishedVersionId: \{not: null\}/);
  assert.match(repository, /archivedAt: null/);
  assert.match(repository, /withdrawnAt: null/);
  assert.match(repository, /consumeRateLimit/);
  assert.match(submissionRoute, /createBreakingBarzSubmission/);
  assert.doesNotMatch(submissionRoute, /supabase|\.from\(/i);
  assert.match(adminActions, /requireAuthenticatedAdminSession/);
  assert.doesNotMatch(packageJson, /@supabase\/supabase-js/);

  assert.match(readme, /separate from the Audience Retention Lab/);
  assert.match(readme, /must not be executed/);
  assert.match(audit, /No production grants, RLS state, policies, schema, rows, environment variables, storage, or deployment were changed/);

  console.log("Breaking Barz server-only access model, six-table SQL package, rollback warning, repository boundaries, and backup coverage passed static verification.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
