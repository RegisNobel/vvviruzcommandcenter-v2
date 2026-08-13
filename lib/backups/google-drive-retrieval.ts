import "server-only";

import {createHash} from "node:crypto";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

export type BackupRetrievalPhase =
  | "oauth-refresh"
  | "drive-metadata"
  | "drive-download-open"
  | "encrypted-stream"
  | "encrypted-size"
  | "encrypted-sha256";

export type BackupRetrievalCode =
  | "BACKUP_CONFIGURATION_INVALID"
  | "BACKUP_NETWORK_FAILURE"
  | "BACKUP_NETWORK_TIMEOUT"
  | "GOOGLE_OAUTH_REFRESH_REJECTED"
  | "GOOGLE_OAUTH_RESPONSE_INVALID"
  | "GOOGLE_OAUTH_ACCESS_TOKEN_MISSING"
  | "GOOGLE_DRIVE_AUTHENTICATION_REJECTED"
  | "GOOGLE_DRIVE_ACCESS_DENIED"
  | "GOOGLE_DRIVE_FILE_NOT_FOUND"
  | "GOOGLE_DRIVE_METADATA_FAILED"
  | "GOOGLE_DRIVE_FILE_ID_MISMATCH"
  | "GOOGLE_DRIVE_FILE_TRASHED"
  | "GOOGLE_DRIVE_OBJECT_NOT_FILE"
  | "GOOGLE_DRIVE_DOWNLOAD_FAILED"
  | "GOOGLE_DRIVE_DOWNLOAD_INVALID_CONTENT"
  | "GOOGLE_DRIVE_STREAM_INTERRUPTED"
  | "BACKUP_ENCRYPTED_SIZE_MISMATCH"
  | "BACKUP_ENCRYPTED_HASH_MISMATCH";

type Fetch = typeof fetch;

export class BackupRetrievalError extends Error {
  readonly code: BackupRetrievalCode;
  readonly phase: BackupRetrievalPhase;
  readonly httpStatus?: number;
  readonly oauthError?: string;
  readonly retryable: boolean;

  constructor(input: {
    code: BackupRetrievalCode;
    phase: BackupRetrievalPhase;
    httpStatus?: number;
    oauthError?: string;
    retryable?: boolean;
  }) {
    super(input.code);
    this.name = "BackupRetrievalError";
    this.code = input.code;
    this.phase = input.phase;
    this.httpStatus = input.httpStatus;
    this.oauthError = input.oauthError;
    this.retryable = input.retryable ?? false;
  }
}

