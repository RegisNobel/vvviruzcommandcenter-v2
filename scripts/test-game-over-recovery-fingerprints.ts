import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {Prisma} from "@prisma/client";

import recovery from "../lib/backups/game-over-recovery-fingerprints";

const ISO = "2026-08-09T12:34:56.789Z";
const OFFSET_ISO = "2026-08-09T08:34:56.789-04:00";
const importDates = new Set<string>(recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS);
const importIntegers = new Set(["rowCount", "acceptedRowCount", "rejectedRowCount", "unmatchedRowCount", "warningCount", "normalizationVersion", "rawFileSizeBytes"]);
const importNullableStrings = new Set(["commitIdempotencyKey", "uploadedById", "rawFileStorageDriver", "rawFileStorageKey", "withdrawnById", "replacedByImportId"]);
const auditDates = new Set<string>(recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS);
const auditNullableStrings = new Set(["rowId", "importId", "aliasId", "previousMappingStatus", "newMappingStatus", "previousReleaseId", "newReleaseId", "actorId"]);
const rowDates = new Set<string>(recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS);
const rowIntegers = new Set(["sourceRowNumber", "mappingVersion"]);
const rowNullableStrings = new Set(["suggestedReleaseId", "confirmedReleaseId", "confirmedScopeKey", "appliedAliasId", "confirmedById", "unmatchedReason", "unmatchedById"]);

function scalarFixture(fields: readonly string[], options: {
  id: string;
  dates: Set<string>;
  integers?: Set<string>;
  nullableStrings?: Set<string>;
}) {
  const integers = options.integers ?? new Set<string>();
  const nullableStrings = options.nullableStrings ?? new Set<string>();
  const record = Object.fromEntries(fields.map((field, index) => {
    if (options.dates.has(field)) return [field, ISO];
    if (integers.has(field)) return [field, index + 1];
    if (nullableStrings.has(field)) return [field, null];
    return [field, `${field}-${options.id}`];
  })) as Record<string, unknown>;
  record.id = options.id;
  return record;
}

function fixtures() {
  const analyticsImport = scalarFixture(recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS, {
    id: "game-over-import", dates: importDates, integers: importIntegers, nullableStrings: importNullableStrings
  });
  analyticsImport.periodDatesUserConfirmed = true;
  analyticsImport.metadata = JSON.stringify({previewResultChecksum:"preview-checksum",confirmations:{z:true,a:[2,{b:false,a:true}]}});
  analyticsImport.validationSummary = "{}";
  analyticsImport.rawFileSizeBytes = null;
  analyticsImport.rawFileExpiresAt = null;
  analyticsImport.rawFileDeletedAt = null;
  analyticsImport.withdrawnAt = null;

  const auditEvents = ["audit-b", "audit-a"].map((id) => scalarFixture(
    recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS,
    {id, dates:auditDates, nullableStrings:auditNullableStrings}
  ));
  for (const event of auditEvents) event.importId = analyticsImport.id;

  const mappingRows = ["row-b", "row-a"].map((id) => scalarFixture(
    recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS,
    {id, dates:rowDates, integers:rowIntegers, nullableStrings:rowNullableStrings}
  ));
  for (const row of mappingRows) {
    row.importId = analyticsImport.id;
    row.confirmedAt = null;
    row.unmatchedAt = null;
  }
  return {analyticsImport, auditEvents, mappingRows, releaseIds:["release-b","release-a"]};
}

function datesAsObjects(record: Record<string, unknown>, fields: readonly string[]) {
  const copy = {...record};
  for (const field of fields) if (typeof copy[field] === "string") copy[field] = new Date(copy[field] as string);
  return copy;
}

function childProof() {
  const input = fixtures();
  input.analyticsImport = datesAsObjects(input.analyticsImport, recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS);
  input.auditEvents = input.auditEvents.map((event) => datesAsObjects(event, recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS));
  input.mappingRows = input.mappingRows.map((row) => datesAsObjects(row, recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS));
  process.stdout.write(JSON.stringify({
    importRecord: recovery.canonicalGameOverAnalyticsImportRecoveryRecord(input.analyticsImport),
    importFingerprint: recovery.fingerprintGameOverAnalyticsImportRecovery(input.analyticsImport),
    provenance: recovery.canonicalGameOverProvenanceRecovery(input),
    provenanceFingerprint: recovery.fingerprintGameOverProvenanceRecovery(input)
  }));
}

