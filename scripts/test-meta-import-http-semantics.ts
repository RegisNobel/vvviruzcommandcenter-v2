import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildMetaEvidenceBundle,
  MetaImportValidationError,
  type MetaEvidenceInputFile
} from "../lib/ads/meta-evidence-contract";
import {mapMetaImportPreviewError} from "../lib/ads/meta-import-errors";
import {AdminError, adminErrorResponse, normalizeAdminError} from "../lib/server/admin-error-response";

const encoder = new TextEncoder();
const header = "Account ID,Account name,Account timezone,Currency,Campaign ID,Campaign name,Ad set ID,Ad set name,Ad ID,Ad name,Reporting starts,Reporting ends,Amount spent,Impressions,Results,Result indicator,Delivery,Attribution setting";
const row = (spend = "10") => `act-synthetic,Synthetic,America/Los_Angeles,USD,cmp-synthetic,Synthetic campaign,set-synthetic,Synthetic set,ad-synthetic,Synthetic ad,2026-08-10,2026-08-10,${spend},100,2,Link clicks,Active,7-day click`;
const file = (fileName: string, spend = "10"): MetaEvidenceInputFile => ({fileName, bytes: encoder.encode(`${header}\n${row(spend)}`)});
const context = {attributionSetting: "7-day click", expectedGranularity: "DAILY" as const};

function duplicateError(files: MetaEvidenceInputFile[]) {
  try {
    buildMetaEvidenceBundle(files, context);
    assert.fail("Expected duplicate input rejection.");
  } catch (error) {
    assert.ok(error instanceof MetaImportValidationError);
    assert.equal(error.code, "DUPLICATE_IMPORT_FILE");
    assert.equal(error.status, 422);
    return error;
  }
}

const sameName = duplicateError([file("same.csv"), file("same.csv")]);
const differentNames = duplicateError([file("first.csv"), file("renamed.csv")]);
for (const error of [sameName, differentNames]) {
  const mapped = mapMetaImportPreviewError(error);
  assert.ok(mapped instanceof AdminError);
  assert.equal(mapped.code, "DUPLICATE_IMPORT_FILE");
  assert.equal(mapped.status, 422);
  assert.equal(mapped.retryable, false);
  assert.match(mapped.message, /remove the duplicate source file/i);
}

const differentBytes = buildMetaEvidenceBundle([file("first.csv", "10"), file("second.csv", "11")], context);
assert.equal(differentBytes.files.length, 2, "different source bytes are not treated as byte duplicates");
assert.equal(differentBytes.coreTimingEligible, false, "existing authoritative-conflict rules still apply to distinct bytes");
const valid = buildMetaEvidenceBundle([file("valid.csv")], context);
assert.equal(valid.files.length, 1);
assert.equal(valid.mergedDailyRows.length, 1);

let malformedSourceError: unknown;
try {
  buildMetaEvidenceBundle([{fileName: "malformed.csv", bytes: encoder.encode(header)}], context);
} catch (error) {
  malformedSourceError = error;
}
const malformed = mapMetaImportPreviewError(malformedSourceError);
assert.ok(malformed instanceof AdminError);
assert.equal(malformed.code, "INVALID_FILE");
assert.equal(malformed.status, 422);
const expired = new AdminError("Preview has expired.", {code: "EXPIRED_PREVIEW", status: 410});
assert.equal(mapMetaImportPreviewError(expired), expired);

const unexpected = new Error("database connection failed");
assert.equal(mapMetaImportPreviewError(unexpected), unexpected);
const originalError = console.error;
const originalWarn = console.warn;
const errorLogs: unknown[][] = [];
const warningLogs: unknown[][] = [];
console.error = (...values: unknown[]) => { errorLogs.push(values); };
console.warn = (...values: unknown[]) => { warningLogs.push(values); };
try {
  const duplicateResponse = normalizeAdminError(mapMetaImportPreviewError(differentNames), {context: "test.meta-preview", fallbackMessage: "Preview failed."});
  assert.equal(duplicateResponse.status, 422);
  assert.equal(duplicateResponse.payload.code, "DUPLICATE_IMPORT_FILE");
  assert.equal(duplicateResponse.payload.retryable, false);
  assert.doesNotMatch(JSON.stringify(duplicateResponse.payload), /blob|token|credential|stack/i);
  const duplicateHttpResponse = adminErrorResponse(mapMetaImportPreviewError(differentNames), {context: "test.meta-preview", fallbackMessage: "Preview failed."});
  assert.equal(duplicateHttpResponse.status, 422);
  const unexpectedResponse = normalizeAdminError(unexpected, {context: "test.meta-preview", fallbackMessage: "Preview failed."});
  assert.equal(unexpectedResponse.status, 500);
  assert.equal(unexpectedResponse.payload.code, "UNKNOWN");
  assert.equal(unexpectedResponse.payload.message, "Preview failed.");
} finally {
  console.error = originalError;
  console.warn = originalWarn;
}
assert.equal(warningLogs.length, 2, "expected client validation uses warning-level logging");
assert.equal(errorLogs.length, 1, "unexpected failures retain error-level logging");

const ui = fs.readFileSync(path.join(process.cwd(), "components/ads-import-form.tsx"), "utf8");
assert.match(ui, /role="alert"/);
assert.match(ui, /aria-live="assertive"/);
assert.match(ui, /aria-describedby=\{message \? "meta-import-error"/);
assert.match(ui, /clientIdempotencyKey: crypto\.randomUUID\(\)/, "one idempotency key is frozen with each preview");
assert.match(ui, /clientIdempotencyKey: preview\.clientIdempotencyKey/, "commit retries reuse the preview's frozen idempotency key");
assert.match(ui, /campaignEvidenceSync\?\.status === "RETRY_REQUIRED"/, "accepted imports surface post-commit evidence retry status");
assert.match(ui, /The accepted Meta data is safe/, "retry messaging distinguishes accepted data from secondary synchronization");
const route = fs.readFileSync(path.join(process.cwd(), "app/api/ads/import/route.ts"), "utf8");
assert.match(route, /mapMetaImportPreviewError\(error\)/);
assert.match(route, /code: "INVALID_FILE", status: 400/);

console.log(JSON.stringify({
  suite: "meta-import-http-semantics",
  duplicateStatus: 422,
  duplicateCode: "DUPLICATE_IMPORT_FILE",
  sameNameDuplicate: "passed",
  renamedDuplicate: "passed",
  differentBytes: "not-falsely-duplicated",
  validPreviewContract: "passed",
  unexpectedFailureStatus: 500,
  safePayload: true,
  accessibleFeedback: true
}, null, 2));
