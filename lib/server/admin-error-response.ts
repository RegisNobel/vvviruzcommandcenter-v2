import "server-only";

import {Prisma} from "@prisma/client";
import {NextResponse} from "next/server";
import {ZodError} from "zod";

import type {
  AdminActionResult,
  AdminErrorCode,
  AdminErrorPayload
} from "@/lib/admin-errors";

export class AdminError extends Error {
  readonly code: AdminErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly retryable: boolean;
  readonly status: number;

  constructor(
    message: string,
    options?: {
      code?: AdminErrorCode;
      fieldErrors?: Record<string, string>;
      retryable?: boolean;
      status?: number;
    }
  ) {
    super(message);
    this.name = "AdminError";
    this.code = options?.code ?? "VALIDATION";
    this.fieldErrors = options?.fieldErrors;
    this.retryable = Boolean(options?.retryable);
    this.status = options?.status ?? 400;
  }
}

type NormalizeOptions = {
  context: string;
  fallbackMessage: string;
  exposeMessage?: boolean;
};

function zodFieldErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path.join(".");
    if (field && !errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

function sanitizeDiagnostic(value: string) {
  return value
    .replace(/(authorization|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^@\s/]+)@/gi, "$1[redacted]@")
    .slice(0, 600);
}

function prismaError(error: Prisma.PrismaClientKnownRequestError): {
  code: AdminErrorCode;
  message: string;
  status: number;
} {
  if (error.code === "P2002") {
    return {
      code: "CONFLICT",
      message: "That value is already in use. Choose a different value and try again.",
      status: 409
    };
  }

  if (error.code === "P2025") {
    return {
      code: "NOT_FOUND",
      message: "That record no longer exists. Refresh the page before continuing.",
      status: 404
    };
  }

  if (error.code === "P2003") {
    return {
      code: "CONFLICT",
      message: "This item is still connected to other records and cannot be changed that way.",
      status: 409
    };
  }

  return {
    code: "UNKNOWN",
    message: "The database could not complete this change. Your previous data is still intact.",
    status: 500
  };
}

export function normalizeAdminError(
  error: unknown,
  options: NormalizeOptions
): {payload: AdminErrorPayload; status: number} {
  const requestId = crypto.randomUUID();
  let status = 500;
  let payload: AdminErrorPayload;

  if (error instanceof AdminError) {
    status = error.status;
    payload = {
      code: error.code,
      fieldErrors: error.fieldErrors,
      message: error.message,
      requestId,
      retryable: error.retryable
    };
  } else if (error instanceof ZodError) {
    status = 400;
    payload = {
      code: "VALIDATION",
      fieldErrors: zodFieldErrors(error),
      message: error.issues[0]?.message || "Review the highlighted fields and try again.",
      requestId,
      retryable: false
    };
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const normalized = prismaError(error);
    status = normalized.status;
    payload = {
      code: normalized.code,
      message: normalized.message,
      requestId,
      retryable: status >= 500
    };
  } else {
    payload = {
      code: "UNKNOWN",
      message:
        options.exposeMessage && error instanceof Error && error.message.trim()
          ? error.message
          : options.fallbackMessage,
      requestId,
      retryable: true
    };
  }

  const diagnostic =
    error instanceof Error
      ? sanitizeDiagnostic(error.message)
      : "Non-Error value was thrown.";
  console.error(`[admin-error:${requestId}] ${options.context}`, {
    code: payload.code,
    diagnostic
  });

  return {payload, status};
}

export function adminErrorResponse(error: unknown, options: NormalizeOptions) {
  const {payload, status} = normalizeAdminError(error, options);

  return NextResponse.json(
    {
      code: payload.code,
      error: payload,
      message: payload.message,
      ok: false
    },
    {
      headers: {"x-request-id": payload.requestId || ""},
      status
    }
  );
}

export function adminActionError(
  error: unknown,
  options: NormalizeOptions
): AdminActionResult<never> {
  const {payload} = normalizeAdminError(error, options);

  return {
    error: payload,
    message: payload.message,
    ok: false
  };
}
