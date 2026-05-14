import "server-only";

import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {NextResponse} from "next/server";

import {getAdminPasswordHash, getAdminUsername} from "@/lib/auth/config";
import {decryptSecret, encryptSecret, verifyPassword} from "@/lib/auth/crypto";
import {clearFailures, getThrottleState, recordFailure} from "@/lib/auth/rate-limit";
import {
  ADMIN_SESSION_COOKIE,
  createAuthSession,
  invalidateSession,
  parseSessionCookie,
  readCurrentSession,
  readSessionFromCookieValue,
  rotateSession,
  updatePendingTotpSecret
} from "@/lib/auth/session";
import {readAdminUser, writeAdminUser} from "@/lib/auth/storage";
import {createTotpEnrollment, generateTotpSecret, verifyTotpCode} from "@/lib/auth/totp";
import type {AuthSessionRecord, AuthSessionStage} from "@/lib/auth/types";

function shouldUseSecureCookies(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return new URL(request.url).protocol === "https:";
}

function getCookieSettings(expiresAt: Date, request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(request),
    path: "/",
    expires: expiresAt
  };
}

function redirectFromAction(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {status: 303});
}

function buildRateLimitKey(kind: "login" | "totp", scope: string) {
  return `${kind}:${scope}`;
}

function getClientIpAddress(headerValue: string | null) {
  return headerValue?.split(",")[0]?.trim() || "local";
}

export async function getAdminAccessState() {
  const session = await readCurrentSession();

  return {
    session,
    stage: session?.stage ?? null
  };
}

export async function requireAuthenticatedAdminSession() {
  const session = await readCurrentSession();

  if (!session || session.stage !== "authenticated") {
    redirect("/admin/login");
  }

  return session;
}

export async function requirePendingAdminSession(expectedStage: AuthSessionStage) {
  const session = await readCurrentSession();

  if (!session) {
    redirect("/admin/login?error=session-expired");
  }

  if (expectedStage === "setup-totp" && session.stage === "pending-totp") {
    redirect("/admin/2fa");
  }

  if (expectedStage === "pending-totp" && session.stage === "setup-totp") {
    redirect("/admin/setup-2fa");
  }

  if (session.stage !== expectedStage) {
    if (session.stage === "authenticated") {
      redirect("/admin/releases");
    }

    redirect("/admin/login?error=session-expired");
  }

  return session;
}

export async function ensureTotpEnrollmentForSession(session: AuthSessionRecord) {
  if (session.stage !== "setup-totp") {
    throw new Error("Session is not eligible for TOTP setup.");
  }

  const adminUser = await readAdminUser(getAdminUsername());

  if (adminUser.totp.encryptedSecret) {
    redirect("/admin/2fa");
  }

  let activeSession = session;

  if (!activeSession.pendingTotpSecret) {
    activeSession = await updatePendingTotpSecret(session, generateTotpSecret());
  }

  const pendingSecret = activeSession.pendingTotpSecret;

  if (!pendingSecret) {
    throw new Error("Unable to prepare TOTP enrollment.");
  }

  return createTotpEnrollment(pendingSecret, adminUser.username);
}

function buildCookieRedirect(request: Request, path: string, cookieValue: string, expiresAt: Date) {
  const response = NextResponse.redirect(new URL(path, request.url), {status: 303});
  response.cookies.set(ADMIN_SESSION_COOKIE, cookieValue, getCookieSettings(expiresAt, request));

  return response;
}

export async function handleLoginAttempt(request: Request, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = getClientIpAddress(forwardedFor);
  const rateLimitKey = buildRateLimitKey("login", `${ipAddress}:${username || "unknown"}`);
  const throttleState = getThrottleState(rateLimitKey);

  if (throttleState.blocked) {
    return redirectFromAction(request, "/admin/login?error=throttled");
  }

  try {
    const expectedUsername = getAdminUsername();
    const adminUser = await readAdminUser(expectedUsername);
    const passwordHash = getAdminPasswordHash();
    const isValidCredentials =
      username === expectedUsername && (await verifyPassword(password, passwordHash));

    if (!isValidCredentials) {
      recordFailure(rateLimitKey);

      return redirectFromAction(request, "/admin/login?error=invalid-login");
    }

    clearFailures(rateLimitKey);

    const nextStage = adminUser.totp.encryptedSecret ? "pending-totp" : "setup-totp";
    const {cookieOptions, cookieValue} = await createAuthSession({
      userId: adminUser.id,
      username: adminUser.username,
      stage: nextStage,
      factorMethod: "totp"
    });

    return buildCookieRedirect(
      request,
      nextStage === "setup-totp" ? "/admin/setup-2fa" : "/admin/2fa",
      cookieValue,
      cookieOptions.expires
    );
  } catch {
    return redirectFromAction(request, "/admin/login?error=auth-config");
  }
}

