export const BLOB_BACKUP_RETENTION_DAYS = 7;

export type RetentionCandidate = {
  id: string;
  type: string;
  startedAt: Date;
  blobPath: string;
  googleDriveFileId: string | null;
  checksumSha256: string | null;
  sizeBytes: number | null;
};

export function selectBackupPruneCandidates<T extends RetentionCandidate>(runs: T[], now = new Date()): T[] {
  const sorted = [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const kept = new Map<string, number>();
  return sorted.filter((run) => {
    const count = (kept.get(run.type) ?? 0) + 1;
    kept.set(run.type, count);
    return count > 2 && run.startedAt.getTime() < now.getTime() - BLOB_BACKUP_RETENTION_DAYS * 86400_000 &&
      Boolean(run.blobPath && run.googleDriveFileId && /^[a-f0-9]{64}$/.test(run.checksumSha256 ?? "") && (run.sizeBytes ?? 0) > 0);
  }).reverse();
}

export async function pruneVerifiedBackupCopies<T>(candidates: T[], actions: {
  verify: (candidate: T) => Promise<void>;
  remove: (candidate: T) => Promise<void>;
}) {
  let deleted = 0;
  let blocked = 0;
  for (const candidate of candidates) {
    try {
      await actions.verify(candidate);
      await actions.remove(candidate);
      deleted++;
    } catch {
      blocked++;
    }
  }
  return {deleted, blocked};
}