export type GoogleDriveOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export function readNormalizedGoogleDriveOAuthCredentials(
  environment: Record<string, string | undefined> = process.env
): {
  credentials: GoogleDriveOAuthCredentials;
  normalization: {
    bomPresent: Record<keyof GoogleDriveOAuthCredentials, boolean>;
    outerQuotesPresent: Record<keyof GoogleDriveOAuthCredentials, boolean>;
    outerWhitespaceRemoved: Record<keyof GoogleDriveOAuthCredentials, boolean>;
  };
} {
  const entries = {
    clientId: environment.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
    clientSecret: environment.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
    refreshToken: environment.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  };
  const normalized = Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, value?.trim() ?? ""])
  ) as GoogleDriveOAuthCredentials;
  if (!normalized.clientId || !normalized.clientSecret || !normalized.refreshToken) {
    throw new BackupRetrievalError({
      code: "BACKUP_CONFIGURATION_INVALID",
      phase: "oauth-refresh"
    });
  }
  return {
    credentials: normalized,
    normalization: {
      bomPresent: {
        clientId: entries.clientId?.startsWith("\uFEFF") ?? false,
        clientSecret: entries.clientSecret?.startsWith("\uFEFF") ?? false,
        refreshToken: entries.refreshToken?.startsWith("\uFEFF") ?? false
      },
      outerQuotesPresent: {
        clientId: /^(['"]).*\1$/.test(normalized.clientId),
        clientSecret: /^(['"]).*\1$/.test(normalized.clientSecret),
        refreshToken: /^(['"]).*\1$/.test(normalized.refreshToken)
      },
      outerWhitespaceRemoved: {
        clientId: entries.clientId !== normalized.clientId,
        clientSecret: entries.clientSecret !== normalized.clientSecret,
        refreshToken: entries.refreshToken !== normalized.refreshToken
      }
    }
  };
}

function safeOAuthError(value: unknown) {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value)
    ? value
    : undefined;
}

function driveHttpError(phase: "drive-metadata" | "drive-download-open", status: number) {
  if (status === 401) {
    return new BackupRetrievalError({
      code: "GOOGLE_DRIVE_AUTHENTICATION_REJECTED",
      phase,
      httpStatus: status
    });
  }
  if (status === 403) {
    return new BackupRetrievalError({
      code: "GOOGLE_DRIVE_ACCESS_DENIED",
      phase,
      httpStatus: status
    });
  }
  if (status === 404) {
    return new BackupRetrievalError({
      code: "GOOGLE_DRIVE_FILE_NOT_FOUND",
      phase,
      httpStatus: status
    });
  }
  return new BackupRetrievalError({
    code: phase === "drive-metadata" ? "GOOGLE_DRIVE_METADATA_FAILED" : "GOOGLE_DRIVE_DOWNLOAD_FAILED",
    phase,
    httpStatus: status,
    retryable: status >= 500
  });
}

function networkError(error: unknown, phase: BackupRetrievalPhase) {
  if (error instanceof BackupRetrievalError) return error;
  const timeout = error instanceof Error && error.name === "AbortError";
  return new BackupRetrievalError({
    code: timeout ? "BACKUP_NETWORK_TIMEOUT" : "BACKUP_NETWORK_FAILURE",
    phase,
    retryable: true
  });
}

async function fetchWithTimeout(
  fetchImpl: Fetch,
  input: string,
  init: RequestInit,
  phase: BackupRetrievalPhase,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, {...init, signal: controller.signal});
  } catch (error) {
    throw networkError(error, phase);
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshGoogleDriveOAuthAccessToken(input: {
  credentials: GoogleDriveOAuthCredentials;
  fetchImpl?: Fetch;
  onSuccess?: (result: {httpStatus: number}) => void;
  timeoutMs?: number;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchWithTimeout(
    fetchImpl,
    GOOGLE_OAUTH_TOKEN_URL,
    {
      method: "POST",
      redirect: "error",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({
        client_id: input.credentials.clientId,
        client_secret: input.credentials.clientSecret,
        refresh_token: input.credentials.refreshToken,
        grant_type: "refresh_token"
      })
    },
    "oauth-refresh",
    input.timeoutMs ?? 20_000
  );
  let payload: {access_token?: unknown; error?: unknown};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new BackupRetrievalError({
      code: "GOOGLE_OAUTH_RESPONSE_INVALID",
      phase: "oauth-refresh",
      httpStatus: response.status
    });
  }
  if (!response.ok) {
    throw new BackupRetrievalError({
      code: "GOOGLE_OAUTH_REFRESH_REJECTED",
      phase: "oauth-refresh",
      httpStatus: response.status,
      oauthError: safeOAuthError(payload.error),
      retryable: response.status >= 500
    });
  }
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new BackupRetrievalError({
      code: "GOOGLE_OAUTH_ACCESS_TOKEN_MISSING",
      phase: "oauth-refresh",
      httpStatus: response.status
    });
  }
  input.onSuccess?.({httpStatus: response.status});
  return payload.access_token;
}

async function readPinnedGoogleDriveBackupMetadata(input: {
  accessToken: string;
  expectedFileId: string;
  expectedSize: number;
  fetchImpl: Fetch;
  timeoutMs: number;
}) {
  const fileUrl = `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(input.expectedFileId)}`;
  const metadataResponse = await fetchWithTimeout(
    input.fetchImpl,
    `${fileUrl}?fields=id,size,trashed,mimeType`,
    {headers: {Authorization: `Bearer ${input.accessToken}`}, redirect: "error"},
    "drive-metadata",
    input.timeoutMs
  );
  if (!metadataResponse.ok) throw driveHttpError("drive-metadata", metadataResponse.status);
  let metadata: {id?: unknown; size?: unknown; trashed?: unknown; mimeType?: unknown};
  try {
    metadata = (await metadataResponse.json()) as typeof metadata;
  } catch {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_METADATA_FAILED",
      phase: "drive-metadata",
      httpStatus: metadataResponse.status
    });
  }
  if (metadata.id !== input.expectedFileId) {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_FILE_ID_MISMATCH",
      phase: "drive-metadata"
    });
  }
  if (metadata.trashed === true) {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_FILE_TRASHED",
      phase: "drive-metadata"
    });
  }
  if (typeof metadata.mimeType !== "string" || metadata.mimeType === "application/vnd.google-apps.folder" || metadata.mimeType === "application/vnd.google-apps.shortcut") {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_OBJECT_NOT_FILE",
      phase: "drive-metadata"
    });
  }
  if (metadata.size !== undefined && Number(metadata.size) !== input.expectedSize) {
    throw new BackupRetrievalError({
      code: "BACKUP_ENCRYPTED_SIZE_MISMATCH",
      phase: "encrypted-size"
    });
  }
  return {
    fileIdMatched: true as const,
    sizeBytes: metadata.size === undefined ? undefined : Number(metadata.size),
    trashed: false as const,
    mimeType: metadata.mimeType,
    httpStatus: metadataResponse.status
  };
}

