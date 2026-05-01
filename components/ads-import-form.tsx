"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, UploadCloud} from "lucide-react";

import {adBatchTypeOptions, defaultAdAttributionSetting} from "@/lib/ads/batch-metadata";
import type {ReleaseSummary} from "@/lib/types";

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function AdsImportForm({releases}: {releases: ReleaseSummary[]}) {
  const router = useRouter();
  const [releaseId, setReleaseId] = useState("");
  const [name, setName] = useState("");
  const [batchType, setBatchType] = useState("Rolling Snapshot");
  const [exportedAt, setExportedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [attributionSetting, setAttributionSetting] = useState(defaultAdAttributionSetting);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === releaseId) ?? null,
    [releaseId, releases]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const formData = new FormData();

    formData.set("release_id", releaseId);
    formData.set("name", name);
    formData.set("batch_type", batchType);
    formData.set("exported_at", exportedAt);
    formData.set("attribution_setting", attributionSetting);
    formData.set("notes", notes);
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/ads/import", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as {
        batchId?: string;
        message?: string;
      };

      if (!response.ok || !payload.batchId) {
        throw new Error(payload.message ?? "Import failed.");
      }

      router.push(`/admin/ads/${payload.batchId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed unexpectedly.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Meta CSV import</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Import Ads Report
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Upload one or more Meta report CSV exports. The importer normalizes
                available columns, merges matching ad rows, and keeps this CSV-first
                until Meta API access is worth adding.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin/ads">
              <ArrowLeft size={16} />
              Back to Ads
            </Link>
          </div>
        </section>

        <form className="panel space-y-6 px-4 py-6 sm:px-8 sm:py-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Linked Release</span>
              <select
                className="field-input"
                onChange={(event) => setReleaseId(event.target.value)}
                value={releaseId}
              >
                <option value="">No Release / Batch Only</option>
                {releases.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Batch Name</span>
              <input
                className="field-input"
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional: Beast Mode launch test"
                value={name}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Batch Type</span>
              <select
                className="field-input"
                onChange={(event) => setBatchType(event.target.value)}
                value={batchType}
              >
                {adBatchTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Exported At</span>
              <input
                className="field-input"
                onChange={(event) => setExportedAt(event.target.value)}
                type="datetime-local"
                value={exportedAt}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Attribution Setting</span>
              <input
                className="field-input"
                onChange={(event) => setAttributionSetting(event.target.value)}
                placeholder={defaultAdAttributionSetting}
                value={attributionSetting}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">CSV Files</span>
              <input
                accept=".csv,text/csv"
                className="field-input"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                required
                type="file"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Notes</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context: audience, budget, date range, testing angle..."
                value={notes}
              />
            </label>
          </div>

          <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-5 py-5 text-sm leading-6 text-muted">
            {files.length > 0 ? (
              <>
                <span className="font-semibold text-ink">{files.length}</span> file
                {files.length === 1 ? "" : "s"} queued:{" "}
                <span className="text-ink">{files.map((file) => file.name).join(", ")}</span>
              </>
            ) : (
              "Choose CSV exports from Meta Ads Manager. Unsupported files will be rejected before import."
            )}
            {selectedRelease ? (
              <p className="mt-3">
                This batch will be linked to{" "}
                <span className="font-semibold text-ink">{selectedRelease.title}</span>.
              </p>
            ) : null}
            {batchType === "Rolling Snapshot" ? (
              <p className="mt-3 rounded-[18px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-[#d7b45e]">
                Rolling Snapshot imports are overlapping Meta snapshots. Do not sum them with
                other overlapping batches.
              </p>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-[22px] border border-[#5a312d] bg-[#1c1313] px-4 py-3 text-sm text-[#d4a7a0]">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button className="action-button-primary" disabled={isSubmitting} type="submit">
              <UploadCloud size={16} />
              {isSubmitting ? "Importing..." : "Import CSV"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
