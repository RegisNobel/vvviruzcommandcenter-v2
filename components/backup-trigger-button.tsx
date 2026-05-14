"use client";

import {useTransition, useState} from "react";
import {PlayCircle, Loader2} from "lucide-react";

import {triggerManualBackupAction} from "@/lib/actions/backups";

export function BackupTriggerButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);

  const handleTrigger = () => {
    setResult(null);
    startTransition(async () => {
      const res = await triggerManualBackupAction();
      setResult(res);
      
      // Clear success message after 5 seconds
      if (res.success) {
        setTimeout(() => setResult(null), 5000);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleTrigger}
        disabled={isPending}
        className="action-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Running Backup...
          </>
        ) : (
          <>
            <PlayCircle size={16} />
            Run Backup Now
          </>
        )}
      </button>

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
