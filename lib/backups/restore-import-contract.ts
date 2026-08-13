import {spawnSync} from "node:child_process";

export const RESTORE_IMPORT_RESULT_INVALID = "RESTORE_IMPORT_RESULT_INVALID";
export const RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH = "RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH";
export const RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT = "RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT";

const PROVENANCE_WARNING_SIGNALS = [
  "MISSING_ADMIN_ACTOR_REFERENCE",
  "RESTORE_PROVENANCE_COMPATIBILITY_WARNINGS"
];

export type SanitizedSubprocessResult = {
  status: number;
  stdout: string | Buffer;
  stderr: string | Buffer;
};

type RestoreImportResult = {
  counts: {
    restoreProvenanceWarnings: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export class RestoreImportInvariantError extends Error {
  invariantCode: string;

  constructor(invariantCode: string) {
    super(invariantCode);
    this.name = "RestoreImportInvariantError";
    this.invariantCode = invariantCode;
  }
}

function asUtf8(value: unknown) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return typeof value === "string" ? value : "";
}

export function runSanitizedSubprocess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: Buffer
): SanitizedSubprocessResult {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    input,
    encoding: input ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) throw new Error("Disposable restore subprocess failed safely.");
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function requireZeroRestoreProvenanceWarnings(result: Partial<SanitizedSubprocessResult>): RestoreImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(asUtf8(result.stdout).trim());
  } catch {
    throw new RestoreImportInvariantError(RESTORE_IMPORT_RESULT_INVALID);
  }

  const candidate = parsed as Partial<RestoreImportResult> | null;
  const count = candidate?.counts?.restoreProvenanceWarnings;
  if (!Number.isInteger(count) || (count as number) < 0) {
    throw new RestoreImportInvariantError(RESTORE_IMPORT_RESULT_INVALID);
  }
  if (count !== 0) {
    throw new RestoreImportInvariantError(RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH);
  }

  const stderr = asUtf8(result.stderr);
  if (PROVENANCE_WARNING_SIGNALS.some((signal) => stderr.includes(signal))) {
    throw new RestoreImportInvariantError(RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT);
  }

  return candidate as RestoreImportResult;
}

const restoreImportContract = {
  requireZeroRestoreProvenanceWarnings,
  RestoreImportInvariantError,
  RESTORE_IMPORT_RESULT_INVALID,
  RESTORE_PROVENANCE_WARNING_COUNT_MISMATCH,
  RESTORE_PROVENANCE_WARNING_SIGNAL_INCONSISTENT,
  runSanitizedSubprocess
};

export default restoreImportContract;