export async function verifyPinnedGoogleDriveBackupMetadata(input: {
  credentials: GoogleDriveOAuthCredentials;
  expectedFileId: string;
  expectedSize: number;
  fetchImpl?: Fetch;
  onPhase?: (phase: "oauth-refresh" | "drive-metadata") => void;
  timeoutMs?: number;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  let oauthHttpStatus: number | undefined;
  input.onPhase?.("oauth-refresh");
  const accessToken = await refreshGoogleDriveOAuthAccessToken({
    credentials: input.credentials,
    fetchImpl,
    timeoutMs,
    onSuccess: ({httpStatus}) => { oauthHttpStatus = httpStatus; }
  });
  input.onPhase?.("drive-metadata");
  const metadata = await readPinnedGoogleDriveBackupMetadata({
    accessToken,
    expectedFileId: input.expectedFileId,
    expectedSize: input.expectedSize,
    fetchImpl,
    timeoutMs
  });
  return {oauthHttpStatus, metadata};
}

async function readEncryptedStream(input: {
  response: Response;
  expectedSize: number;
  expectedSha256: string;
  timeoutMs: number;
}) {
  const contentType = input.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_DOWNLOAD_INVALID_CONTENT",
      phase: "drive-download-open",
      httpStatus: input.response.status
    });
  }
  const contentLength = input.response.headers.get("content-length");
  if (contentLength && Number(contentLength) !== input.expectedSize) {
    throw new BackupRetrievalError({
      code: "BACKUP_ENCRYPTED_SIZE_MISMATCH",
      phase: "encrypted-size"
    });
  }
  if (!input.response.body) {
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_DOWNLOAD_FAILED",
      phase: "encrypted-stream"
    });
  }
  const reader = input.response.body.getReader();
  const chunks: Buffer[] = [];
  const hash = createHash("sha256");
  let byteCount = 0;
  try {
    while (true) {
      const result = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new BackupRetrievalError({
          code: "BACKUP_NETWORK_TIMEOUT",
          phase: "encrypted-stream",
          retryable: true
        })), input.timeoutMs);
        reader.read().then(
          (value) => { clearTimeout(timeout); resolve(value); },
          (error) => { clearTimeout(timeout); reject(error); }
        );
      });
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      byteCount += chunk.length;
      if (byteCount > input.expectedSize) {
        throw new BackupRetrievalError({
          code: "BACKUP_ENCRYPTED_SIZE_MISMATCH",
          phase: "encrypted-size"
        });
      }
      hash.update(chunk);
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof BackupRetrievalError) throw error;
    throw new BackupRetrievalError({
      code: "GOOGLE_DRIVE_STREAM_INTERRUPTED",
      phase: "encrypted-stream",
      retryable: true
    });
  } finally {
    reader.releaseLock();
  }
  if (byteCount !== input.expectedSize) {
    throw new BackupRetrievalError({
      code: "BACKUP_ENCRYPTED_SIZE_MISMATCH",
      phase: "encrypted-size"
    });
  }
  if (hash.digest("hex") !== input.expectedSha256) {
    throw new BackupRetrievalError({
      code: "BACKUP_ENCRYPTED_HASH_MISMATCH",
      phase: "encrypted-sha256"
    });
  }
  return Buffer.concat(chunks, byteCount);
}

export async function retrievePinnedEncryptedGoogleDriveBackup(input: {
  credentials: GoogleDriveOAuthCredentials;
  expectedFileId: string;
  expectedSha256: string;
  expectedSize: number;
  fetchImpl?: Fetch;
  onPhase?: (phase: BackupRetrievalPhase) => void;
  timeoutMs?: number;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  input.onPhase?.("oauth-refresh");
  const accessToken = await refreshGoogleDriveOAuthAccessToken({
    credentials: input.credentials,
    fetchImpl,
    timeoutMs
  });
  const fileUrl = `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(input.expectedFileId)}`;
  input.onPhase?.("drive-metadata");
  await readPinnedGoogleDriveBackupMetadata({
    accessToken,
    expectedFileId: input.expectedFileId,
    expectedSize: input.expectedSize,
    fetchImpl,
    timeoutMs
  });

  input.onPhase?.("drive-download-open");
  const downloadResponse = await fetchWithTimeout(
    fetchImpl,
    `${fileUrl}?alt=media`,
    {headers: {Authorization: `Bearer ${accessToken}`}, redirect: "follow"},
    "drive-download-open",
    timeoutMs
  );
  if (!downloadResponse.ok) throw driveHttpError("drive-download-open", downloadResponse.status);
  input.onPhase?.("encrypted-stream");
  const buffer = await readEncryptedStream({
    response: downloadResponse,
    expectedSize: input.expectedSize,
    expectedSha256: input.expectedSha256,
    timeoutMs
  });
  input.onPhase?.("encrypted-size");
  input.onPhase?.("encrypted-sha256");
  return buffer;
}

export function sanitizedBackupRetrievalFailure(error: unknown) {
  if (!(error instanceof BackupRetrievalError)) return undefined;
  return {
    code: error.code,
    phase: error.phase,
    httpStatus: error.httpStatus,
    oauthError: error.oauthError,
    retryable: error.retryable
  };
}
