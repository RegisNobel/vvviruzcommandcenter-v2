import assert from "node:assert/strict";

import restoreImportContract from "../lib/backups/restore-import-contract.ts";

const {
  requireZeroRestoreProvenanceWarnings,
  RESTORE_IMPORT_RESULT_INVALID,
  RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH,
  RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT,
  runSanitizedSubprocess
} = restoreImportContract;

function result(count, stderr = "") {
  return {
    status: 0,
    stdout: Buffer.from(JSON.stringify({message: "Database snapshot imported.", counts: {restoreProvenanceWarnings: count}})),
    stderr: Buffer.from(stderr)
  };
}

function expectInvariant(code, callback) {
  assert.throws(callback, (error) => error?.invariantCode === code);
}

const complete = requireZeroRestoreProvenanceWarnings(result(0));
assert.equal(complete.counts.restoreProvenanceWarnings, 0);

expectInvariant(RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH, () =>
  requireZeroRestoreProvenanceWarnings(result(1, '{"code":"RESTORE_PROVENANCE_COMPATIBILITY_WARNINGS"}'))
);
expectInvariant(RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH, () =>
  requireZeroRestoreProvenanceWarnings(result(3, "MISSING_ADMIN_ACTOR_REFERENCE"))
);
expectInvariant(RESTORE_IMPORT_RESULT_INVALID, () =>
  requireZeroRestoreProvenanceWarnings({status: 0, stdout: '{"counts":{}}', stderr: ""})
);
expectInvariant(RESTORE_IMPORT_RESULT_INVALID, () =>
  requireZeroRestoreProvenanceWarnings({status: 0, stdout: "not-json", stderr: ""})
);
expectInvariant(RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT, () =>
  requireZeroRestoreProvenanceWarnings(result(0, "RESTORE_PROVENANCE_COMPATIBILITY_WARNINGS"))
);
assert.equal(
  requireZeroRestoreProvenanceWarnings(result(0, "harmless unrelated runtime warning")).counts.restoreProvenanceWarnings,
  0
);
assert.throws(
  () => runSanitizedSubprocess(process.execPath, ["-e", "process.exit(7)"], process.env),
  /Disposable restore subprocess failed safely\./
);

console.log(JSON.stringify({
  suite: "restore-import-contract",
  cases: 8,
  structuredCountAuthoritative: true,
  warningSignalsDefenseInDepth: true,
  subprocessOutputPrinted: false
}));
