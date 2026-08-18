import {createHash} from "node:crypto";

type Contract = Readonly<{
  model: string;
  fields: readonly string[];
  dateFields: readonly string[];
  requiredDateFields: readonly string[];
  integerFields: readonly string[];
  nullableIntegerFields: readonly string[];
  nullableStringFields: readonly string[];
}>;

const TIMEZONE_QUALIFIED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const ANALYTICS_IMPORT_RECOVERY_FIELDS = [
  "id", "importType", "fileHash", "status", "rowCount", "acceptedRowCount", "rejectedRowCount",
  "unmatchedRowCount", "warningCount", "acceptedAt", "withdrawnAt", "replacedByImportId"
] as const;
export const ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS = ["acceptedAt", "withdrawnAt"] as const;

export const ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS = [
  "id", "importId", "artistProfileId", "metricDate", "listeners", "monthlyListeners",
  "monthlyActiveListeners", "streams", "playlistAdds", "saves", "followers", "createdAt"
] as const;
export const ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS = ["metricDate", "createdAt"] as const;

export const TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS = [
  "id", "importId", "releaseId", "spotifyTrackId", "metricDate", "streams", "listeners", "saves",
  "playlistAdds", "createdAt"
] as const;
export const TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS = ["metricDate", "createdAt"] as const;

export const SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS = [
  "id", "importId", "releaseId", "periodStart", "periodEnd", "exportedTitle", "exportedReleaseDate",
  "listeners", "streams", "saves", "createdAt", "mappingRowId"
] as const;
export const SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS = [
  "periodStart", "periodEnd", "exportedReleaseDate", "createdAt"
] as const;

export const PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS = [
  "id", "importId", "playlistTitle", "playlistAuthor", "playlistSpotifyId", "periodStart", "periodEnd",
  "listeners", "streams", "dateAdded", "createdAt"
] as const;
export const PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS = [
  "periodStart", "periodEnd", "dateAdded", "createdAt"
] as const;

const CONTRACTS = {
  analyticsImport: {
    model: "AnalyticsImport",
    fields: ANALYTICS_IMPORT_RECOVERY_FIELDS,
    dateFields: ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS,
    requiredDateFields: [],
    integerFields: ["rowCount", "acceptedRowCount", "rejectedRowCount", "unmatchedRowCount", "warningCount"],
    nullableIntegerFields: [],
    nullableStringFields: ["replacedByImportId"]
  },
  artistMetricObservation: {
    model: "ArtistMetricObservation",
    fields: ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS,
    dateFields: ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["metricDate", "createdAt"],
    integerFields: ["listeners", "monthlyListeners", "monthlyActiveListeners", "streams", "playlistAdds", "saves", "followers"],
    nullableIntegerFields: [], nullableStringFields: []
  },
  trackMetricObservation: {
    model: "TrackMetricObservation",
    fields: TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS,
    dateFields: TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["metricDate", "createdAt"],
    integerFields: ["streams", "listeners", "saves", "playlistAdds"],
    nullableIntegerFields: ["listeners", "saves", "playlistAdds"],
    nullableStringFields: ["spotifyTrackId"]
  },
  songPeriodSnapshot: {
    model: "SongPeriodSnapshot",
    fields: SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
    dateFields: SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["periodStart", "periodEnd", "exportedReleaseDate", "createdAt"],
    integerFields: ["listeners", "streams", "saves"], nullableIntegerFields: [],
    nullableStringFields: ["mappingRowId"]
  },
  playlistPeriodSnapshot: {
    model: "PlaylistPeriodSnapshot",
    fields: PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS,
    dateFields: PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS,
    requiredDateFields: ["periodStart", "periodEnd", "createdAt"],
    integerFields: ["listeners", "streams"], nullableIntegerFields: [],
    nullableStringFields: ["playlistSpotifyId"]
  }
} as const satisfies Record<string, Contract>;

export const ANALYTICS_IMPORT_RECOVERY_SELECT = ANALYTICS_IMPORT_RECOVERY_FIELDS.map((field) => `i."${field}"`).join(",");
export const ARTIST_METRIC_OBSERVATION_RECOVERY_SELECT = ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS.map((field) => `o."${field}"`).join(",");
export const TRACK_METRIC_OBSERVATION_RECOVERY_SELECT = TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS.map((field) => `o."${field}"`).join(",");
export const SONG_PERIOD_SNAPSHOT_RECOVERY_SELECT = SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS.map((field) => `s."${field}"`).join(",");
export const PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_SELECT = PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS.map((field) => `p."${field}"`).join(",");

