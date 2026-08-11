"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, UploadCloud} from "lucide-react";

import {ReleasePicker} from "@/components/release-picker";
import {adminFetch, getAdminErrorMessage} from "@/lib/admin-errors";
import {adBatchTypeOptions, defaultAdAttributionSetting} from "@/lib/ads/batch-metadata";
import type {ReleaseSummary} from "@/lib/types";

export function AdsImportForm({releases}: {releases: ReleaseSummary[]}) {
  const router = useRouter();
  const [releaseId, setReleaseId] = useState("");
  const [name, setName] = useState("");
  const [batchType, setBatchType] = useState("Rolling Snapshot");
  const [exportedAt, setExportedAt] = useState("");
  const [attributionSetting, setAttributionSetting] = useState(defaultAdAttributionSetting);
  const [notes, setNotes] = useState("");
  const [sourceGranularity, setSourceGranularity] = useState<"DAILY" | "AGGREGATE_SNAPSHOT">("AGGREGATE_SNAPSHOT");
  const [accountTimezone, setAccountTimezone] = useState("");
  const [confirmedCurrency, setConfirmedCurrency] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<null | {previewToken: string; bundle: {sourceGranularity: string; campaignIntervalEligible: boolean; eligibilityReasons: string[]; coreTimingEligible: boolean; coreTimingEligibilityReasons: string[]; enrichmentCompatibility: string; enrichmentWarnings: string[]; accountId: string; normalizedTimezone: string; currency: string; currencyOrigin: string; rowCount: number; mergedDailyRowCount: number; metricObservationCount: number; sourceAsOfOrigin: string; commonReportingStart: string | null; commonReportingEnd: string | null; commonObservedDateCount: number; warnings: string[]; viewConflicts: Array<{field: string; code: string; blocksCampaignEligibility: boolean; blocksCoreTimingEligibility: boolean; blocksEnrichmentCompatibility: boolean}>; files: Array<{sanitizedFileName: string; sourceView: string; viewRole: string; rowCount: number; reportingStart: string | null; reportingEnd: string | null; observedDateCount: number; expectedDateCount: number | null; adCount: number; missingCoreDateCount: number; coverageState: string}>}}>(null);
  const [confirmFinalReview, setConfirmFinalReview] = useState(false);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [timezoneNotice, setTimezoneNotice] = useState<string | null>(null);
  const [replaceTimezone, setReplaceTimezone] = useState(false);
  const [timezoneReason, setTimezoneReason] = useState("");
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
    formData.set("exported_at", exportedAt ? new Date(exportedAt).toISOString() : "");
    formData.set("attribution_setting", attributionSetting);
    formData.set("notes", notes);
    formData.set("source_granularity", sourceGranularity);
    formData.set("account_timezone", accountTimezone);
    formData.set("confirmed_currency", confirmedCurrency);
    files.forEach((file) => formData.append("files", file));

    try {
      const payload = await adminFetch<{
        canCommit?: boolean;
        previewToken?: string | null;
        bundle?: NonNullable<typeof preview>["bundle"];
        message?: string;
      }>("/api/ads/import", {
        method: "POST",
        body: formData
      }, "Meta CSV import failed.");

      if (!payload.canCommit || !payload.previewToken || !payload.bundle) {
        throw new Error(payload.message ?? "Preview cannot be committed.");
      }
      setPreview({previewToken: payload.previewToken, bundle: payload.bundle});
      setIsSubmitting(false);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, "Import failed unexpectedly."));
      setIsSubmitting(false);
    }
  }

  async function handleCommit() {
    if (!preview) return; setIsSubmitting(true); setMessage(null);
    try {
      const payload = await adminFetch<{importId?: string; message?: string}>("/api/ads/import/commit", {
        method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({
          previewToken: preview.previewToken, clientIdempotencyKey: crypto.randomUUID(), confirmFinalReview, acknowledgeWarnings
        })
      }, "Meta CSV commit failed.");
      if (!payload.importId) throw new Error(payload.message ?? "Import failed.");
      router.push(`/admin/ad-lab/${payload.importId}`); router.refresh();
    } catch (error) { setMessage(getAdminErrorMessage(error, "Import failed unexpectedly.")); setIsSubmitting(false); }
  }

  async function handleConfirmAccountTimezone() {
    if (!preview?.bundle.accountId || !accountTimezone) return; setIsSubmitting(true); setMessage(null); setTimezoneNotice(null);
    try {
      const payload = await adminFetch<{item: {timezone: string}}>(`/api/ads/accounts/${encodeURIComponent(preview.bundle.accountId)}/timezone`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({timezone: accountTimezone, replaceCurrent: replaceTimezone, reason: timezoneReason})}, "Meta account timezone confirmation failed.");
      setTimezoneNotice(`${payload.item.timezone} is now the reviewed reusable timezone for this Meta account.`);
    } catch (error) { setMessage(getAdminErrorMessage(error, "Timezone confirmation failed.")); }
    finally { setIsSubmitting(false); }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Meta CSV import</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Import Ad Lab Report
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Upload one or more Meta report CSV exports. The importer normalizes
                available columns, merges matching ad rows, and keeps this CSV-first
                until Meta API access is worth adding.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin/ad-lab">
              <ArrowLeft size={16} />
              Back to Ad Lab
            </Link>
          </div>
        </section>

        <form className="panel space-y-6 px-4 py-6 sm:px-8 sm:py-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <span className="field-label">Linked Release</span>
              <ReleasePicker
                ariaLabel="Select release for Meta import"
                emptyOption={{label: "No Release / Batch Only", value: ""}}
                onValueChange={setReleaseId}
                releases={releases}
                value={releaseId}
              />
            </div>

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
              <span className="field-label">User-confirmed source as-of (optional)</span>
              <input
                className="field-input"
                onChange={(event) => setExportedAt(event.target.value)}
                type="datetime-local"
                value={exportedAt}
              />
              <span className="text-xs text-muted">Leave blank unless this timestamp is shown by Meta or you explicitly recorded it at export. Upload time is only a fallback.</span>
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

            <label className="space-y-2">
              <span className="field-label">Source granularity</span>
              <select className="field-input" onChange={(event) => setSourceGranularity(event.target.value as typeof sourceGranularity)} value={sourceGranularity}>
                <option value="AGGREGATE_SNAPSHOT">Aggregate snapshot</option>
                <option value="DAILY">Daily export</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Reviewed account timezone (only if export omits it)</span>
              <input className="field-input" onChange={(event) => setAccountTimezone(event.target.value)} placeholder="America/New_York" value={accountTimezone} />
            </label>

            <label className="space-y-2">
              <span className="field-label">Reviewed currency (only if export and spend header omit it)</span>
              <input className="field-input" maxLength={3} onChange={(event) => setConfirmedCurrency(event.target.value.toUpperCase())} placeholder="USD" value={confirmedCurrency} />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">CSV Files</span>
              <input
                accept=".csv,text/csv"
                aria-describedby={message ? "meta-import-error" : undefined}
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
            <div aria-live="assertive" className="state-panel-danger" id="meta-import-error" role="alert">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button className="action-button-primary" disabled={isSubmitting} type="submit">
              <UploadCloud size={16} />
              {isSubmitting ? "Preparing preview..." : "Preview CSV"}
            </button>
          </div>
        </form>

        {preview ? (
          <section className="panel space-y-5 px-4 py-6 sm:px-8 sm:py-7">
            <div>
              <div className="pill">Final review</div>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Review before commit</h2>
              <p className="mt-2 text-sm text-muted">{preview.bundle.rowCount} source rows across {preview.bundle.files.length} files; {preview.bundle.mergedDailyRowCount} daily facts.</p>
            </div>
            <div className="rounded-[18px] border border-[#31353b] p-4 text-sm text-muted">
              <p>Granularity: <span className="text-ink">{preview.bundle.sourceGranularity}</span></p>
              <p>Metric observations: <span className="text-ink">{preview.bundle.metricObservationCount}</span></p>
              <p>Source as-of origin: <span className="text-ink">{preview.bundle.sourceAsOfOrigin}</span></p>
              <p>Core timing eligible: <span className="text-ink">{preview.bundle.coreTimingEligible ? "Yes" : "No"}</span></p>
              <p>Enrichment compatibility: <span className="text-ink">{preview.bundle.enrichmentCompatibility}</span></p>
              <p>Account: <span className="text-ink">{preview.bundle.accountId || "Unresolved"}</span></p>
              <p>Timezone: <span className="text-ink">{preview.bundle.normalizedTimezone || "Unresolved"}</span></p>
              <p>Currency: <span className="text-ink">{preview.bundle.currency || "Unresolved"}</span></p>
              <p>Currency origin: <span className="text-ink">{preview.bundle.currencyOrigin}</span></p>
              {preview.bundle.coreTimingEligibilityReasons.length ? <p className="mt-2 text-[#d7b45e]">Core timing blockers: {preview.bundle.coreTimingEligibilityReasons.join(", ")}</p> : null}
              {preview.bundle.enrichmentWarnings.length ? <p className="mt-2 text-[#d7b45e]">Enrichment warnings: {preview.bundle.enrichmentWarnings.join(", ")}</p> : null}
              {preview.bundle.viewConflicts.length ? <p className="mt-2 text-[#ef8e8e]">Source-view conflicts: {preview.bundle.viewConflicts.map((conflict) => `${conflict.code}${conflict.blocksCoreTimingEligibility ? " (blocks core timing)" : conflict.blocksEnrichmentCompatibility ? " (enrichment degraded)" : ""}`).join(", ")}</p> : null}
              {preview.bundle.warnings.length ? <p className="mt-2 text-[#d7b45e]">Warnings: {preview.bundle.warnings.join(", ")}</p> : null}
            </div>
            <div className="space-y-2 rounded-[18px] border border-[#31353b] p-4 text-sm text-muted"><p className="font-semibold text-ink">Per-view coverage</p>{preview.bundle.files.map((file) => <p key={file.sanitizedFileName}>{file.viewRole}: {file.reportingStart || "unknown"} through {file.reportingEnd || "unknown"} · {file.observedDateCount} observed day(s) · {file.adCount} ad(s) · {file.missingCoreDateCount} core day(s) without this enrichment</p>)}<p>Common intersection: {preview.bundle.commonReportingStart || "none"} through {preview.bundle.commonReportingEnd || "none"} · {preview.bundle.commonObservedDateCount} day(s)</p></div>
            {preview.bundle.accountId && accountTimezone ? <div className="space-y-3 rounded-[18px] border border-[#31353b] p-4 text-sm text-muted"><p className="font-semibold text-ink">Reusable account timezone</p><p>Save {accountTimezone} for Meta Account {preview.bundle.accountId}. Future compatible imports can reuse it without weekly reconfirmation.</p><label className="flex gap-3"><input checked={replaceTimezone} onChange={(event) => setReplaceTimezone(event.target.checked)} type="checkbox" /> Explicitly replace a conflicting reviewed timezone.</label>{replaceTimezone ? <input className="field-input" onChange={(event) => setTimezoneReason(event.target.value)} placeholder="Required audit reason" value={timezoneReason} /> : null}<button className="action-button-secondary" disabled={isSubmitting || (replaceTimezone && !timezoneReason.trim())} onClick={() => void handleConfirmAccountTimezone()} type="button">Confirm account timezone</button>{timezoneNotice ? <p className="text-emerald-300">{timezoneNotice}</p> : null}</div> : null}
            {preview.bundle.warnings.length ? <label className="flex gap-3 text-sm text-muted"><input checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} type="checkbox" /> I reviewed the validation warnings.</label> : null}
            <label className="flex gap-3 text-sm text-muted"><input checked={confirmFinalReview} onChange={(event) => setConfirmFinalReview(event.target.checked)} type="checkbox" /> I confirm the files, account context, granularity, reporting range, and eligibility classification shown above.</label>
            <div className="flex justify-end"><button className="action-button-primary" disabled={isSubmitting || !confirmFinalReview || (preview.bundle.warnings.length > 0 && !acknowledgeWarnings)} onClick={handleCommit} type="button"><UploadCloud size={16} />{isSubmitting ? "Committing..." : "Commit import"}</button></div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
