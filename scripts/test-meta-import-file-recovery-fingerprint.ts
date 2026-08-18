import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {Prisma} from "@prisma/client";

import {
  META_IMPORT_FILE_RECOVERY_DATE_FIELDS,
  META_IMPORT_FILE_RECOVERY_FIELDS,
  META_IMPORT_FILE_RECOVERY_SELECT,
  canonicalMetaImportFileRecoveryCollection,
  canonicalMetaImportFileRecoveryRecord,
  fingerprintMetaImportFileRecovery
} from "../lib/backups/meta-import-file-recovery-fingerprint";

const dateFields = new Set<string>(META_IMPORT_FILE_RECOVERY_DATE_FIELDS);
const integerFields = new Set([
  "rowCount",
  "observedDateCount",
  "expectedDateCount",
  "adCount",
  "missingCoreDateCount",
  "rawSizeBytes"
]);
const nullableStrings = new Set(["rawStorageKey", "rawStorageSha256"]);

function fixture(id: string, offset: number) {
  const record = Object.fromEntries(META_IMPORT_FILE_RECOVERY_FIELDS.map((field, index) => {
    if (dateFields.has(field)) return [field, field === "rawDeletedAt" ? null : "2026-08-13T19:45:12.681Z"];
    if (integerFields.has(field)) return [field, index + offset];
    if (nullableStrings.has(field)) return [field, `${field}-${offset}`];
    return [field, `${field}-${offset}`];
  })) as Record<string, unknown>;
  record.id = id;
  record.importBatchId = "mahoraga-import";
  record.expectedDateCount = null;
  return record;
}

function runChild() {
  const records = [fixture("file-b", 20), fixture("file-a", 10)];
  for (const record of records) {
    for (const field of META_IMPORT_FILE_RECOVERY_DATE_FIELDS) {
      if (typeof record[field] === "string") record[field] = new Date(record[field] as string);
    }
  }
  let timezoneLessRejected = false;
  try {
    fingerprintMetaImportFileRecovery([{...records[0], reportingStart: "2026-08-13 19:45:12.681"}]);
  } catch {
    timezoneLessRejected = true;
  }
  process.stdout.write(JSON.stringify({
    dates: META_IMPORT_FILE_RECOVERY_DATE_FIELDS.length,
    fingerprint: fingerprintMetaImportFileRecovery(records),
    records: canonicalMetaImportFileRecoveryCollection(records),
    timezoneLessRejected
  }));
}

if (process.argv.includes("--timezone-child")) {
  runChild();
} else {
  const records = [fixture("file-b", 20), fixture("file-a", 10)];
  const baseline = fingerprintMetaImportFileRecovery(records);
  assert.equal(fingerprintMetaImportFileRecovery([...records].reverse()), baseline, "Record order must not affect the fingerprint.");
  const reorderedProperties = records.map((record) => Object.fromEntries(Object.entries(record).reverse()));
  assert.equal(fingerprintMetaImportFileRecovery(reorderedProperties), baseline, "Property order must not affect the fingerprint.");

  const datesAsObjects = records.map((record) => ({...record}));
  for (const record of datesAsObjects) {
    for (const field of META_IMPORT_FILE_RECOVERY_DATE_FIELDS) {
      if (typeof record[field] === "string") record[field] = new Date(record[field] as string);
    }
  }
  assert.equal(fingerprintMetaImportFileRecovery(datesAsObjects), baseline, "Date objects and ISO strings must be equivalent.");
  const datesWithOffsets = records.map((record) => ({...record}));
  for (const record of datesWithOffsets) {
    for (const field of META_IMPORT_FILE_RECOVERY_DATE_FIELDS) {
      if (typeof record[field] === "string") record[field] = "2026-08-13T15:45:12.681-04:00";
    }
  }
  assert.equal(fingerprintMetaImportFileRecovery(datesWithOffsets), baseline, "Explicit numeric offsets must normalize to the same UTC instant.");
  assert.notEqual(fingerprintMetaImportFileRecovery(records.map((record, index) => index ? record : {...record, rowCount: 999})), baseline);

  assert.deepEqual(Object.keys(canonicalMetaImportFileRecoveryRecord(reorderedProperties[0])), META_IMPORT_FILE_RECOVERY_FIELDS);
  assert.deepEqual(canonicalMetaImportFileRecoveryCollection(records).map((record) => record.id), ["file-a", "file-b"]);
  assert.deepEqual(
    canonicalMetaImportFileRecoveryCollection([{...records[0], id: "ä"}, {...records[0], id: "z"}]).map((record) => record.id),
    ["z", "ä"],
    "Collection ordering must use locale-independent code-unit order."
  );
  assert.equal(META_IMPORT_FILE_RECOVERY_FIELDS.length, 24);
  assert.equal(META_IMPORT_FILE_RECOVERY_DATE_FIELDS.length, 5);
  assert.ok(!META_IMPORT_FILE_RECOVERY_SELECT.includes("*"));
  const prismaFields = Prisma.dmmf.datamodel.models
    .find((model) => model.name === "MetaImportFile")
    ?.fields.filter((field) => field.kind === "scalar")
    .map((field) => field.name);
  assert.deepEqual(prismaFields, META_IMPORT_FILE_RECOVERY_FIELDS, "The canonical contract must cover every MetaImportFile scalar in schema order.");
  assert.throws(() => fingerprintMetaImportFileRecovery([Object.fromEntries(Object.entries(records[0]).slice(1))]), /field id is missing/);
  assert.throws(() => fingerprintMetaImportFileRecovery([{...records[0], rowCount: "1"}]), /must be an integer/);
  assert.throws(() => fingerprintMetaImportFileRecovery([{...records[0], rawDeletedAt: "2026-99-99T00:00:00Z"}]), /not a valid date/);
  assert.throws(
    () => fingerprintMetaImportFileRecovery([{...records[0], reportingStart: "2026-08-13 19:45:12.681"}]),
    /must include an explicit timezone/
  );

  const script = fileURLToPath(import.meta.url);
  const proofs = ["UTC", "America/New_York"].map((timezone) => {
    const child = spawnSync(process.execPath, ["--import", "tsx", script, "--timezone-child"], {
      encoding: "utf8",
      env: {...process.env, TZ: timezone}
    });
    assert.equal(child.status, 0, `${timezone} child failed: ${child.stderr}`);
    return JSON.parse(child.stdout) as {dates: number; fingerprint: string; records: unknown[]; timezoneLessRejected: boolean};
  });
  assert.equal(proofs[0].dates, 5);
  assert.equal(proofs[1].dates, 5);
  assert.deepEqual(proofs[0].records, proofs[1].records, "Canonical records must be timezone invariant.");
  assert.equal(proofs[0].fingerprint, proofs[1].fingerprint, "Fingerprints must be timezone invariant.");
  assert.equal(proofs[0].timezoneLessRejected, true, "UTC child must reject timezone-less strings.");
  assert.equal(proofs[1].timezoneLessRejected, true, "New York child must reject timezone-less strings.");

  console.log(JSON.stringify({
    suite: "meta-import-file-recovery-fingerprint",
    fields: META_IMPORT_FILE_RECOVERY_FIELDS.length,
    dates: META_IMPORT_FILE_RECOVERY_DATE_FIELDS.length,
    collectionOrderStable: true,
    propertyOrderStable: true,
    dateRepresentationStable: true,
    timezoneLessStringsRejected: true,
    crossTimezoneStable: true,
    localeIndependentOrdering: true,
    mutationSensitive: true
  }));
}