function canonicalDate(contract: Contract, field: string, value: unknown) {
  if (value === null) {
    if (contract.requiredDateFields.includes(field)) throw new TypeError(`${contract.model} recovery field ${field} must be a date.`);
    return null;
  }
  if (!(typeof value === "string" || value instanceof Date)) throw new TypeError(`${contract.model} recovery field ${field} must be a date or null.`);
  if (typeof value === "string" && !TIMEZONE_QUALIFIED_TIMESTAMP.test(value)) throw new TypeError(`${contract.model} recovery field ${field} must include an explicit timezone.`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(`${contract.model} recovery field ${field} is not a valid date.`);
  return date.toISOString();
}

function canonicalRecord(contract: Contract, record: Record<string, unknown>) {
  for (const field of contract.fields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) throw new TypeError(`${contract.model} recovery field ${field} is missing.`);
  }
  return Object.fromEntries(contract.fields.map((field) => {
    const value = record[field];
    if (contract.dateFields.includes(field)) return [field, canonicalDate(contract, field, value)];
    if (contract.integerFields.includes(field)) {
      if (value === null && contract.nullableIntegerFields.includes(field)) return [field, null];
      if (!Number.isSafeInteger(value)) throw new TypeError(`${contract.model} recovery field ${field} must be an integer.`);
      return [field, value];
    }
    if (value === null && contract.nullableStringFields.includes(field)) return [field, null];
    if (typeof value !== "string") throw new TypeError(`${contract.model} recovery field ${field} must be a string.`);
    return [field, value];
  }));
}

function canonicalCollection(contract: Contract, records: Record<string, unknown>[]) {
  return records.map((record) => canonicalRecord(contract, record)).sort((left, right) => {
    const leftId = left.id as string;
    const rightId = right.id as string;
    return leftId === rightId ? 0 : leftId < rightId ? -1 : 1;
  });
}

function fingerprintCollection(contract: Contract, records: Record<string, unknown>[]) {
  return createHash("sha256").update(JSON.stringify(canonicalCollection(contract, records))).digest("hex");
}

export const canonicalAnalyticsImportRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.analyticsImport, records);
export const fingerprintAnalyticsImportRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.analyticsImport, records);
export const canonicalArtistMetricObservationRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.artistMetricObservation, records);
export const fingerprintArtistMetricObservationRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.artistMetricObservation, records);
export const canonicalTrackMetricObservationRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.trackMetricObservation, records);
export const fingerprintTrackMetricObservationRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.trackMetricObservation, records);
export const canonicalSongPeriodSnapshotRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.songPeriodSnapshot, records);
export const fingerprintSongPeriodSnapshotRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.songPeriodSnapshot, records);
export const canonicalPlaylistPeriodSnapshotRecoveryCollection = (records: Record<string, unknown>[]) => canonicalCollection(CONTRACTS.playlistPeriodSnapshot, records);
export const fingerprintPlaylistPeriodSnapshotRecovery = (records: Record<string, unknown>[]) => fingerprintCollection(CONTRACTS.playlistPeriodSnapshot, records);

const spotifyRecoveryFingerprints = {
  ANALYTICS_IMPORT_RECOVERY_DATE_FIELDS, ANALYTICS_IMPORT_RECOVERY_FIELDS, ANALYTICS_IMPORT_RECOVERY_SELECT,
  ARTIST_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, ARTIST_METRIC_OBSERVATION_RECOVERY_FIELDS, ARTIST_METRIC_OBSERVATION_RECOVERY_SELECT,
  PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_FIELDS, PLAYLIST_PERIOD_SNAPSHOT_RECOVERY_SELECT,
  SONG_PERIOD_SNAPSHOT_RECOVERY_DATE_FIELDS, SONG_PERIOD_SNAPSHOT_RECOVERY_FIELDS, SONG_PERIOD_SNAPSHOT_RECOVERY_SELECT,
  TRACK_METRIC_OBSERVATION_RECOVERY_DATE_FIELDS, TRACK_METRIC_OBSERVATION_RECOVERY_FIELDS, TRACK_METRIC_OBSERVATION_RECOVERY_SELECT,
  canonicalAnalyticsImportRecoveryCollection, canonicalArtistMetricObservationRecoveryCollection,
  canonicalPlaylistPeriodSnapshotRecoveryCollection, canonicalSongPeriodSnapshotRecoveryCollection,
  canonicalTrackMetricObservationRecoveryCollection, fingerprintAnalyticsImportRecovery,
  fingerprintArtistMetricObservationRecovery, fingerprintPlaylistPeriodSnapshotRecovery,
  fingerprintSongPeriodSnapshotRecovery, fingerprintTrackMetricObservationRecovery
};

export default spotifyRecoveryFingerprints;
