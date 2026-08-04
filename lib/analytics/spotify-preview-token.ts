import "server-only";

import {createCipheriv, createDecipheriv, createHash, randomBytes} from "node:crypto";

import {getAuthSecret} from "@/lib/auth/config";

import type {SpotifyExportType, SpotifyPreviewPeriod} from "./spotify-export-types";

export const SPOTIFY_PREVIEW_TTL_MS = 15 * 60 * 1000;

export type SpotifyPreviewTokenPayload = {
  v: 1;
  previewId: string;
  userId: string;
  expiresAt: number;
  fileHash: string;
  parserVersion: string;
  normalizationVersion: number;
  detectedType: SpotifyExportType;
  parsedResultChecksum: string;
  temporaryRawFileReference: string;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number;
  previewPeriod: SpotifyPreviewPeriod | null;
  candidateArtistProfileId: string | null;
  candidateReleaseId: string | null;
  reprocessSourceImportId: string | null;
};

function previewKey() {
  return createHash("sha256")
    .update(`${getAuthSecret()}:spotify-preview-token`, "utf8")
    .digest();
}

export function createSpotifyPreviewToken(
  payload: Omit<SpotifyPreviewTokenPayload, "v" | "previewId" | "expiresAt">,
  options: {now?: Date; previewId?: string; ttlMs?: number} = {}
) {
  const now = options.now ?? new Date();
  const complete: SpotifyPreviewTokenPayload = {
    ...payload,
    v: 1,
    previewId: options.previewId ?? crypto.randomUUID(),
    expiresAt: now.getTime() + (options.ttlMs ?? SPOTIFY_PREVIEW_TTL_MS)
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", previewKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(complete), "utf8"),
    cipher.final()
  ]);
  return {
    payload: complete,
    token: ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
  };
}

export function readSpotifyPreviewToken(token: string): SpotifyPreviewTokenPayload | null {
  const [version, iv, tag, ciphertext] = token.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", previewKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8")) as SpotifyPreviewTokenPayload;
    if (
      payload.v !== 1 ||
      !payload.previewId ||
      !payload.userId ||
      !payload.fileHash ||
      !payload.temporaryRawFileReference ||
      !Number.isFinite(payload.expiresAt)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function checksumSpotifyPreviewResult(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
