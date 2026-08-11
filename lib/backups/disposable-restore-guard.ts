import {createHash} from "node:crypto";

export const DISPOSABLE_DATABASE_PREFIX = "backup_verify_";

type GuardInput = {
  allowRestore?: string;
  productionUrls: Array<string | undefined>;
  targetKind?: string;
  targetUrl?: string;
};

type NormalizedDatabaseIdentity = {
  database: string;
  hostname: string;
  port: string;
  protocol: string;
  username: string;
};

function parseDatabaseUrl(value: string | undefined, label: string): NormalizedDatabaseIdentity {
  if (!value?.trim()) throw new Error(`${label} database URL is required.`);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} database URL is invalid.`);
  }

  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error(`${label} database URL must use PostgreSQL.`);
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim().toLowerCase();
  if (!parsed.hostname || !database) throw new Error(`${label} database URL is incomplete.`);

  return {
    database,
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    protocol: "postgresql:",
    username: decodeURIComponent(parsed.username).toLowerCase()
  };
}
function sameTarget(left: NormalizedDatabaseIdentity, right: NormalizedDatabaseIdentity) {
  return left.hostname === right.hostname &&
    left.port === right.port &&
    left.database === right.database &&
    left.username === right.username;
}

export function assertDisposableRestoreTarget(input: GuardInput) {
  if (input.allowRestore !== "1") {
    throw new Error("Disposable backup restore requires explicit opt-in.");
  }
  if (input.targetKind !== "DISPOSABLE") {
    throw new Error("Disposable backup restore target marker is absent.");
  }

  const target = parseDatabaseUrl(input.targetUrl, "Verification target");
  if (!target.database.startsWith(DISPOSABLE_DATABASE_PREFIX)) {
    throw new Error("Verification target database does not have the approved disposable prefix.");
  }
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(target.hostname)) {
    throw new Error("Verification target must be the locally provisioned disposable PostgreSQL harness.");
  }

  const production = input.productionUrls
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => parseDatabaseUrl(value, "Production"));
  if (production.length === 0) throw new Error("Production database identity is required for comparison.");

  for (const identity of production) {
    if (target.database === identity.database) {
      throw new Error("Verification target database name matches production.");
    }
    if (sameTarget(target, identity)) {
      throw new Error("Verification target resolves to production.");
    }
  }

  return {
    databaseFingerprint: createHash("sha256").update(target.database).digest("hex").slice(0, 16),
    hostClass: "local-embedded-postgresql" as const,
    marker: input.targetKind,
    prefixVerified: true
  };
}
