export const SPOTIFY_EXPORT_PARSER_VERSION = "1.0.0";
export const SPOTIFY_EXPORT_NORMALIZATION_VERSION = 1;

export const SPOTIFY_EXPORT_TYPES = [
  "ARTIST_AUDIENCE_TIMELINE",
  "TRACK_STREAM_TIMELINE",
  "SONGS_PERIOD",
  "PLAYLISTS_PERIOD"
] as const;

export type SpotifyExportType = (typeof SPOTIFY_EXPORT_TYPES)[number];
export type SpotifyRowOutcome = "ACCEPTED" | "REJECTED" | "WARNING" | "UNMATCHED";

export type SpotifyValidationCode =
  | "FILE_NOT_FOUND"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_EXTENSION"
  | "UNSUPPORTED_MIME"
  | "UNSUPPORTED_ENCODING"
  | "NULL_BYTE"
  | "MALFORMED_CSV"
  | "TOO_MANY_ROWS"
  | "TOO_MANY_COLUMNS"
  | "COLUMN_COUNT_MISMATCH"
  | "DUPLICATE_HEADER"
  | "HEADER_COLLISION"
  | "MISSING_REQUIRED_HEADER"
  | "UNEXPECTED_HEADER"
  | "UNSUPPORTED_SCHEMA"
  | "AMBIGUOUS_SCHEMA"
  | "EMPTY_REQUIRED_VALUE"
  | "INVALID_DATE"
  | "INVALID_INTEGER"
  | "INTEGER_OUT_OF_RANGE"
  | "NEGATIVE_METRIC"
  | "DUPLICATE_DATE"
  | "DUPLICATE_LOGICAL_ROW"
  | "PERIOD_CONFIRMATION_REQUIRED"
  | "INVALID_PERIOD"
  | "IDENTITY_NOT_PRESENT"
  | "DATE_ADDED_NOT_AVAILABLE"
  | "FORMULA_PREFIX_ESCAPED"
  | "UTF8_BOM_REMOVED";

export type SpotifyValidationIssue = {
  code: SpotifyValidationCode;
  message: string;
  field?: string;
  rowNumber?: number;
};

export type ArtistAudienceTimelineRow = {
  metricDate: string;
  listeners: number;
  monthlyListeners: number;
  monthlyActiveListeners: number;
  streams: number;
  playlistAdds: number;
  saves: number;
  followers: number;
};

export type TrackStreamTimelineRow = {
  metricDate: string;
  streams: number;
};

export type SongsPeriodRow = {
  exportedTitle: string;
  listeners: number;
  streams: number;
  saves: number;
  exportedReleaseDate: string;
};

export type PlaylistsPeriodRow = {
  playlistTitle: string;
  playlistAuthor: string;
  listeners: number;
  streams: number;
  dateAdded: string | null;
};

export type SpotifyNormalizedRow =
  | ArtistAudienceTimelineRow
  | TrackStreamTimelineRow
  | SongsPeriodRow
  | PlaylistsPeriodRow;

export type SpotifyPreviewRow = {
  originalRowNumber: number;
  outcome: SpotifyRowOutcome;
  originalValues: Record<string, string>;
  safeDisplayValues: Record<string, string>;
  normalizedValues: SpotifyNormalizedRow | null;
  errors: SpotifyValidationIssue[];
  warnings: SpotifyValidationIssue[];
};

export type SpotifyPreviewPeriod = {
  periodStart: string;
  periodEnd: string;
};

export type SpotifyExportFileInput = {
  fileName: string;
  bytes: Uint8Array | null | undefined;
  mimeType?: string | null;
  previewPeriod?: SpotifyPreviewPeriod | null;
  limits?: Partial<SpotifyParserLimits>;
};

export type SpotifyParserLimits = {
  maxFileBytes: number;
  maxRows: number;
  maxColumns: number;
};

export type SpotifyExportParseResult = {
  detectedType: SpotifyExportType | null;
  dataLabel: "artist audience performance" | "track stream performance" | "songs period performance" | "playlists period performance" | null;
  originalHeaders: string[];
  normalizedHeaders: string[];
  fileMetadata: {
    fileName: string;
    safeDisplayFileName: string;
    extension: string;
    mimeType: string | null;
    sizeBytes: number;
    sha256: string | null;
    encoding: "UTF-8" | null;
    hadUtf8Bom: boolean;
  };
  rowCount: number;
  acceptedCount: number;
  warningCount: number;
  rejectedCount: number;
  unmatchedCount: number;
  rows: SpotifyPreviewRow[];
  dateRange: {minimumDate: string; maximumDate: string; missingDateCount: number} | null;
  missingDates: string[];
  requiresPeriodConfirmation: boolean;
  previewPeriod: SpotifyPreviewPeriod | null;
  blockingErrors: SpotifyValidationIssue[];
  fileWarnings: SpotifyValidationIssue[];
  parserVersion: typeof SPOTIFY_EXPORT_PARSER_VERSION;
  normalizationVersion: typeof SPOTIFY_EXPORT_NORMALIZATION_VERSION;
};
