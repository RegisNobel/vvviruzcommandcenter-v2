import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {prisma} from "../lib/db/prisma";
import {parseSpotifyExport} from "../lib/analytics/spotify-export-parser";
import {
  hashRawSpotifyFile,
  parseSpotifyDateOnly,
  sanitizeSpotifyDisplayValue
} from "../lib/analytics/spotify-export-validation";
import type {SpotifyExportFileInput, SpotifyExportParseResult, SpotifyValidationCode} from "../lib/analytics/spotify-export-types";

const fixtures = path.join(process.cwd(), "tests", "fixtures", "spotify-exports");
const encoder = new TextEncoder();

function fromText(text: string, overrides: Partial<SpotifyExportFileInput> = {}) {
  return parseSpotifyExport({fileName: "test.csv", bytes: encoder.encode(text), mimeType: "text/csv", ...overrides});
}

function fixture(name: string, overrides: Partial<SpotifyExportFileInput> = {}) {
  return parseSpotifyExport({fileName: name, bytes: fs.readFileSync(path.join(fixtures, name)), mimeType: "text/csv", ...overrides});
}

function hasCode(result: SpotifyExportParseResult, code: SpotifyValidationCode) {
  return [
    ...result.blockingErrors,
    ...result.fileWarnings,
    ...result.rows.flatMap((row) => [...row.errors, ...row.warnings])
  ].some((entry) => entry.code === code);
}

function assertContract(result: SpotifyExportParseResult) {
  assert.equal(result.rowCount, result.rows.length);
  assert.equal(result.rowCount, result.acceptedCount + result.warningCount + result.rejectedCount + result.unmatchedCount);
  for (const row of result.rows) assert.ok(["ACCEPTED", "REJECTED", "WARNING", "UNMATCHED"].includes(row.outcome));
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(result.parserVersion, "1.0.0");
  assert.equal(result.normalizationVersion, 1);
}

async function databaseCounts() {
  const [imports, artist, track, songs, playlists, releases] = await Promise.all([
    prisma.analyticsImport.count(),
    prisma.artistMetricObservation.count(),
    prisma.trackMetricObservation.count(),
    prisma.songPeriodSnapshot.count(),
    prisma.playlistPeriodSnapshot.count(),
    prisma.release.count()
  ]);
  return {imports, artist, track, songs, playlists, releases};
}

