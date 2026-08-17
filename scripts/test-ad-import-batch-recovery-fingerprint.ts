import assert from "node:assert/strict";
import fs from "node:fs";
import {Prisma} from "@prisma/client";

import {
  AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_FIELDS,
  AD_IMPORT_BATCH_RECOVERY_SELECT,
  canonicalAdImportBatchRecoveryRecord,
  fingerprintAdImportBatchRecovery
} from "../lib/backups/ad-import-batch-recovery-fingerprint";

const nullable = new Set(["releaseId", "idempotencyKey", "withdrawnById", "replacesBatchId"]);
const dates = new Set<string>(AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS);
const booleans = new Set(["campaignIntervalEligible", "coreTimingEligible"]);
const fixture = Object.fromEntries(AD_IMPORT_BATCH_RECOVERY_FIELDS.map((field, index) => {
  if (dates.has(field)) return [field, index % 4 === 0 ? null : "2026-08-13T20:15:12.681Z"];
  if (booleans.has(field)) return [field, index % 2 === 0];
  if (field === "commonCoverageDateCount") return [field, 71];
  if (nullable.has(field)) return [field, null];
  return [field, `${field}-value`];
})) as Record<string, unknown>;
fixture.acceptedById = "accepted-actor";
fixture.releaseId = "release";
fixture.importState = "ACCEPTED";
fixture.sourceAsOfOrigin = "IMPORT_ACCEPTED_FALLBACK";
fixture.coreTimingStart = "2026-06-01T00:00:00.000Z";
fixture.commonCoverageEnd = "2026-08-10T00:00:00.000Z";
fixture.createdAt = "2026-08-13T19:45:12.681Z";
fixture.updatedAt = "2026-08-13T19:45:12.681Z";

const baseline = fingerprintAdImportBatchRecovery(fixture);
const reordered = Object.fromEntries(Object.entries(fixture).reverse());
assert.equal(fingerprintAdImportBatchRecovery(reordered), baseline, "Property order must not affect the fingerprint.");

const datesAsObjects = {...fixture};
for (const field of AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS) {
  if (typeof datesAsObjects[field] === "string") datesAsObjects[field] = new Date(datesAsObjects[field] as string);
}
assert.equal(fingerprintAdImportBatchRecovery(datesAsObjects), baseline, "Date objects and ISO strings must be equivalent.");

const pgTimestampEquivalent = {...fixture, coreTimingStart: new Date("2026-06-01T00:00:00.000Z")};
assert.equal(fingerprintAdImportBatchRecovery(pgTimestampEquivalent), baseline, "PostgreSQL timestamps must normalize to UTC ISO.");

for (const [field, value] of [
  ["name", "substantive-change"],
  ["acceptedById", "different-actor"],
  ["releaseId", "different-release"],
  ["importState", "WITHDRAWN"],
  ["sourceAsOfOrigin", "USER_CONFIRMED"],
  ["coreTimingStart", "2026-06-02T00:00:00.000Z"],
  ["commonCoverageEnd", "2026-08-09T00:00:00.000Z"]
] as const) {
  assert.notEqual(fingerprintAdImportBatchRecovery({...fixture, [field]: value}), baseline, `${field} must affect the fingerprint.`);
}

assert.deepEqual(Object.keys(canonicalAdImportBatchRecoveryRecord(reordered)), AD_IMPORT_BATCH_RECOVERY_FIELDS);
assert.equal(AD_IMPORT_BATCH_RECOVERY_FIELDS.length, 49);
assert.ok(!AD_IMPORT_BATCH_RECOVERY_SELECT.includes("*"));
const prismaFields = Prisma.dmmf.datamodel.models
  .find((model) => model.name === "AdImportBatch")
  ?.fields.filter((field) => field.kind === "scalar")
  .map((field) => field.name);
assert.deepEqual(prismaFields, AD_IMPORT_BATCH_RECOVERY_FIELDS, "The canonical contract must cover every AdImportBatch scalar in schema order.");
assert.throws(() => fingerprintAdImportBatchRecovery(Object.fromEntries(Object.entries(fixture).slice(1))), /field id is missing/);
assert.throws(() => fingerprintAdImportBatchRecovery({...fixture, commonCoverageDateCount: "71"}), /must be an integer/);

const cliRestorer = fs.readFileSync("scripts/import-db-snapshot.ts", "utf8");
const applicationRestorer = fs.readFileSync("lib/backups/restorer.ts", "utf8");
const hydrationPattern = /adImportBatch:\s*\[([^\]]+)\]/;
assert.equal(cliRestorer.match(hydrationPattern)?.[1], applicationRestorer.match(hydrationPattern)?.[1], "Both restore paths must keep identical AdImportBatch hydration rules.");

console.log(JSON.stringify({
  suite: "ad-import-batch-recovery-fingerprint",
  fields: AD_IMPORT_BATCH_RECOVERY_FIELDS.length,
  dates: AD_IMPORT_BATCH_RECOVERY_DATE_FIELDS.length,
  propertyOrderStable: true,
  dateRepresentationStable: true,
  mutationSensitive: true,
  restorePathHydrationAligned: true
}));
