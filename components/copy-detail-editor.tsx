"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, FolderOpen, Save, Trash2} from "lucide-react";

import {copyTypeOptions, formatCopyType} from "@/lib/copy";
import {AUTOSAVE_INTERVAL_MS} from "@/lib/constants";
import type {CopyRecord, CopyType, ReleaseSummary} from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

function serializeCopy(copy: CopyRecord) {
  return JSON.stringify(copy);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function CopyDetailEditor({
  initialCopy,
  releases
}: {
  initialCopy: CopyRecord;
  releases: ReleaseSummary[];
}) {
  const router = useRouter();
  const [copy, setCopy] = useState(initialCopy);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef<string>(serializeCopy(initialCopy));
  const latestDraftSnapshotRef = useRef<string>(serializeCopy(initialCopy));
  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === copy.release_id) ?? null,
    [copy.release_id, releases]
  );
  const saveStatusLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save error"
        : hasPendingChanges
          ? "Unsaved changes"
          : "Saved";
  const isErrorMessage = useMemo(() => {
    if (!message) {
      return false;
    }

    const normalizedMessage = message.toLowerCase();

    return (
      saveState === "error" ||
      normalizedMessage.includes("failed") ||
      normalizedMessage.includes("error")
    );
  }, [message, saveState]);

  useEffect(() => {
    latestDraftSnapshotRef.current = serializeCopy(copy);
  }, [copy]);

  const persistCopy = useCallback(async (
    copyToSave: CopyRecord,
    options?: {successMessage?: string | null}
  ) => {
    const snapshot = serializeCopy(copyToSave);
    const previousSnapshot = lastSavedSnapshotRef.current;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    lastSavedSnapshotRef.current = snapshot;
    setSaveState("saving");

    try {
      const response = await fetch(`/api/copies/${copyToSave.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: snapshot
      });
      const payload = (await response.json()) as {
        copy?: CopyRecord;
        message?: string;
      };

      if (!response.ok || !payload.copy) {
        throw new Error(payload.message ?? "Save failed.");
      }

      lastSavedSnapshotRef.current = serializeCopy(payload.copy);
      setCopy(payload.copy);
      setSaveState("saved");
      setHasPendingChanges(latestDraftSnapshotRef.current !== snapshot);

      if (options?.successMessage !== null) {
        setMessage(options?.successMessage ?? "Changes saved.");
      }
    } catch (error) {
      lastSavedSnapshotRef.current = previousSnapshot;
      setSaveState("error");
      setHasPendingChanges(true);
      setMessage(error instanceof Error ? error.message : "Save failed unexpectedly.");
    }
  }, []);

  useEffect(() => {
    const snapshot = serializeCopy(copy);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistCopy(copy, {successMessage: null});
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [copy, persistCopy]);

  function updateCopy(mutator: (current: CopyRecord) => CopyRecord) {
    setCopy((current) => mutator(current));
    setHasPendingChanges(true);
    setMessage(null);
  }

  async function handleManualSave() {
    if (!hasPendingChanges) {
      setMessage("No unsaved changes to save.");
      return;
    }

    await persistCopy(copy, {successMessage: "Copy saved."});
  }

  async function handleDelete() {
    const shouldDelete = window.confirm("Delete this copy? This cannot be undone.");

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/copies/${copy.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Delete failed.");
      }

      router.push("/admin/copy-lab");
      router.refresh();
    } catch (error) {
      setIsDeleting(false);
      setMessage(error instanceof Error ? error.message : "Delete failed unexpectedly.");
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1450px] space-y-6">
        <section className="panel overflow-hidden px-6 py-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="pill">Copy Lab</div>
                <div className="pill">#{copy.id.slice(0, 8)}</div>
                <div className="pill">{formatCopyType(copy.type)}</div>
                <div className="pill">
                  {selectedRelease ? selectedRelease.title : "Standalone"}
                </div>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {copy.hook.trim() || "Untitled Copy"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Build and refine hook and caption pairs, then attach them to a release
                when they belong in a rollout.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#31353b] bg-[#111317] p-4 sm:p-5">
              <div className="space-y-3 rounded-[22px] border border-[#3a3f46] bg-[#16191d] p-4 text-sm text-muted">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Type</span>
                  <span className="font-semibold text-ink">{formatCopyType(copy.type)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Release</span>
                  <span className="font-semibold text-ink">
                    {selectedRelease ? selectedRelease.title : "Standalone"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Autosave</span>
                  <span className="font-semibold text-ink">Every minute</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Save Status</span>
                  <span className="font-semibold text-ink">
                    {saveStatusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="action-button-tertiary" href="/admin/copy-lab">
            <ArrowLeft size={16} />
            Back to Copy Lab
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {selectedRelease ? (
              <Link className="action-button-secondary" href={`/admin/releases/${selectedRelease.id}`}>
                <FolderOpen size={16} />
                Open Release
              </Link>
            ) : null}

            <button
              className={hasPendingChanges ? "action-button-primary" : "action-button-secondary"}
              disabled={saveState === "saving" || !hasPendingChanges}
              onClick={() => void handleManualSave()}
              type="button"
            >
              <Save size={16} />
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>

            <button
              className="action-button-danger"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              type="button"
            >
              <Trash2 size={16} />
              {isDeleting ? "Deleting..." : "Delete Copy"}
            </button>

            {message ? (
              <span
                className={`rounded-full border px-4 py-2 text-sm ${
                  isErrorMessage
                    ? "border-[#5a312d] bg-[#1c1313] text-[#d4a7a0]"
                    : "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                }`}
              >
                {message}
              </span>
            ) : null}
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <div>
                <p className="field-label">Section 1</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Basic Info</h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="field-label">Type</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      updateCopy((current) => ({
                        ...current,
                        type: event.target.value as CopyType
                      }))
                    }
                    value={copy.type}
                  >
                    {copyTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {formatCopyType(type)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Attach to Release</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      updateCopy((current) => ({
                        ...current,
                        release_id: event.target.value || null
                      }))
                    }
                    value={copy.release_id ?? ""}
                  >
                    <option value="">No Release / Standalone</option>
                    {releases.map((release) => (
                      <option key={release.id} value={release.id}>
                        {release.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="panel space-y-4 px-4 py-5 sm:px-6 sm:py-6">
              <div>
                <p className="field-label">Section 2</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Hook</h2>
              </div>

              <textarea
                className="field-input min-h-[170px]"
                onChange={(event) =>
                  updateCopy((current) => ({
                    ...current,
                    hook: event.target.value
                  }))
                }
                placeholder="Lead with the strongest first-line idea here..."
                value={copy.hook}
              />
            </section>

            <section className="panel space-y-4 px-4 py-5 sm:px-6 sm:py-6">
              <div>
                <p className="field-label">Section 3</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Caption</h2>
              </div>

              <textarea
                className="field-input min-h-[240px]"
                onChange={(event) =>
                  updateCopy((current) => ({
                    ...current,
                    caption: event.target.value
                  }))
                }
                placeholder="Write the supporting caption, CTA, or body copy here..."
                value={copy.caption}
              />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <div>
                <p className="field-label">Link Status</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Release Context</h2>
              </div>

              <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4 text-sm leading-6 text-muted">
                {selectedRelease ? (
                  <>
                    This copy is linked to{" "}
                    <span className="font-semibold text-ink">{selectedRelease.title}</span>.
                    It will show up inside that release automatically.
                  </>
                ) : (
                  <>
                    This copy is standalone. Use this for neutral concepts or reusable
                    captions that should not be attached to a specific release yet.
                  </>
                )}
              </div>
            </section>

            <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <div>
                <p className="field-label">Record Info</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Metadata</h2>
              </div>

              <div className="space-y-3 rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4 text-sm text-muted">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">ID</span>
                  <span className="font-mono text-xs text-ink">{copy.id}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Created On</span>
                  <span className="text-right text-ink">
                    {formatTimestamp(copy.created_on)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="field-label">Updated On</span>
                  <span className="text-right text-ink">
                    {formatTimestamp(copy.updated_on)}
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
