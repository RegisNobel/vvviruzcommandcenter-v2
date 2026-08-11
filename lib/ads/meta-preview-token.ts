import "server-only";

import {createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID} from "node:crypto";

import {getAuthSecret} from "@/lib/auth/config";

export const META_PREVIEW_TTL_MS = 15 * 60 * 1000;

export type MetaPreviewTokenPayload = {
  v: 1;
  previewId: string;
  userId: string;
  expiresAt: number;
  bundleHash: string;
  fileReferences: Array<{key: string; sha256: string; fileName: string; sizeBytes: number}>;
  context: {
    attributionSetting: string;
    sourceAsOf: string | null;
    sourceAsOfOrigin: "META_EXPORT" | "USER_CONFIRMED" | "IMPORT_ACCEPTED_FALLBACK" | "UNKNOWN";
    confirmedCurrency: string | null;
    manualTimezone: string | null;
    manualTimezoneOrigin: "META_SOURCE" | "USER_CONFIRMED" | null;
    expectedGranularity: "DAILY" | "AGGREGATE_SNAPSHOT" | null;
    releaseId: string | null;
    name: string;
    notes: string;
    batchType: string;
  };
};

function key() { return createHash("sha256").update(`${getAuthSecret()}:meta-preview-token`, "utf8").digest(); }

export function createMetaPreviewToken(input: Omit<MetaPreviewTokenPayload, "v" | "previewId" | "expiresAt">, now = new Date()) {
  const payload: MetaPreviewTokenPayload = {...input, v: 1, previewId: randomUUID(), expiresAt: now.getTime() + META_PREVIEW_TTL_MS};
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {payload, token: ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")};
}

export function readMetaPreviewToken(token: string) {
  const [version, iv, tag, ciphertext] = token.split("."); if (version !== "v1" || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as MetaPreviewTokenPayload;
    return payload.v === 1 && payload.previewId && payload.userId && payload.bundleHash && Array.isArray(payload.fileReferences) ? payload : null;
  } catch { return null; }
}