async function main() {
  const before = await databaseCounts();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("Parser attempted a network request."); }) as typeof fetch;

  const artist = fixture("artist-audience-timeline.csv");
  assert.equal(artist.detectedType, "ARTIST_AUDIENCE_TIMELINE");
  assert.equal(artist.acceptedCount, 3);
  assert.deepEqual(artist.rows.map((row) => row.originalRowNumber), [2, 3, 4]);
  assert.deepEqual(artist.rows.map((row) => row.normalizedValues && "metricDate" in row.normalizedValues ? row.normalizedValues.metricDate : null), ["2024-02-28", "2024-02-29", "2024-03-02"]);
  assert.deepEqual(artist.dateRange, {minimumDate: "2024-02-28", maximumDate: "2024-03-02", missingDateCount: 1});
  assert.deepEqual(artist.missingDates, ["2024-03-01"]);
  assertContract(artist);

  const unordered = fromText("date,listeners,monthly listeners,monthly active listeners,streams,playlist adds,saves,followers\n2024-03-02,1,1,1,1,1,1,1\n2024-02-29,2,2,2,2,2,2,2");
  assert.deepEqual(unordered.rows.map((row) => row.originalRowNumber), [3, 2]);

  const duplicateDate = fromText("date,streams\n2024-01-01,1\n2024-01-01,2");
  assert.equal(duplicateDate.rejectedCount, 2);
  assert.ok(duplicateDate.rows.every((row) => row.errors.some(({code}) => code === "DUPLICATE_DATE")));
  assert.deepEqual(duplicateDate.rows.map(({originalRowNumber}) => originalRowNumber), [2, 3]);

  const artistInvalid = fromText("date,listeners,monthly listeners,monthly active listeners,streams,playlist adds,saves,followers\n2023-02-29,-1,1.5,,9e2,12x,9007199254740992,1");
  assert.ok(hasCode(artistInvalid, "INVALID_DATE"));
  assert.ok(hasCode(artistInvalid, "NEGATIVE_METRIC"));
  assert.ok(hasCode(artistInvalid, "INVALID_INTEGER"));
  assert.ok(hasCode(artistInvalid, "EMPTY_REQUIRED_VALUE"));
  assert.ok(hasCode(artistInvalid, "INTEGER_OUT_OF_RANGE"));
  assert.equal(parseSpotifyDateOnly("2024-02-29"), "2024-02-29");
  assert.equal(parseSpotifyDateOnly("2023-02-29"), null);
  assert.equal(parseSpotifyDateOnly("2024-12-31"), "2024-12-31");

  const track = fixture("track-stream-timeline.csv", {fileName: "Definitely Not An Authoritative Track Name.csv"});
  assert.equal(track.detectedType, "TRACK_STREAM_TIMELINE");
  assert.equal(track.dataLabel, "track stream performance");
  assert.equal(track.unmatchedCount, 2);
  assert.ok(track.rows.every((row) => row.warnings.some(({code}) => code === "IDENTITY_NOT_PRESENT")));
  assert.equal(JSON.stringify(track).toLowerCase().includes("listener-retention"), false);
  assert.equal(JSON.stringify(track.rows).includes("Definitely Not An Authoritative Track Name"), false);
  assert.equal(fromText("date,streams\n2024-01-01,1", {fileName: "=formula.csv"}).fileMetadata.safeDisplayFileName, "'=formula.csv");

  const songs = fixture("songs-period.csv");
  assert.equal(songs.detectedType, "SONGS_PERIOD");
  assert.deepEqual(songs.originalHeaders, ["song", "listeners", "streams", "saves", "release_date"]);
  assert.deepEqual(songs.normalizedHeaders, ["song", "listeners", "streams", "saves", "release date"]);
  assert.equal(songs.requiresPeriodConfirmation, true);
  assert.equal(songs.unmatchedCount, 2);
  assert.ok(hasCode(songs, "PERIOD_CONFIRMATION_REQUIRED"));
  const songsWithPeriod = fixture("songs-period.csv", {previewPeriod: {periodStart: "2026-07-01", periodEnd: "2026-07-28"}});
  assert.deepEqual(songsWithPeriod.previewPeriod, {periodStart: "2026-07-01", periodEnd: "2026-07-28"});
  assert.equal(hasCode(songsWithPeriod, "PERIOD_CONFIRMATION_REQUIRED"), false);
  const invalidPeriod = fixture("songs-period.csv", {previewPeriod: {periodStart: "2026-07-29", periodEnd: "2026-07-28"}});
  assert.ok(hasCode(invalidPeriod, "INVALID_PERIOD"));
  const invalidSong = fromText("song,listeners,streams,saves,release_date\n,1,2,3,2026-02-30");
  assert.ok(hasCode(invalidSong, "EMPTY_REQUIRED_VALUE"));
  assert.ok(hasCode(invalidSong, "INVALID_DATE"));
  const duplicateSong = fromText("song,listeners,streams,saves,release_date\nSame,1,2,3,2026-01-01\nSame,4,5,6,2026-01-01");
  assert.equal(duplicateSong.rejectedCount, 2);
  assert.ok(hasCode(duplicateSong, "DUPLICATE_LOGICAL_ROW"));
  const quotedSong = fromText('song,listeners,streams,saves,release_date\n"A, ""Quoted"" Song",1,2,3,2026-01-01');
  assert.equal(quotedSong.rows[0].originalValues.song, 'A, "Quoted" Song');
  const formulaSong = fromText('song,listeners,streams,saves,release_date\n"=SUM(1,1)",1,2,3,2026-01-01');
  assert.equal(formulaSong.rows[0].safeDisplayValues.song, "'=SUM(1,1)");
  assert.ok(hasCode(formulaSong, "FORMULA_PREFIX_ESCAPED"));

  const playlists = fixture("playlists-period.csv");
  assert.equal(playlists.detectedType, "PLAYLISTS_PERIOD");
  assert.equal(playlists.requiresPeriodConfirmation, true);
  assert.equal(playlists.warningCount, 2);
  assert.ok(playlists.rows.every((row) => row.normalizedValues && "dateAdded" in row.normalizedValues && row.normalizedValues.dateAdded === null));
  assert.ok(playlists.rows.every((row) => row.warnings.some(({code}) => code === "DATE_ADDED_NOT_AVAILABLE")));
  assert.equal(playlists.rows[1].safeDisplayValues.date_added, "-");
  const missingAuthor = fromText("title,author,listeners,streams,date_added\nPlaylist,,1,2,n/a");
  assert.ok(hasCode(missingAuthor, "EMPTY_REQUIRED_VALUE"));
  const duplicatePlaylist = fromText("title,author,listeners,streams,date_added\nP,A,1,2,n/a\nP,A,3,4,-");
  assert.equal(duplicatePlaylist.rejectedCount, 2);
  const formulaPlaylist = fromText("title,author,listeners,streams,date_added\n+cmd,@example,1,2,n/a");
  assert.equal(formulaPlaylist.rows[0].safeDisplayValues.title, "'+cmd");
  assert.equal(formulaPlaylist.rows[0].safeDisplayValues.author, "'@example");

  assert.deepEqual(sanitizeSpotifyDisplayValue("=SUM(1,1)"), {originalValue: "=SUM(1,1)", safeValue: "'=SUM(1,1)", escaped: true});
  assert.equal(sanitizeSpotifyDisplayValue("+cmd").safeValue, "'+cmd");
  assert.equal(sanitizeSpotifyDisplayValue("-1").safeValue, "'-1");
  assert.equal(sanitizeSpotifyDisplayValue("@example").safeValue, "'@example");
  assert.deepEqual(sanitizeSpotifyDisplayValue("-", {loneDashPlaceholder: true}), {originalValue: "-", safeValue: "-", escaped: false});
  assert.equal(sanitizeSpotifyDisplayValue("normal title").safeValue, "normal title");

  const bom = fromText("\uFEFFdate,streams\n2024-01-01,1");
  assert.equal(bom.fileMetadata.hadUtf8Bom, true);
  assert.ok(hasCode(bom, "UTF8_BOM_REMOVED"));
  assert.ok(hasCode(parseSpotifyExport({fileName: "missing.csv", bytes: null}), "FILE_NOT_FOUND"));
  assert.ok(hasCode(fromText(""), "EMPTY_FILE"));
  assert.ok(hasCode(fromText("  \r\n \t"), "EMPTY_FILE"));
  assert.ok(hasCode(fromText("date,streams\n2024-01-01,1", {limits: {maxFileBytes: 5}}), "FILE_TOO_LARGE"));
  assert.ok(hasCode(fromText("date,streams\n2024-01-01,1", {fileName: "test.txt"}), "UNSUPPORTED_EXTENSION"));
  assert.ok(hasCode(fromText("date,streams\n2024-01-01,1", {mimeType: "application/pdf"}), "UNSUPPORTED_MIME"));
  assert.ok(hasCode(parseSpotifyExport({fileName: "test.csv", bytes: new Uint8Array([0xff, 0xfe, 0x41])}), "UNSUPPORTED_ENCODING"));
  assert.ok(hasCode(parseSpotifyExport({fileName: "test.csv", bytes: new Uint8Array([0xff, 0xfe, 0x64, 0x00])}), "UNSUPPORTED_ENCODING"));
  assert.ok(hasCode(parseSpotifyExport({fileName: "test.csv", bytes: new Uint8Array([100, 97, 116, 101, 0, 44])}), "NULL_BYTE"));
  assert.ok(hasCode(fromText('date,streams\n"2024-01-01,1'), "MALFORMED_CSV"));
  assert.ok(hasCode(fromText("date,date,streams\n2024-01-01,2024-01-01,1"), "DUPLICATE_HEADER"));
  assert.ok(hasCode(fromText("song,listeners,streams,saves,release_date,release date\nA,1,2,3,2026-01-01,2026-01-01"), "HEADER_COLLISION"));
  assert.ok(hasCode(fromText("date\n2024-01-01"), "MISSING_REQUIRED_HEADER"));
  assert.ok(hasCode(fromText("unknown,headers\na,b"), "UNSUPPORTED_SCHEMA"));
  assert.ok(hasCode(fromText("__proto__,streams\nx,1"), "UNSUPPORTED_SCHEMA"));
  assert.ok(hasCode(fromText("date,listeners,monthly listeners,monthly active listeners,streams,playlist adds,saves,followers,title,author,date_added\n2024-01-01,1,1,1,1,1,1,1,P,A,n/a"), "AMBIGUOUS_SCHEMA"));
  const extra = fromText("date,streams,unverified extra\n2024-01-01,1,x");
  assert.equal(extra.detectedType, "TRACK_STREAM_TIMELINE");
  assert.ok(hasCode(extra, "UNEXPECTED_HEADER"));
  const blanks = fromText("date,streams\n\n2024-01-01,1\r\n  \r\n2024-01-02,2\n");
  assert.equal(blanks.rowCount, 2);
  assert.deepEqual(blanks.rows.map(({originalRowNumber}) => originalRowNumber), [3, 5]);
  assert.ok(hasCode(fromText("date,streams\n2024-01-01,1\n2024-01-02,2", {limits: {maxRows: 1}}), "TOO_MANY_ROWS"));
  assert.ok(hasCode(fromText("date,streams,extra\n2024-01-01,1,x", {limits: {maxColumns: 2}}), "TOO_MANY_COLUMNS"));
  assert.ok(hasCode(fromText("date,streams\n2024-01-01"), "COLUMN_COUNT_MISMATCH"));
  assert.equal(fromText("Date,Streams\n2024-01-01,1").detectedType, "TRACK_STREAM_TIMELINE");
  assert.ok(hasCode(fromText('date,streams\n2024-01-01,"1,000"'), "INVALID_INTEGER"));

  const deterministicInput = fs.readFileSync(path.join(fixtures, "songs-period.csv"));
  assert.equal(hashRawSpotifyFile(deterministicInput), hashRawSpotifyFile(deterministicInput));
  assert.equal(hashRawSpotifyFile(encoder.encode("same bytes")), hashRawSpotifyFile(encoder.encode("same bytes")));
  assert.notEqual(hashRawSpotifyFile(encoder.encode("same bytes")), hashRawSpotifyFile(encoder.encode("different bytes")));
  assert.equal(JSON.stringify(fixture("songs-period.csv")), JSON.stringify(fixture("songs-period.csv")));
  for (const result of [unordered, duplicateDate, track, songs, playlists, extra, blanks]) assertContract(result);

  globalThis.fetch = originalFetch;
  const after = await databaseCounts();
  assert.deepEqual(after, before, "Parser tests must not mutate analytics imports, observations, mappings, or releases.");
  const parserSource = fs.readFileSync(path.join(process.cwd(), "lib", "analytics", "spotify-export-parser.ts"), "utf8");
  assert.equal(/@\/lib\/db|repositories\/analytics|asset-storage|\bfetch\s*\(/.test(parserSource), false, "Pure parser must not depend on persistence, storage, or network code.");
  console.log("Spotify export detection and validation tests passed.");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
