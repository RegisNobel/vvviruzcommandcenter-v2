import assert from "node:assert/strict";

import {preserveKnownAdminReferences, type RestoreProvenanceWarning} from "../lib/backups/restore-provenance";

async function main() {
  const client = {adminUser: {async findMany() { return [{id: "known-admin"}]; }}};
  const warnings: RestoreProvenanceWarning[] = [];
  const restored = await preserveKnownAdminReferences(
    client,
    "AnalyticsImport",
    [
      {id: "known-row", uploadedById: "known-admin", withdrawnById: null, payload: "unchanged"},
      {id: "legacy-row", uploadedById: "missing-admin", withdrawnById: "known-admin", payload: "unchanged"}
    ],
    ["uploadedById", "withdrawnById"],
    warnings
  );

  assert.deepEqual(restored, [
    {id: "known-row", uploadedById: "known-admin", withdrawnById: null, payload: "unchanged"},
    {id: "legacy-row", uploadedById: null, withdrawnById: "known-admin", payload: "unchanged"}
  ]);
  assert.deepEqual(warnings, [{code: "MISSING_ADMIN_ACTOR_REFERENCE", model: "AnalyticsImport", recordIndex: 1, field: "uploadedById"}]);
  assert.ok(!JSON.stringify(warnings).includes("missing-admin"), "Warnings must not expose missing actor identifiers.");
  console.log(JSON.stringify({suite: "restore-provenance", knownActorPreserved: true, missingActorWarned: true, rawActorIdentifierExposed: false}));
}

void main();