export async function handleTotpChallenge(request: Request, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const cookieStore = await cookies();
  const session = await readSessionFromCookieValue(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null
  );

  if (!session || session.stage !== "pending-totp") {
    return redirectFromAction(request, "/admin/login?error=session-expired");
  }

  const ipAddress = getClientIpAddress(request.headers.get("x-forwarded-for"));
  const rateLimitKey = buildRateLimitKey("totp", `${ipAddress}:${session.id}`);
  const throttleState = getThrottleState(rateLimitKey);

  if (throttleState.blocked) {
    return redirectFromAction(request, "/admin/2fa?error=throttled");
  }

  const adminUser = await readAdminUser(getAdminUsername());
  const encryptedSecret = adminUser.totp.encryptedSecret;

  if (!encryptedSecret) {
    return redirectFromAction(request, "/admin/setup-2fa");
  }

  const isValidCode = verifyTotpCode(decryptSecret(encryptedSecret), code);

  if (!isValidCode) {
    recordFailure(rateLimitKey);

    return redirectFromAction(request, "/admin/2fa?error=invalid-code");
  }

  clearFailures(rateLimitKey);

  const {cookieOptions, cookieValue} = await rotateSession(session.id, {
    userId: session.userId,
    username: session.username,
    stage: "authenticated",
    factorMethod: "totp"
  });

  return buildCookieRedirect(request, "/admin/releases", cookieValue, cookieOptions.expires);
}

export async function handleTotpSetup(request: Request, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const cookieStore = await cookies();
  const session = await readSessionFromCookieValue(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null
  );

  if (!session || session.stage !== "setup-totp" || !session.pendingTotpSecret) {
    return redirectFromAction(request, "/admin/login?error=session-expired");
  }

  const isValidCode = verifyTotpCode(session.pendingTotpSecret, code);

  if (!isValidCode) {
    return redirectFromAction(request, "/admin/setup-2fa?error=invalid-code");
  }

  const adminUser = await readAdminUser(getAdminUsername());
  const now = new Date().toISOString();

  await writeAdminUser({
    ...adminUser,
    username: getAdminUsername(),
    totp: {
      method: "totp",
      encryptedSecret: encryptSecret(session.pendingTotpSecret),
      enrolledAt: now
    },
    updatedAt: now
  });

  const {cookieOptions, cookieValue} = await rotateSession(session.id, {
    userId: session.userId,
    username: session.username,
    stage: "authenticated",
    factorMethod: "totp"
  });

  return buildCookieRedirect(request, "/admin/releases", cookieValue, cookieOptions.expires);
}

export async function handleLogout(request: Request) {
  const cookieStore = await cookies();
  await invalidateSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null);
  const response = NextResponse.redirect(
    new URL("/admin/login?message=signed-out", request.url),
    {status: 303}
  );

  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...getCookieSettings(new Date(0), request),
    maxAge: 0
  });

  return response;
}

export async function requireAuthenticatedApiRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const parsedCookie =
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
      ?.slice(`${ADMIN_SESSION_COOKIE}=`.length) ?? null;
  const session = await readSessionFromCookieValue(parsedCookie);

  if (!session || session.stage !== "authenticated") {
    return NextResponse.json({message: "Unauthorized."}, {status: 401});
  }

  return session;
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0),
    maxAge: 0
  });

  return response;
}

export function getSessionStageFromCookieValue(cookieValue: string | undefined | null) {
  return parseSessionCookie(cookieValue)?.stage ?? null;
}
