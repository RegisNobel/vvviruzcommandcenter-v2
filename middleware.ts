import {NextResponse, type NextRequest} from "next/server";

type MiddlewareCookiePayload = {
  sid: string;
  stage: "setup-totp" | "pending-totp" | "authenticated";
  exp: number;
  v: 1;
};

type EdgeRateLimitState = {
  count: number;
  blockedUntil: number;
  windowStartedAt: number;
};

type EdgeRateLimitRule = {
  blockMs: number;
  maxRequests: number;
  windowMs: number;
};

const ADMIN_COOKIE = "vvv_admin_session";
const encoder = new TextEncoder();
const edgeRateLimits = new Map<string, EdgeRateLimitState>();
const edgeRateLimitRules: Record<string, EdgeRateLimitRule> = {
  "/api/analytics/track": {
    blockMs: 60 * 1000,
    maxRequests: 120,
    windowMs: 60 * 1000
  },
  "/api/exclusive/claim": {
    blockMs: 10 * 60 * 1000,
    maxRequests: 20,
    windowMs: 10 * 60 * 1000
  }
};

function getMiddlewareIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "local"
  );
}

function consumeEdgeRateLimit(request: NextRequest, pathname: string) {
  if (request.method !== "POST") {
    return null;
  }

  const rule = edgeRateLimitRules[pathname];

  if (!rule) {
    return null;
  }

  const now = Date.now();
  const key = `${pathname}:${getMiddlewareIpAddress(request)}`;
  const current = edgeRateLimits.get(key);

  if (current?.blockedUntil && current.blockedUntil > now) {
    return current.blockedUntil - now;
  }

  const windowExpired = !current || current.windowStartedAt + rule.windowMs <= now;
  const nextState: EdgeRateLimitState = {
    count: windowExpired ? 1 : current.count + 1,
    blockedUntil: 0,
    windowStartedAt: windowExpired ? now : current.windowStartedAt
  };

  if (nextState.count > rule.maxRequests) {
    nextState.blockedUntil = now + rule.blockMs;
    edgeRateLimits.set(key, nextState);

    return rule.blockMs;
  }

  edgeRateLimits.set(key, nextState);

  return null;
}

function base64UrlToBase64(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");

  return padded.replace(/-/g, "+").replace(/_/g, "/");
}

function decodePayload(encodedPayload: string) {
  try {
    const payload = JSON.parse(atob(base64UrlToBase64(encodedPayload))) as MiddlewareCookiePayload;

    if (
      payload.v !== 1 ||
      !payload.sid ||
      !payload.stage ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifySessionCookie(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    return null;
  }

  const scopeKey = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${secret}:session-cookie`)
  );
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    scopeKey,
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"]
  );
  const expectedSignature = bytesToBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(encodedPayload)))
  );

  if (expectedSignature !== signature) {
    return null;
  }

  return decodePayload(encodedPayload);
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const retryAfterMs = consumeEdgeRateLimit(request, pathname);

  if (retryAfterMs) {
    return NextResponse.json(
      {message: "Too many requests. Try again shortly."},
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
        }
      }
    );
  }

  if (edgeRateLimitRules[pathname]) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const session = await verifySessionCookie(cookie);
  const stage = session?.stage ?? null;

  if (pathname === "/admin/login") {
    if (stage === "authenticated") {
      return redirectTo(request, "/admin");
    }

    if (stage === "pending-totp") {
      return redirectTo(request, "/admin/2fa");
    }

    if (stage === "setup-totp") {
      return redirectTo(request, "/admin/setup-2fa");
    }

    return NextResponse.next();
  }

  if (pathname === "/admin/2fa") {
    if (stage === "authenticated") {
      return redirectTo(request, "/admin");
    }

    if (stage === "setup-totp") {
      return redirectTo(request, "/admin/setup-2fa");
    }

    if (stage !== "pending-totp") {
      return redirectTo(request, "/admin/login");
    }

    return NextResponse.next();
  }

  if (pathname === "/admin/setup-2fa") {
    if (stage === "authenticated") {
      return redirectTo(request, "/admin");
    }

    if (stage === "pending-totp") {
      return redirectTo(request, "/admin/2fa");
    }

    if (stage !== "setup-totp") {
      return redirectTo(request, "/admin/login");
    }

    return NextResponse.next();
  }

  if (pathname === "/admin/logout") {
    return NextResponse.next();
  }

  if (stage === "authenticated") {
    return NextResponse.next();
  }

  if (stage === "pending-totp") {
    return redirectTo(request, "/admin/2fa");
  }

  if (stage === "setup-totp") {
    return redirectTo(request, "/admin/setup-2fa");
  }

  return redirectTo(request, "/admin/login");
}

export const config = {
  matcher: ["/admin/:path*", "/api/analytics/track", "/api/exclusive/claim"]
};
