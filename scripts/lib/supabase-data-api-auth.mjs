const PUBLISHABLE_KEY_NAMES = [
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
];
const SECRET_KEY_NAME = "SUPABASE_SECRET_KEY";
const AUTHENTICATED_TOKEN_NAME = "SUPABASE_TEST_AUTHENTICATED_JWT";

function configurationError(message) {
  const error = new Error(message);
  error.name = "SupabaseDataApiConfigurationError";
  return error;
}

function requireModernKey(value, pattern, description) {
  const normalized = value?.trim();
  if (!normalized || !pattern.test(normalized)) {
    throw configurationError(`A valid modern Supabase ${description} is required.`);
  }
  return normalized;
}

export function requireModernPublishableKey(env = process.env) {
  const value = PUBLISHABLE_KEY_NAMES
    .map((name) => env[name])
    .find((candidate) => candidate?.trim());
  return requireModernKey(value, /^sb_publishable_[A-Za-z0-9_-]+$/, "publishable API key");
}

export function requireModernSecretKey(env = process.env) {
  return requireModernKey(env[SECRET_KEY_NAME], /^sb_secret_[A-Za-z0-9_-]+$/, "secret API key");
}

function decodeJwt(token) {
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw configurationError("A valid short-lived Supabase authenticated access token is required.");
  }
  try {
    const header = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    if (!header || typeof header !== "object" || Array.isArray(header) ||
        !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Unexpected JWT structure.");
    }
    return {header, payload};
  } catch {
    throw configurationError("A valid short-lived Supabase authenticated access token is required.");
  }
}

export function validateAuthenticatedAccessToken(token, {nowSeconds = Math.floor(Date.now() / 1000)} = {}) {
  const normalized = token?.trim();
  if (!normalized) {
    throw configurationError("A valid short-lived Supabase authenticated access token is required.");
  }
  const {header, payload} = decodeJwt(normalized);
  if (!new Set(["ES256", "RS256"]).has(header.alg)) {
    throw configurationError("The supplied Supabase access token does not use an approved asymmetric signing algorithm.");
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    throw configurationError("A non-expired Supabase authenticated access token is required.");
  }
  if (payload.role !== undefined && payload.role !== "authenticated") {
    throw configurationError("The supplied Supabase access token is not an authenticated-role token.");
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud === undefined ? [] : [payload.aud];
  if (audiences.length && !audiences.includes("authenticated")) {
    throw configurationError("The supplied Supabase access token has an unexpected audience.");
  }
  return normalized;
}

export function requireAuthenticatedTestAccessToken(env = process.env, options) {
  return validateAuthenticatedAccessToken(env[AUTHENTICATED_TOKEN_NAME], options);
}

export function publicDataApiHeaders(publishableKey) {
  return {apikey: requireModernKey(publishableKey, /^sb_publishable_[A-Za-z0-9_-]+$/, "publishable API key")};
}

export function privilegedDataApiHeaders(secretKey) {
  return {apikey: requireModernKey(secretKey, /^sb_secret_[A-Za-z0-9_-]+$/, "secret API key")};
}

export function authenticatedDataApiHeaders(publishableKey, accessToken, options) {
  return {
    ...publicDataApiHeaders(publishableKey),
    Authorization: `Bearer ${validateAuthenticatedAccessToken(accessToken, options)}`
  };
}
