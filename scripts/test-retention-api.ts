import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

async function main() {
  const route = readFileSync(
    resolve(process.cwd(), "app/api/analytics/retention/releases/[releaseId]/route.ts"),
    "utf8"
  );
  assert.ok(route.includes("requireAuthenticatedApiRequest"), "route requires completed admin auth");
  assert.ok(route.includes('runtime = "nodejs"'));
  assert.ok(route.includes('dynamic = "force-dynamic"'));
  assert.ok(route.includes("RETENTION_CALCULATION_FAILED"), "unexpected failures have a stable code");
  assert.ok(route.includes("RetentionCampaignRequiredError"), "campaign ambiguity returns choices");
  assert.ok(!/rawFileStorageKey|originalValues|raw csv/i.test(route), "route exposes no private raw-file fields");

  const errors = readFileSync(resolve(process.cwd(), "lib/admin-errors.ts"), "utf8");
  for (const code of [
    "RETENTION_RELEASE_NOT_FOUND",
    "RETENTION_CAMPAIGN_REQUIRED",
    "RETENTION_CAMPAIGN_NOT_FOUND",
    "RETENTION_CAMPAIGN_RELEASE_MISMATCH",
    "RETENTION_DATA_UNAVAILABLE",
    "RETENTION_MAPPING_CONFLICT",
    "RETENTION_CALCULATION_FAILED"
  ]) {
    assert.ok(errors.includes(`"${code}"`), `admin errors expose ${code}`);
  }

  console.log("Retention API authorization, runtime, ambiguity, stable-error, and private-field checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
