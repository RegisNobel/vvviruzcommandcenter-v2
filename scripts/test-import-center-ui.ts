import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

import {
  formatValidationValue,
  IMPORT_CENTER_MAX_FILE_BYTES,
  importErrorCopy,
  resolveFinalReviewCounts,
  validateSpotifyCsvFile
} from "../lib/analytics/import-center-ui";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

const supported = validateSpotifyCsvFile({name: "artist-audience.csv", size: 128, type: "text/csv"});
assert.equal(supported.ok, true, "supported CSV should be accepted");
assert.equal(validateSpotifyCsvFile({name: "report.xlsx", size: 128, type: "application/vnd.ms-excel"}).code, "UNSUPPORTED_FILE");
assert.equal(validateSpotifyCsvFile({name: "report.csv", size: IMPORT_CENTER_MAX_FILE_BYTES + 1, type: "text/csv"}).code, "FILE_TOO_LARGE");
assert.match(importErrorCopy("EXPIRED_PREVIEW", "fallback"), /expired/i);
assert.match(importErrorCopy("CONFLICT", "fallback"), /refresh/i);
assert.match(importErrorCopy("DUPLICATE_FILE", "fallback"), /exact file bytes/i);
assert.match(importErrorCopy("RAW_FILE_UNAVAILABLE", "fallback"), /cannot be retried/i);

const identityPendingCounts = {total: 944, structurallyValid: 944, accepted: 0, warnings: 0, rejected: 0, unmatched: 944};
assert.deepEqual(
  resolveFinalReviewCounts("TRACK_STREAM_TIMELINE", identityPendingCounts, {releaseConfirmed: false}),
  {total: 944, structurallyValid: 944, accepted: 0, rejected: 0, unmatched: 944}
);
assert.deepEqual(
  resolveFinalReviewCounts("TRACK_STREAM_TIMELINE", identityPendingCounts, {releaseConfirmed: true}),
  {total: 944, structurallyValid: 944, accepted: 944, rejected: 0, unmatched: 0}
);
assert.equal(formatValidationValue([{code: "UTF8_BOM_REMOVED", message: "A UTF-8 BOM was removed."}]), "UTF8_BOM_REMOVED: A UTF-8 BOM was removed.");
assert.equal(formatValidationValue([{code: "NOTICE", message: "Safe warning"}]).includes("[object Object]"), false);

const importUi = source("components/retention-import-center.tsx");
for (const expected of [
  "Artist Audience Timeline", "Track Stream Timeline", "Songs Period Export", "Playlists Period Export",
  "Ready", "Warnings", "Awaiting Mapping", "Rejected", "Leave unmatched", "Commit import",
  "acknowledgeFilenameNotIdentity", "acknowledgeTrackStreamsNotRetention", "clientIdempotencyKey",
  "importErrorCopy"
]) assert.ok(importUi.includes(expected), `import UI should include ${expected}`);
assert.ok(!importUi.includes("rawFileStorageKey"), "client import UI must not reference raw storage keys");
assert.ok(!importUi.includes("localStorage.setItem"), "import UI must not persist CSV or preview state in browser storage");
assert.doesNotMatch(importUi, /recharts|retention-timeline-chart/i, "Import Center must remain independent from the Stage 9 chart bundle");

const mappingUi = source("components/retention-mapping-center.tsx");
for (const expected of ["Confirm", "Leave unmatched", "Remap", "Revoke alias", "immutable", "title-only alias", "audit history"]) {
  assert.ok(mappingUi.toLowerCase().includes(expected.toLowerCase()), `mapping UI should include ${expected}`);
}
for (const endpoint of ["confirm", "unmatch", "remap", "revoke"]) assert.ok(mappingUi.includes(endpoint), `mapping UI should support ${endpoint}`);

const nav = source("components/command-center-nav.tsx");
assert.ok(nav.includes("Retention Lab") && nav.includes("/admin/retention-lab/imports") && nav.includes("/admin/retention-lab/mappings"));

console.log("Import Center UI deterministic checks passed.");
