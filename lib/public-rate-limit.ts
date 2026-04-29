import "server-only";

import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";

type ConsumeRateLimitOptions = {
  bucket: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

export type RateLimitState = {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
};

function sanitizeRateLimitKey(value: string) {
  return (value.trim().toLowerCase() || "unknown").slice(0, 180);
}

export function getClientIpAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "local"
  );
}

export function retryAfterSeconds(retryAfterMs: number) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export async function consumeRateLimit({
  bucket,
  key,
  maxAttempts,
  windowMs,
  blockMs
}: ConsumeRateLimitOptions): Promise<RateLimitState> {
  const normalizedKey = sanitizeRateLimitKey(key);
  const now = new Date();
  const existing = await prisma.publicRateLimit.findUnique({
    where: {
      bucket_key: {
        bucket,
        key: normalizedKey
      }
    }
  });

  if (existing?.blockedUntil && existing.blockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      retryAfterMs: existing.blockedUntil.getTime() - now.getTime(),
      remaining: 0
    };
  }

  const windowExpired = !existing || existing.windowStartedAt.getTime() + windowMs <= now.getTime();
  const nextCount = windowExpired ? 1 : existing.count + 1;
  const shouldBlock = nextCount > maxAttempts;
  const blockedUntil = shouldBlock ? new Date(now.getTime() + blockMs) : null;

  await prisma.publicRateLimit.upsert({
    where: {
      bucket_key: {
        bucket,
        key: normalizedKey
      }
    },
    create: {
      id: createId(),
      bucket,
      key: normalizedKey,
      count: nextCount,
      windowStartedAt: now,
      blockedUntil,
      updatedAt: now
    },
    update: {
      count: nextCount,
      windowStartedAt: windowExpired ? now : existing?.windowStartedAt ?? now,
      blockedUntil,
      updatedAt: now
    }
  });

  return {
    allowed: !shouldBlock,
    retryAfterMs: shouldBlock ? blockMs : 0,
    remaining: shouldBlock ? 0 : Math.max(0, maxAttempts - nextCount)
  };
}
