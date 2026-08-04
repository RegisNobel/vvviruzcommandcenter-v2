import type {SpotifyExportType, SpotifyValidationIssue} from "./spotify-export-types";

export type SpotifyExportSchema = {
  type: SpotifyExportType;
  label: "artist audience performance" | "track stream performance" | "songs period performance" | "playlists period performance";
  requiredHeaders: readonly string[];
  knownHeaders: readonly string[];
  requiresPeriodConfirmation: boolean;
};

const headerAliases = new Map<string, string>([
  ["release_date", "release date"],
  ["date_added", "date added"],
  ["title", "playlist title"]
]);

export function normalizeSpotifyHeader(header: string) {
  const normalized = header.trim().toLowerCase();
  return headerAliases.get(normalized) ?? normalized;
}

export const spotifyExportSchemas: readonly SpotifyExportSchema[] = [
  {
    type: "ARTIST_AUDIENCE_TIMELINE",
    label: "artist audience performance",
    requiredHeaders: [
      "date",
      "listeners",
      "monthly listeners",
      "monthly active listeners",
      "streams",
      "playlist adds",
      "saves",
      "followers"
    ],
    knownHeaders: [
      "date",
      "listeners",
      "monthly listeners",
      "monthly active listeners",
      "super listeners",
      "streams",
      "playlist adds",
      "saves",
      "followers"
    ],
    requiresPeriodConfirmation: false
  },
  {
    type: "TRACK_STREAM_TIMELINE",
    label: "track stream performance",
    requiredHeaders: ["date", "streams"],
    knownHeaders: ["date", "streams"],
    requiresPeriodConfirmation: false
  },
  {
    type: "SONGS_PERIOD",
    label: "songs period performance",
    requiredHeaders: ["song", "listeners", "streams", "saves", "release date"],
    knownHeaders: ["song", "listeners", "streams", "saves", "release date"],
    requiresPeriodConfirmation: true
  },
  {
    type: "PLAYLISTS_PERIOD",
    label: "playlists period performance",
    requiredHeaders: ["playlist title", "author", "listeners", "streams", "date added"],
    knownHeaders: ["playlist title", "author", "listeners", "streams", "date added"],
    requiresPeriodConfirmation: true
  }
] as const;

function isStrictSubset(left: readonly string[], right: readonly string[]) {
  return left.length < right.length && left.every((header) => right.includes(header));
}

export function detectSpotifyExportSchema(normalizedHeaders: string[]): {
  schema: SpotifyExportSchema | null;
  blockingErrors: SpotifyValidationIssue[];
} {
  const headerSet = new Set(normalizedHeaders);
  const candidates = spotifyExportSchemas.filter((schema) =>
    schema.requiredHeaders.every((header) => headerSet.has(header))
  );
  const mostSpecific = candidates.filter(
    (candidate) =>
      !candidates.some((other) => isStrictSubset(candidate.requiredHeaders, other.requiredHeaders))
  );

  if (mostSpecific.length === 1) return {schema: mostSpecific[0], blockingErrors: []};

  if (mostSpecific.length > 1) {
    return {
      schema: null,
      blockingErrors: [{
        code: "AMBIGUOUS_SCHEMA",
        message: `Headers match multiple verified Spotify exports: ${mostSpecific.map(({type}) => type).join(", ")}.`
      }]
    };
  }

  const ranked = spotifyExportSchemas
    .map((schema) => ({
      schema,
      matches: schema.requiredHeaders.filter((header) => headerSet.has(header)).length
    }))
    .sort((left, right) =>
      right.matches / right.schema.requiredHeaders.length - left.matches / left.schema.requiredHeaders.length ||
      right.matches - left.matches
    );
  const best = ranked[0];
  const second = ranked[1];
  const bestRatio = best.matches / best.schema.requiredHeaders.length;
  const secondRatio = second.matches / second.schema.requiredHeaders.length;
  const errors: SpotifyValidationIssue[] = [];

  if (best.matches > 0 && bestRatio >= 0.5 && bestRatio > secondRatio) {
    const missing = best.schema.requiredHeaders.filter((header) => !headerSet.has(header));
    errors.push({
      code: "MISSING_REQUIRED_HEADER",
      message: `Likely ${best.schema.type} export is missing required header${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
    });
  }
  errors.push({code: "UNSUPPORTED_SCHEMA", message: "Headers do not match a verified Spotify export schema."});
  return {schema: null, blockingErrors: errors};
}