if (process.argv.includes("--timezone-child")) {
  childProof();
} else {
  const input = fixtures();
  const importFingerprint = recovery.fingerprintGameOverAnalyticsImportRecovery(input.analyticsImport);
  const provenanceFingerprint = recovery.fingerprintGameOverProvenanceRecovery(input);

  const reorderedImport = Object.fromEntries(Object.entries(input.analyticsImport).reverse());
  assert.equal(recovery.fingerprintGameOverAnalyticsImportRecovery(reorderedImport), importFingerprint);
  assert.equal(recovery.fingerprintGameOverProvenanceRecovery({...input,analyticsImport:reorderedImport,auditEvents:[...input.auditEvents].reverse(),mappingRows:[...input.mappingRows].reverse(),releaseIds:[...input.releaseIds].reverse()}), provenanceFingerprint);

  const objectDates = {
    analyticsImport: datesAsObjects(input.analyticsImport, recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS),
    auditEvents: input.auditEvents.map((event) => datesAsObjects(event, recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS)),
    mappingRows: input.mappingRows.map((row) => datesAsObjects(row, recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS)),
    releaseIds: input.releaseIds
  };
  assert.equal(recovery.fingerprintGameOverAnalyticsImportRecovery(objectDates.analyticsImport), importFingerprint);
  assert.equal(recovery.fingerprintGameOverProvenanceRecovery(objectDates), provenanceFingerprint);

  const offsetDates = structuredClone(input);
  for (const field of recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS) if (typeof offsetDates.analyticsImport[field] === "string") offsetDates.analyticsImport[field] = OFFSET_ISO;
  for (const event of offsetDates.auditEvents) for (const field of recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS) event[field] = OFFSET_ISO;
  for (const row of offsetDates.mappingRows) for (const field of recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS) if (typeof row[field] === "string") row[field] = OFFSET_ISO;
  assert.equal(recovery.fingerprintGameOverAnalyticsImportRecovery(offsetDates.analyticsImport), importFingerprint);
  assert.equal(recovery.fingerprintGameOverProvenanceRecovery(offsetDates), provenanceFingerprint);

  const reorderedMetadata = {...input.analyticsImport,metadata:JSON.stringify({confirmations:{a:[2,{a:true,b:false}],z:true},previewResultChecksum:"preview-checksum"})};
  assert.equal(recovery.fingerprintGameOverProvenanceRecovery({...input,analyticsImport:reorderedMetadata}), provenanceFingerprint, "Metadata JSON property order must not affect provenance.");
  assert.notEqual(recovery.fingerprintGameOverAnalyticsImportRecovery({...input.analyticsImport,rowCount:999}), importFingerprint);
  assert.notEqual(recovery.fingerprintGameOverProvenanceRecovery({...input,auditEvents:input.auditEvents.map((event,index)=>index?event:{...event,reason:"changed"})}), provenanceFingerprint);

  const importSchemaFields = Prisma.dmmf.datamodel.models.find((model)=>model.name==="AnalyticsImport")?.fields.filter((field)=>field.kind==="scalar").map((field)=>field.name);
  const auditSchemaFields = Prisma.dmmf.datamodel.models.find((model)=>model.name==="MappingAuditEvent")?.fields.filter((field)=>field.kind==="scalar").map((field)=>field.name);
  const rowSchemaFields = Prisma.dmmf.datamodel.models.find((model)=>model.name==="AnalyticsImportRow")?.fields.filter((field)=>field.kind==="scalar").map((field)=>field.name);
  assert.deepEqual(importSchemaFields,recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS);
  assert.deepEqual(auditSchemaFields,recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS);
  assert.deepEqual(rowSchemaFields,recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS);
  assert.deepEqual(Object.keys(recovery.canonicalGameOverAnalyticsImportRecoveryRecord(input.analyticsImport)),recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS);
  assert.ok(!recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_SELECT.includes("*"));
  assert.ok(!recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_SELECT.includes("*"));
  assert.ok(!recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_SELECT.includes("*"));
  assert.throws(()=>recovery.fingerprintGameOverAnalyticsImportRecovery({...input.analyticsImport,uploadedAt:"2026-08-09 12:34:56.789"}),/explicit timezone/);
  assert.throws(()=>recovery.fingerprintGameOverAnalyticsImportRecovery({...input.analyticsImport,rowCount:"1"}),/must be an integer/);
  assert.throws(()=>recovery.fingerprintGameOverAnalyticsImportRecovery({...input.analyticsImport,periodDatesUserConfirmed:"true"}),/must be a boolean/);
  assert.throws(()=>recovery.fingerprintGameOverProvenanceRecovery({...input,releaseIds:[""]}),/non-empty strings/);

  const script = fileURLToPath(import.meta.url);
  const proofs = ["UTC","America/New_York"].map((timezone)=>{
    const child=spawnSync(process.execPath,["--import","tsx",script,"--timezone-child"],{encoding:"utf8",env:{...process.env,TZ:timezone}});
    assert.equal(child.status,0,`${timezone} child failed: ${child.stderr}`);
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(proofs[0],proofs[1],"Game Over recovery contracts must be process-timezone invariant.");
  assert.equal(recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_FIELDS.length,37);
  assert.equal(recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_FIELDS.length,14);
  assert.equal(recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_FIELDS.length,28);
  assert.equal(recovery.GAME_OVER_ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS.length + recovery.GAME_OVER_MAPPING_AUDIT_EVENT_RECOVERY_DATE_FIELDS.length + recovery.GAME_OVER_ANALYTICS_IMPORT_ROW_RECOVERY_DATE_FIELDS.length,16);

  console.log(JSON.stringify({suite:"game-over-recovery-fingerprints",models:3,scalarFields:79,dateFields:16,explicitSelectors:true,schemaOrderExact:true,collectionOrderStable:true,propertyOrderStable:true,jsonPropertyOrderStable:true,dateRepresentationStable:true,timezoneLessStringsRejected:true,crossTimezoneStable:true,mutationSensitive:true,scalarTypesValidated:true}));
}
