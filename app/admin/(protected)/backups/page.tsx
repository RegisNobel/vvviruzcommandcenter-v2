import {BackupRestoreButton} from "@/components/backup-restore-button";
import {BackupTriggerButton} from "@/components/backup-trigger-button";
import {getRecentBackupRuns} from "@/lib/repositories/backups";

export const dynamic = "force-dynamic";

function formatRelativeTime(date: Date) {
  const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours`;
  return `${Math.floor(diffInSeconds / 86400)} days`;
}

function formatTimestamp(date: Date | null) {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric"
  }).format(date);
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "N/A";
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + " KB";
  const mb = kb / 1024;
  return mb.toFixed(2) + " MB";
}

function StatusBadge({status}: {status: string}) {
  switch (status) {
    case "success":
      return <span className="status-badge-ready">Success</span>;
    case "failed":
      return <span className="status-badge-danger">Failed</span>;
    case "running":
      return <span className="status-badge-info">Running</span>;
    default:
      return <span className="status-badge-neutral">Unknown</span>;
  }
}

export default async function AdminBackupsPage() {
  const recentRuns = await getRecentBackupRuns(10);
  const latestRun = recentRuns[0];
  const latestFailedRun = recentRuns.find(r => r.status === "failed");

  let recordCountsSummary = "No counts available.";
  let blobStatus = "Unknown";
  let googleDriveStatus = "Unknown";

  if (latestRun) {
    if (latestRun.destination.includes("vercel_blob")) {
      blobStatus = "Success";
    } else if (latestRun.status === "failed") {
      blobStatus = "Failed";
    }

    if (latestRun.destination.includes("google_drive")) {
      googleDriveStatus = "Success";
    } else if (latestRun.status === "failed" || !latestRun.googleDriveFileId) {
      googleDriveStatus = "Skipped / Disabled";
    }

    try {
      if (latestRun.recordCounts && latestRun.recordCounts !== "{}") {
        const counts = JSON.parse(latestRun.recordCounts);
        const entries = Object.entries(counts);
        
        if (entries.length > 0) {
          recordCountsSummary = entries
            .map(([key, value]) => `${key}: ${value}`)
            .join(" • ");
        }
      }
    } catch {
      // Ignored
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <section className="command-surface overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">System Health</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Backup Health
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Confirm that Command Center backups are running securely and without errors.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <BackupRestoreButton />
              <BackupTriggerButton />
            </div>
          </div>
        </section>

        {latestRun ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="command-surface px-4 py-5">
              <p className="field-label">Last Backup</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={latestRun.status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">
                {formatRelativeTime(new Date(latestRun.startedAt))} {formatRelativeTime(new Date(latestRun.startedAt)) !== "Just now" && "ago"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatTimestamp(latestRun.startedAt)}
              </p>
            </div>

            <div className="command-surface px-4 py-5">
              <p className="field-label">Primary Destination</p>
              <p className="mt-2 text-sm font-semibold text-ink">Vercel Blob</p>
              <p className="mt-2 text-sm text-muted">Status: {blobStatus}</p>
            </div>

            <div className="command-surface px-4 py-5">
              <p className="field-label">Offsite Destination</p>
              <p className="mt-2 text-sm font-semibold text-ink">Google Drive</p>
              <p className="mt-2 text-sm text-muted">Status: {googleDriveStatus}</p>
            </div>

            <div className="command-surface px-4 py-5">
              <p className="field-label">Records Captured</p>
              <p className="mt-2 text-sm font-semibold text-ink">{latestRun.type === "database_snapshot" ? "Database Snapshot" : "Asset Manifest"}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-3">
                {recordCountsSummary}
              </p>
            </div>
          </div>
        ) : (
          <div className="command-surface px-4 py-5 text-center text-sm text-muted">
            No backups have been recorded yet.
          </div>
        )}

        {latestFailedRun && latestFailedRun.errorMessage ? (
          <section className="command-surface border-red-500/20 bg-red-500/5 px-4 py-5 sm:px-6">
            <h2 className="text-sm font-bold text-red-400">
              Latest Error ({latestFailedRun.type === "database_snapshot" ? "Database" : "Assets"})
            </h2>
            <p className="mt-2 font-mono text-xs text-red-300">
              {latestFailedRun.errorMessage}
            </p>
            <p className="mt-2 text-[10px] text-red-400/50 uppercase tracking-wider">
              Occurred {formatRelativeTime(new Date(latestFailedRun.startedAt))} ago
            </p>
          </section>
        ) : null}

        <section className="command-surface overflow-hidden">
          <div className="border-b border-edge px-4 py-5 sm:px-6">
            <h2 className="text-lg font-semibold text-ink">Recent Backup Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-edge text-sm">
              <thead className="bg-input">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted">Started</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted">Size</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted">Destinations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge bg-transparent">
                {recentRuns.map((run) => (
                  <tr key={run.id} className="transition hover:bg-surface-hover">
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {formatTimestamp(run.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {run.type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatBytes(run.sizeBytes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {run.destination ? run.destination.replace(/_/g, " ") : "None"}
                    </td>
                  </tr>
                ))}
                {recentRuns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-muted">
                      No recent backup runs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="command-surface px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-ink">Restore &amp; Recovery</h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
            <p>
              <strong className="text-ink">One-Click Restore:</strong> Use the &ldquo;Restore from Backup&rdquo; button above to download, decrypt, and import the latest database snapshot from Google Drive directly into this environment.
            </p>
            <p>
              <strong className="text-ink">Provider Backups are Primary:</strong> Your first line of defense for database restore is the automated backup system of your Postgres hosting provider (e.g., Supabase, Neon, Vercel Postgres).
            </p>
            <p>
              <strong className="text-ink">App-Level Snapshots:</strong> The backups displayed here are portable encrypted JSON snapshots of your database and media manifests. They provide an extra recovery path if you need to migrate hosts or rebuild from scratch.
            </p>
            <p>
              <strong className="text-ink">Admin Credentials:</strong> Restore operations <em>never</em> overwrite admin users or auth sessions. Your login credentials remain intact after any restore.
            </p>
            <p>
              <strong className="text-ink">Encryption:</strong> Backup artifacts are encrypted <em>before</em> leaving this server. <strong>Never expose your BACKUP_ENCRYPTION_SECRET.</strong>
            </p>
            <p>
              <strong className="text-ink">Manual Restore (CLI):</strong> You can also restore locally by downloading a backup from Google Drive, decrypting it with <code>npm run db:decrypt:backup</code>, and running <code>npm run db:import:snapshot</code>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
