import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {Prisma} from "@prisma/client";

import recovery from "../lib/backups/spotify-recovery-fingerprints";

type Case = {
  model: string;
  fields: readonly string[];
  dateFields: readonly string[];
  integerFields: readonly string[];
  nullableStringFields: readonly string[];
  select: string;
  subset: boolean;
  canonical: (records: Record<string, unknown>[]) => Record<string, unknown>[];
  fingerprint: (records: Record<string, unknown>[]) => string;
};

const cases: Case[] = [
  {
    model:"AnalyticsImport", fields:recovery.ANALYTICS_IMPORT_RECOVERY_FIELDS,
    dateFields:recovery.ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS,
    integerFields:["rowCount","acceptedRowCount","rejectedRowCount","unmatchedRowCount","warningCount"],
    nullableStringFields:["replacedByImportId"], select:recovery.ANALYTICS_IMPORT_RECOVERY_SELECT,
    subset:true, canonical:recovery.canonicalAnalyticsImportRecoveryCollection,
    fingerprint:recovery.fingerprintAnalyticsImportRecovery
  },
  {
    model:"ArtistMetricObservation", fields:recovery.ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS,
    dateFields:recovery.ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
    integerFields:["listeners","monthlyListeners","monthlyActiveListeners","streams","playlistAdds","saves","followers"],
    nullableStringFields:[], select:recovery.ARTIST_METRIC_OBSERVATION_RECOVERY_SELECT,
    subset:false, canonical:recovery.canonicalArtistMetricObservationRecoveryCollection,
    fingerprint:recovery.fingerprintArtistMetricObservationRecovery
  },
  {
    model:"TrackMetricObservation", fields:recovery.TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS,
    dateFields:recovery.TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
    integerFields:["streams","listeners","saves","playlistAdds"], nullableStringFields:["spotifyTrackId"],
    select:recovery.TRACK_METRIC_OBSERVATION_RECOVERY_SELECT, subset:false,
    canonical:recovery.canonicalTrackMetricObservationRecoveryCollection,
    fingerprint:recovery.fingerprintTrackMetricObservationRecovery
  },
  {
    model:"SongPeriodSnapshot", fields:recovery.SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
    dateFields:recovery.SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
    integerFields:["listeners","streams","saves"], nullableStringFields:["mappingRowId"],
    select:recovery.SONG_PERIOD_SNAPSHOT_RECOVERY_SELECT, subset:false,
    canonical:recovery.canonicalSongPeriodSnapshotRecoveryCollection,
    fingerprint:recovery.fingerprintSongPeriodSnapshotRecovery
  },
  {
    model:"PlaylistPeriodSnapshot", fields:recovery.PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
    dateFields:recovery.PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
    integerFields:["listeners","streams"], nullableStringFields:["playlistSpotifyId"],
    select:recovery.PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_SELECT, subset:false,
    canonical:recovery.canonicalPlaylistPeriodSnapshotRecoveryCollection,
    fingerprint:recovery.fingerprintPlaylistPeriodSnapshotRecovery
  }
];

const ISO = "2026-08-09T12:34:56.789Z";
const OFFSET_ISO = "2026-08-09T08:34:56.789-04:00";

function fixture(testCase: Case, suffix: string, datesAsObjects = false) {
  const dates = new Set(testCase.dateFields);
  const integers = new Set(testCase.integerFields);
  const nullableStrings = new Set(testCase.nullableStringFields);
  const record = Object.fromEntries(testCase.fields.map((field,index) => {
    if (dates.has(field)) return [field, datesAsObjects ? new Date(ISO) : ISO];
    if (integers.has(field)) return [field, index + 1];
    if (nullableStrings.has(field)) return [field, null];
    return [field, `${field}-${suffix}`];
  })) as Record<string,unknown>;
  record.id = `id-${suffix}`;
  return record;
}

function childProof() {
  process.stdout.write(JSON.stringify(cases.map((testCase) => {
    const records = [fixture(testCase,"b",true),fixture(testCase,"a",true)];
    return {model:testCase.model,canonical:testCase.canonical(records),fingerprint:testCase.fingerprint(records)};
  })));
}

if (process.argv.includes("--timezone-child")) {
  childProof();
} else {
  for (const testCase of cases) {
    const records = [fixture(testCase,"b"),fixture(testCase,"a")];
    const baseline = testCase.fingerprint(records);
    assert.equal(testCase.fingerprint([...records].reverse()),baseline,`${testCase.model} row order must not affect the fingerprint.`);
    assert.equal(testCase.fingerprint(records.map((record)=>Object.fromEntries(Object.entries(record).reverse()))),baseline,`${testCase.model} property order must not affect the fingerprint.`);
    assert.equal(testCase.fingerprint([fixture(testCase,"b",true),fixture(testCase,"a",true)]),baseline,`${testCase.model} Date objects and ISO strings must be equivalent.`);
    const offset = records.map((record)=>({...record}));
    for (const record of offset) for (const field of testCase.dateFields) record[field]=OFFSET_ISO;
    assert.equal(testCase.fingerprint(offset),baseline,`${testCase.model} explicit offsets must normalize to UTC.`);
    assert.deepEqual(Object.keys(testCase.canonical(records)[0]),testCase.fields);
    assert.ok(!testCase.select.includes("*"));

    const scalarFields = Prisma.dmmf.datamodel.models.find((model)=>model.name===testCase.model)?.fields.filter((field)=>field.kind==="scalar").map((field)=>field.name) ?? [];
    const expectedFields = testCase.subset ? scalarFields.filter((field)=>testCase.fields.includes(field)) : scalarFields;
    assert.deepEqual(expectedFields,testCase.fields,`${testCase.model} canonical contract must retain schema order.`);

    const missing={...records[0]}; delete missing[testCase.fields[0]];
    assert.throws(()=>testCase.fingerprint([missing]),/field .* is missing/);
    assert.throws(()=>testCase.fingerprint([{...records[0],[testCase.dateFields[0]]:"2026-08-09 12:34:56.789"}]),/explicit timezone/);
    assert.throws(()=>testCase.fingerprint([{...records[0],[testCase.integerFields[0]]:"1"}]),/must be an integer/);
    const mutationField=testCase.fields.find((field)=>!testCase.dateFields.includes(field)&&!testCase.integerFields.includes(field)&&field!=="id")!;
    assert.notEqual(testCase.fingerprint([{...records[0],[mutationField]:"substantive-change"}]),testCase.fingerprint([records[0]]));
  }

  const script=fileURLToPath(import.meta.url);
  const proofs=["UTC","America/New_York"].map((timezone)=>{
    const child=spawnSync(process.execPath,["--import","tsx",script,"--timezone-child"],{encoding:"utf8",env:{...process.env,TZ:timezone}});
    assert.equal(child.status,0,`${timezone} child failed: ${child.stderr}`);
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(proofs[0],proofs[1],"Spotify canonical collections must be process-timezone invariant.");
  assert.equal(cases.reduce((sum,testCase)=>sum+testCase.fields.length,0),57);
  assert.equal(cases.reduce((sum,testCase)=>sum+testCase.dateFields.length,0),14);
  console.log(JSON.stringify({suite:"spotify-recovery-fingerprints",models:5,datasets:6,selectedScalarFields:57,dateFields:14,analyticsImportSubsetPreserved:true,explicitSelectors:true,collectionOrderStable:true,propertyOrderStable:true,dateRepresentationStable:true,timezoneLessStringsRejected:true,crossTimezoneStable:true,mutationSensitive:true,scalarTypesValidated:true}));
}
