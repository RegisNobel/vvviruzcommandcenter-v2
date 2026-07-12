import "server-only";

import {createHmac, timingSafeEqual} from "node:crypto";

const tokenLifetimeSeconds = 60 * 60 * 24 * 30;

function getSecret() {
  return process.env.AUTH_SECRET?.trim() || process.env.BACKUP_ENCRYPTION_SECRET?.trim() || "";
}

function sign(value: string) {
  const secret = getSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createShortLinkAttributionToken(shortLinkId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + tokenLifetimeSeconds;
  const payload = `${shortLinkId}.${expiresAt}`;
  const signature = sign(payload);
  return signature ? `${payload}.${signature}` : "";
}

export function verifyShortLinkAttributionToken(token: string) {
  const [shortLinkId, expiresAtRaw, signature] = token.split(".");
  if (!shortLinkId || !expiresAtRaw || !signature) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

  const expected = sign(`${shortLinkId}.${expiresAtRaw}`);
  if (!expected) return null;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return shortLinkId;
}
