export const ADMIN_ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "EXTERNAL_SERVICE",
  "STORAGE",
  "INVALID_FILE",
  "INVALID_PREVIEW",
  "EXPIRED_PREVIEW",
  "DUPLICATE_FILE",
  "MISSING_CONFIRMATION",
  "INVALID_MAPPING",
  "TRANSACTION_FAILURE",
  "RAW_FILE_UNAVAILABLE",
  "MAPPING_ROW_NOT_FOUND",
  "MAPPING_ROW_NOT_ELIGIBLE",
  "RELEASE_NOT_FOUND",
  "ARTIST_MISMATCH",
  "AMBIGUOUS_MATCH",
  "ALIAS_CONFLICT",
  "ALIAS_REVOKED",
  "MAPPING_ALREADY_CONFIRMED",
  "MAPPING_CONFLICT",
  "INVALID_UNMATCHED_REASON",
  "REMAP_REASON_REQUIRED",
  "SNAPSHOT_ALREADY_EXISTS",
  "PERIOD_NOT_CONFIRMED",
  "IMPORT_NOT_ACTIVE",
  "CAMPAIGN_NOT_FOUND",
  "CAMPAIGN_ARCHIVED",
  "CAMPAIGN_RELEASE_REQUIRED",
  "CAMPAIGN_ARTIST_MISMATCH",
  "CAMPAIGN_REASON_REQUIRED",
  "CAMPAIGN_CONFLICT",
  "CAMPAIGN_INTERVAL_INVALID",
  "CAMPAIGN_INTERVAL_OVERLAP",
  "CAMPAIGN_OPEN_INTERVAL_EXISTS",
  "CAMPAIGN_INTERVAL_NOT_FOUND",
  "CAMPAIGN_INTERVAL_NOT_CONFIRMED",
  "CAMPAIGN_TIMEZONE_REQUIRED",
  "SHARED_SCOPE_CONFIRMATION_REQUIRED",
  "TIMEZONE_CONFLICT_REVIEW_REQUIRED",
  "CAMPAIGN_SUGGESTION_NOT_FOUND",
  "CAMPAIGN_SUGGESTION_ALREADY_RESOLVED",
  "CAMPAIGN_EVENT_INVALID",
  "RETENTION_RELEASE_NOT_FOUND",
  "RETENTION_CAMPAIGN_REQUIRED",
  "RETENTION_CAMPAIGN_NOT_FOUND",
  "RETENTION_CAMPAIGN_RELEASE_MISMATCH",
  "RETENTION_DATA_UNAVAILABLE",
  "RETENTION_MAPPING_CONFLICT",
  "RETENTION_CALCULATION_FAILED",
  "UNREADABLE_RESPONSE",
  "NETWORK",
  "UNKNOWN"
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

export type AdminErrorPayload = {
  code: AdminErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  retryable?: boolean;
  requestId?: string;
};

export type AdminActionResult<T = undefined> =
  | {
      ok: true;
      data?: T;
      message?: string;
    }
  | {
      ok: false;
      error: AdminErrorPayload;
      message: string;
    };

type LegacyErrorPayload = {
  error?: AdminErrorPayload | string;
  message?: string;
};

export class AdminRequestError extends Error {
  readonly code: AdminErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly status?: number;

  constructor(
    payload: AdminErrorPayload,
    options?: {
      status?: number;
    }
  ) {
    super(payload.message);
    this.name = "AdminRequestError";
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors;
    this.retryable = Boolean(payload.retryable);
    this.requestId = payload.requestId;
    this.status = options?.status;
  }
}

function isAdminErrorPayload(value: unknown): value is AdminErrorPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AdminErrorPayload>;
  return (
    typeof candidate.message === "string" &&
    ADMIN_ERROR_CODES.includes(candidate.code as AdminErrorCode)
  );
}

function statusToCode(status: number): AdminErrorCode {
  if (status === 400 || status === 422) return "VALIDATION";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "UNKNOWN";
  return "UNKNOWN";
}

function payloadError(
  payload: unknown,
  response: Response,
  fallbackMessage: string
): AdminErrorPayload {
  const candidate =
    payload && typeof payload === "object" ? (payload as LegacyErrorPayload) : null;

  if (isAdminErrorPayload(candidate?.error)) {
    return candidate.error;
  }

  const legacyMessage =
    typeof candidate?.message === "string"
      ? candidate.message
      : typeof candidate?.error === "string"
        ? candidate.error
        : "";

  return {
    code: statusToCode(response.status),
    message: legacyMessage.trim() || fallbackMessage,
    requestId: response.headers.get("x-request-id") || undefined,
    retryable: response.status === 429 || response.status >= 500
  };
}

export async function readAdminApiResponse<T>(
  response: Response,
  fallbackMessage = "The request could not be completed."
): Promise<T> {
  const body = await response.text();
  let payload: unknown = {};

  if (body.trim()) {
    try {
      payload = JSON.parse(body);
    } catch {
      if (!response.ok) {
        throw new AdminRequestError(
          {
            code: "UNREADABLE_RESPONSE",
            message:
              "The server returned an unreadable response. Try again, and check the deployment logs if the problem continues.",
            requestId: response.headers.get("x-request-id") || undefined,
            retryable: true
          },
          {status: response.status}
        );
      }

      throw new AdminRequestError({
        code: "UNREADABLE_RESPONSE",
        message:
          "The request finished, but its response could not be read. Refresh before making another change.",
        requestId: response.headers.get("x-request-id") || undefined,
        retryable: true
      });
    }
  }

  if (!response.ok) {
    throw new AdminRequestError(payloadError(payload, response, fallbackMessage), {
      status: response.status
    });
  }

  return payload as T;
}

export async function adminFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackMessage?: string
) {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    throw new AdminRequestError({
      code: "NETWORK",
      message: "The Command Center could not reach the server. Check your connection and try again.",
      retryable: true
    });
  }

  return readAdminApiResponse<T>(response, fallbackMessage);
}

export function getAdminErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Try again."
) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallbackMessage;
}

export function getAdminFieldErrors(error: unknown) {
  return error instanceof AdminRequestError ? error.fieldErrors : undefined;
}
