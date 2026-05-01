"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {Trash2, X} from "lucide-react";

export function AdsDeleteBatchButton({
  afterDeleteHref = "/admin/ads?deleted=1",
  batchId,
  batchName,
  compact = false
}: {
  afterDeleteHref?: string;
  batchId: string;
  batchName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canDelete = confirmation === "DELETE";

  async function handleDelete() {
    if (!canDelete) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${batchId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({confirmation})
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Batch deletion failed.");
      }

      router.push(afterDeleteHref);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        className={compact ? "action-button-danger px-3 py-2 text-xs" : "action-button-danger"}
        onClick={() => {
          setConfirmation("");
          setMessage(null);
          setIsOpen(true);
        }}
        type="button"
      >
        <Trash2 size={compact ? 14 : 16} />
        Delete
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-[#5a312d] bg-[#111418] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="field-label text-[#e79a8f]">Destructive cleanup</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Delete ad import batch?</h2>
              </div>
              <button
                className="action-button-tertiary !w-auto"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-6 text-muted">
              <p>
                This will permanently delete{" "}
                <span className="font-semibold text-ink">{batchName}</span> from Ads Analytics.
              </p>
              <div className="rounded-[22px] border border-[#5a312d] bg-[#1c1313] px-4 py-4">
                <p className="font-semibold text-[#f0d7d2]">This will delete:</p>
                <p className="mt-2">
                  the import batch, its ad report rows, Copy Lab links attached to those rows,
                  and campaign learnings for this batch.
                </p>
              </div>
              <div className="rounded-[22px] border border-[#30343b] bg-[#121418] px-4 py-4">
                <p className="font-semibold text-ink">This will not delete:</p>
                <p className="mt-2">
                  releases, Copy Lab entries, other ad batches, /links analytics, public site
                  content, or any release data.
                </p>
              </div>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="field-label">Type DELETE to confirm</span>
              <input
                className="field-input"
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE"
                value={confirmation}
              />
            </label>

            {message ? (
              <div className="mt-4 rounded-[18px] border border-[#5a312d] bg-[#1c1313] px-4 py-3 text-sm text-[#d4a7a0]">
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="action-button-secondary"
                disabled={isDeleting}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Keep Batch
              </button>
              <button
                className="action-button-danger"
                disabled={!canDelete || isDeleting}
                onClick={() => void handleDelete()}
                type="button"
              >
                <Trash2 size={16} />
                {isDeleting ? "Deleting..." : "Delete Batch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
