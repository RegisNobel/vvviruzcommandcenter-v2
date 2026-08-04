import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const tables = [
  "BreakingBarzEntry",
  "BreakingBarzVersion",
  "BreakingBarzVersionSource",
  "BreakingBarzCategory",
  "BreakingBarzEntryCategory",
  "BreakingBarzSubmission"
];

async function loadEnvFile(fileName) {
  let raw;
  try { raw = await fs.readFile(path.resolve(root, fileName), "utf8"); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function authenticatedJwt(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({alg: "HS256", typ: "JWT"});
  const body = base64url({aud: "authenticated", exp: now + 300, iat: now, iss: "supabase", role: "authenticated", sub: crypto.randomUUID()});
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

async function main() {
  await loadEnvFile(".env.production.local");
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  assert.ok(url.startsWith("https://"), "Supabase URL is required.");
  assert.ok(anonKey && serviceKey && jwtSecret, "Supabase role verification credentials are required.");

  const roles = [
    {name: "anon", apiKey: anonKey, authorization: `Bearer ${anonKey}`},
    {name: "authenticated", apiKey: anonKey, authorization: `Bearer ${authenticatedJwt(jwtSecret)}`},
    {name: "service_role", apiKey: serviceKey, authorization: `Bearer ${serviceKey}`}
  ];
  const results = [];
  for (const role of roles) {
    for (const table of tables) {
      const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`, {
        headers: {apikey: role.apiKey, Authorization: role.authorization, Accept: "application/json"}
      });
      let body = null;
      try { body = await response.json(); } catch {}
      const safeCode = body && !Array.isArray(body) && typeof body.code === "string" ? body.code : null;
      assert.ok(response.status === 401 || response.status === 403, `${role.name}/${table} returned HTTP ${response.status}`);
      assert.equal(Array.isArray(body), false, `${role.name}/${table} unexpectedly returned table rows.`);
      results.push({role: role.name, table, httpStatus: response.status, safeErrorCode: safeCode, returnedRows: 0});
    }
  }

  const submissionResponse = await fetch(`${url}/rest/v1/BreakingBarzSubmission`, {
    method: "POST",
    headers: {apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal"},
    body: "{}"
  });
  let submissionBody = null;
  try { submissionBody = await submissionResponse.json(); } catch {}
  assert.ok(submissionResponse.status === 401 || submissionResponse.status === 403);
  assert.equal(Array.isArray(submissionBody), false);

  console.log(JSON.stringify({
    zeroRowChecks: results,
    summary: {roles: roles.length, tables: tables.length, checks: results.length, returnedRows: 0},
    directSubmission: {
      httpStatus: submissionResponse.status,
      safeErrorCode: submissionBody && typeof submissionBody.code === "string" ? submissionBody.code : null,
      returnedRows: 0
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
