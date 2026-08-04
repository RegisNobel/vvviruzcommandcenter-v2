export type ArtistOption = {
  id: string;
  displayName: string;
  slug: string;
};

export type RetentionReleaseOption = {
  id: string;
  title: string;
  slug: string;
  release_date?: string;
  collaborator_name?: string;
  status?: string;
  type?: string;
  upc?: string;
  isrc?: string;
  artistProfileId: string;
};

export type ImportListItem = {
  id: string;
  importType: string;
  originalFilename: string;
  artistProfileId: string;
  uploadedByUsername: string;
  uploadedAt: string;
  status: string;
  rowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  unmatchedRowCount: number;
  warningCount: number;
  acceptedAt: string | null;
  detectedPeriodStart: string | null;
  detectedPeriodEnd: string | null;
  userConfirmedPeriodStart: string | null;
  userConfirmedPeriodEnd: string | null;
  withdrawnAt: string | null;
  replacedByImportId: string | null;
  rawFileExpiresAt: string | null;
  rawFileDeletedAt: string | null;
  rawFileAvailability: string;
};

export type MappingQueueItem = {
  id: string;
  sourceRowNumber: number;
  exportType: string;
  safeDisplayValues: Record<string, unknown>;
  normalizedValues: Record<string, unknown>;
  mappingStatus: string;
  mappingReason: string;
  mappingConfidence: string;
  mappingEvidence: Record<string, unknown>;
  suggestedRelease: {id: string; title: string; releaseDate?: string | null} | null;
  confirmedRelease: {id: string; title: string} | null;
  alias: {id: string; status: string} | null;
  import: {id: string; originalFilename: string; importType: string; artistProfileId: string; uploadedAt: string; status: string};
  observationsAlreadyExist: boolean;
  availableActions: string[];
};

export type AliasListItem = {
  id: string;
  status: string;
  source: string;
  exportType: string;
  exportedTitle: string;
  exportedReleaseDate: string | null;
  matchMethod: string;
  confirmedByUsername: string;
  confirmedAt: string;
  release: {id: string; title: string};
  artistProfile: {id: string; displayName: string};
};
