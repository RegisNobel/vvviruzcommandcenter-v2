"use client";

import {useTransition, useState} from "react";
import {RotateCcw, Loader2, ChevronDown, AlertTriangle} from "lucide-react";

import {listAvailableBackupsAction, triggerRestoreAction} from "@/lib/actions/backups";

type DriveFile = {
  id: string;
  name: string;
  createdTime: string;
};

export function BackupRestoreButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);
  const [backups, setBackups] = useState<DriveFile[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<DriveFile | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const handleOpenPanel = async () => {
    if (showPanel) {
      setShowPanel(false);
      return;
    }

    setListLoading(true);
    setResult(null);
    setSelectedBackup(null);

    startTransition(async () => {
      const res = await listAvailableBackupsAction();
      setListLoading(false);

      if (!res.success) {
        setResult({success: false, message: res.message || "Failed to list backups."});
        return;
      }

      setBackups(res.backups);
      setShowPanel(true);
    });
  };

  const handleRestore = () => {
    if (!selectedBackup) return;

    setShowConfirm(false);
    setResult(null);

    startTransition(async () => {
      const res = await triggerRestoreAction(selectedBackup.id);
      setResult(res);

      if (res.success) {
        setShowPanel(false);
        setSelectedBackup(null);
      }
    });
  };

  const formatDate = (iso: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric"
    }).format(new Date(iso));
  };

  return (
    <div className="relative flex flex-col items-end gap-2">
      <button
        onClick={handleOpenPanel}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && !showPanel ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            {showConfirm ? "Restoring..." : "Loading..."}
          </>
        ) : (
          <>
            <RotateCcw size={16} />
            Restore from Backup
            <ChevronDown size={14} className={`transition ${showPanel ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {showPanel && backups.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] rounded-xl border border-[#252a31] bg-[#15181c] shadow-2xl">
          <div className="border-b border-[#252a31] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Select Backup to Restore
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {backups.map((backup) => (
              <button
                key={backup.id}
                onClick={() => {
                  setSelectedBackup(backup);
                  setShowConfirm(true);
                }}
                disabled={isPending}
                className={`w-full px-4 py-3 text-left transition hover:bg-panel-subtle ${
                  selectedBackup?.id === backup.id
                    ? "bg-amber-500/10 border-l-2 border-amber-500"
                    : ""
                }`}
              >
                <p className="text-sm font-medium text-ink truncate">{backup.name}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(backup.createdTime)}</p>
              </button>
            ))}
          </div>
          {backups.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">
              No database snapshots found in Google Drive.
            </div>
          )}
        </div>
      )}

      {showConfirm && selectedBackup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-red-500/30 bg-[#15181c] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <h3 className="text-lg font-bold text-ink">Confirm Restore</h3>
            </div>

            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>
                This will <strong className="text-red-400">overwrite your current database</strong> with the selected backup snapshot.
              </p>
              <div className="rounded-lg bg-[#1a1e24] px-3 py-2">
                <p className="text-xs text-muted">Selected Backup</p>
                <p className="mt-1 font-medium text-ink">{selectedBackup.name}</p>
                <p className="text-xs text-muted">{formatDate(selectedBackup.createdTime)}</p>
              </div>
              <p className="text-xs text-amber-400">
                Admin credentials will not be overwritten.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-[#252a31] px-4 py-2 text-sm font-semibold text-muted transition hover:bg-panel-subtle"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={14} />
                    Restoring...
                  </span>
                ) : (
                  "Yes, Restore Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <p
          className={`text-sm ${
            result.success ? "text-green-400" : "text-red-400"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
