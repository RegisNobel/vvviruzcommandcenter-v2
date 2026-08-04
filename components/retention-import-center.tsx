"use client";

import Link from "next/link";
import {useMemo, useRef, useState, type DragEvent, type FormEvent} from "react";
import {AlertTriangle, CheckCircle2, ChevronDown, FileSearch, LoaderCircle, UploadCloud} from "lucide-react";

import {AdminConfirmDialog} from "@/components/admin-confirm-dialog";
import {ReleasePicker} from "@/components/release-picker";
import {EmptyState, ErrorState} from "@/components/ui-state";
import {adminFetch, AdminRequestError, getAdminErrorMessage, readAdminApiResponse} from "@/lib/admin-errors";
import {importErrorCopy, validateSpotifyCsvFile} from "@/lib/analytics/import-center-ui";
import type {ArtistOption, ImportListItem, RetentionReleaseOption} from "@/lib/analytics/import-center-types";

type PreviewIssue = {code?: string; message?: string; field?: string};
type MappingSuggestion = {
  candidateRelease: {id: string; title: string; releaseDate: string | null} | null;
  matchMethod: string;
  confidence: string;
  competingCandidates: Array<{releaseId: string; title: string; score?: number}>;
  existingAliasId: string | null;
  manualConfirmationRequired: boolean;
  mayAutoApply: boolean;
};
type PreviewRow = {
  originalRowNumber: number;
  outcome: string;
  safeDisplayValues: Record<string, string>;
  normalizedValues: Record<string, unknown> | null;
  errors: PreviewIssue[];
  warnings: PreviewIssue[];
  mappingSuggestion?: MappingSuggestion;
};
export type SpotifyImportPreview = {
  ok: boolean;
  code: string;
  message: string;
  previewToken: string | null;
  previewId?: string | null;
  expiresAt: string | null;
  detectedType: string | null;
  performanceLabel: string | null;
  fileHash: string | null;
  duplicateFile: boolean;
  existingImport: {id: string; status: string} | null;
  parserVersion: string;
  normalizationVersion: string;
  originalFilename: string;
  safeDisplayFilename: string;
  fileSizeBytes: number;
  dateRange: {minimumDate?: string; maximumDate?: string; missingDates?: string[]} | null;
  previewPeriod: {periodStart: string; periodEnd: string} | null;
  requiresPeriodConfirmation: boolean;
  counts: {accepted: number; warnings: number; rejected: number; unmatched: number};
  rowPreview: PreviewRow[];
  rowPreviewTruncated: boolean;
  blockingErrors: PreviewIssue[];
  fileWarnings: PreviewIssue[];
  requiredActions: string[];
  overlaps: Array<{classification: string; importId: string | null; message: string}>;
  candidateArtist: ArtistOption | null;
  candidateRelease: {id: string; title: string} | null;
  reconciliation: {entries?: Array<Record<string, unknown>>};
};

type MappingDecision = {mode: "mapped" | "unmatched"; releaseId: string; reason: string; note: string};
type ImportDetailResult = {import: ImportListItem & {validationSummary?: {reconciliation?: {entries?: unknown[]}}; _count?: Record<string, number>; rawFileExpiresAt: string | null}};

const EXPORT_LABELS: Record<string, string> = {
  ARTIST_AUDIENCE_TIMELINE: "Artist Audience Timeline",
  TRACK_STREAM_TIMELINE: "Track Stream Timeline",
  SONGS_PERIOD: "Songs Period Export",
  PLAYLISTS_PERIOD: "Playlists Period Export"
};
const UNMATCHED_REASONS = [
  ["RELEASE_NOT_IN_CATALOG", "Release not in catalog"],
  ["AMBIGUOUS_MATCH", "Ambiguous match"],
  ["WRONG_ARTIST", "Wrong artist"],
  ["DUPLICATE_EXPORT_ROW", "Duplicate export row"],
  ["VERSION_NOT_SUPPORTED", "Unsupported version"],
  ["USER_DEFERRED", "Deferred"],
  ["OTHER", "Other"]
];

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", {dateStyle: "medium", timeStyle: "short"}).format(date);
}
function formatBytes(value: number) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(2)} MiB`;
}
function safeRowTitle(row: PreviewRow) {
  return row.safeDisplayValues["Song"] || row.safeDisplayValues["Track"] || row.safeDisplayValues["song"] || row.safeDisplayValues["exportedTitle"] || Object.values(row.safeDisplayValues)[0] || `Row ${row.originalRowNumber}`;
}
function rowDate(row: PreviewRow) {
  return row.safeDisplayValues["Release date"] || row.safeDisplayValues["Release Date"] || row.safeDisplayValues["exportedReleaseDate"] || "No release date";
}
function StatusBadge({value}: {value: string}) {
  const positive = ["IMPORTED", "READY", "CONFIRMED", "AVAILABLE", "PREVIEW_READY"].includes(value);
  const warning = value.includes("WARNING") || value.includes("UNMATCHED") || value.includes("EXPIRED") || value.includes("REPLACED");
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${positive ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : warning ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-edge bg-input text-secondary"}`}>{value.replaceAll("_", " ")}</span>;
}

function ValidationGroup({title, rows, issues, tone}: {title: string; rows?: PreviewRow[]; issues?: PreviewIssue[]; tone: string}) {
  const count = rows?.length ?? issues?.length ?? 0;
  return (
    <details className="rounded-xl border border-edge bg-input" open={count > 0 && title !== "Ready"}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
        <span className="flex items-center gap-2"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${tone}`} />{title}</span>
        <span>{count} <ChevronDown aria-hidden="true" className="inline" size={14} /></span>
      </summary>
      <div className="space-y-2 border-t border-edge px-4 py-3 text-sm text-secondary">
        {count === 0 ? <p>None.</p> : null}
        {issues?.map((issue, index) => <p key={`${issue.code}-${index}`}><span className="font-mono text-xs text-muted">{issue.code || "NOTICE"}</span> — {issue.message || "Review this file issue."}</p>)}
        {rows?.map((row) => <div className="rounded-lg border border-edge bg-surface-elevated p-3" key={row.originalRowNumber}><p className="font-semibold text-ink">Source row {row.originalRowNumber}: {safeRowTitle(row)}</p>{[...row.errors, ...row.warnings].map((issue, index) => <p className="mt-1" key={`${issue.code}-${index}`}><span className="font-mono text-xs">{issue.code || row.outcome}</span> — {issue.message || row.outcome}</p>)}<details className="mt-2"><summary className="cursor-pointer text-xs text-muted">Developer details</summary><dl className="mt-2 grid gap-1 text-xs">{Object.entries(row.normalizedValues || {}).map(([key, value]) => <div className="flex gap-2" key={key}><dt className="font-mono text-muted">{key}</dt><dd className="break-all">{String(value ?? "null")}</dd></div>)}</dl></details></div>)}
      </div>
    </details>
  );
}

export function SpotifyImportWorkflow({artists, releases, canonicalArtistId, initialPreview = null}: {artists: ArtistOption[]; releases: RetentionReleaseOption[]; canonicalArtistId: string | null; initialPreview?: SpotifyImportPreview | null}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SpotifyImportPreview | null>(initialPreview);
  const [artistId, setArtistId] = useState(initialPreview?.candidateArtist?.id || canonicalArtistId || artists[0]?.id || "");
  const [releaseId, setReleaseId] = useState(initialPreview?.candidateRelease?.id || "");
  const [periodStart, setPeriodStart] = useState(initialPreview?.previewPeriod?.periodStart || "");
  const [periodEnd, setPeriodEnd] = useState(initialPreview?.previewPeriod?.periodEnd || "");
  const [mapping, setMapping] = useState<Record<number, MappingDecision>>({});
  const [warningAcks, setWarningAcks] = useState<Record<string, boolean>>({});
  const [filenameAck, setFilenameAck] = useState(false);
  const [streamsAck, setStreamsAck] = useState(false);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<{code: string; message: string} | null>(null);
  const [result, setResult] = useState<ImportDetailResult["import"] | null>(null);
  const warningCategories = useMemo(() => {
    if (!preview) return [];
    const issues = [...preview.fileWarnings, ...preview.rowPreview.flatMap((row) => row.warnings)];
    return Array.from(new Map(issues.filter((issue) => issue.code !== "UTF8_BOM_REMOVED" && issue.code !== "PERIOD_CONFIRMATION_REQUIRED").map((issue) => [issue.code || "WARNING", issue])).values());
  }, [preview]);
  const validSongRows = useMemo(
    () => preview?.detectedType === "SONGS_PERIOD" ? preview.rowPreview.filter((row) => row.outcome !== "REJECTED" && row.normalizedValues) : [],
    [preview]
  );

  function selectFile(next: File | null) {
    setError(null);
    setResult(null);
    if (!next) return setFile(null);
    const validation = validateSpotifyCsvFile(next);
    if (!validation.ok) {
      setFile(null);
      setError({code: validation.code, message: validation.message});
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(next);
  }

  async function createPreview(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError({code: "FILE_REQUIRED", message: "Choose one supported Spotify CSV export."});
    setBusy("preview"); setError(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (artistId) form.append("artist_profile_id", artistId);
      const response = await fetch("/api/analytics/imports/preview", {method: "POST", body: form});
      const logicalPreview = await response.clone().json().catch(() => null) as SpotifyImportPreview | null;
      const data = logicalPreview && typeof logicalPreview.code === "string" && Array.isArray(logicalPreview.rowPreview)
        ? logicalPreview
        : await readAdminApiResponse<SpotifyImportPreview>(response, "The Spotify CSV could not be previewed.");
      setPreview(data);
      setArtistId(data.candidateArtist?.id || artistId);
      setReleaseId(data.candidateRelease?.id || "");
      setPeriodStart(data.previewPeriod?.periodStart || "");
      setPeriodEnd(data.previewPeriod?.periodEnd || "");
      setMapping({}); setWarningAcks({}); setFilenameAck(false); setStreamsAck(false); setConfirmCommit(false);
      if (data.code !== "PREVIEW_READY") setError({code: data.code, message: data.message});
    } catch (caught) {
      const code = caught instanceof AdminRequestError ? caught.code : "UNKNOWN";
      setError({code, message: importErrorCopy(code, getAdminErrorMessage(caught, "The Spotify CSV could not be previewed."))});
    } finally { setBusy(null); }
  }

  const formErrors = useMemo(() => {
    if (!preview?.previewToken) return [];
    const errors: Array<{id: string; message: string}> = [];
    if (preview.detectedType !== "TRACK_STREAM_TIMELINE" && !artistId) errors.push({id: "import-artist", message: "Select the artist profile."});
    if (preview.detectedType === "TRACK_STREAM_TIMELINE" && !releaseId) errors.push({id: "import-release", message: "Select the release represented by this timeline."});
    if (preview.requiresPeriodConfirmation && (!periodStart || !periodEnd || periodStart > periodEnd)) errors.push({id: "period-start", message: "Enter a valid report start and end date."});
    if (preview.detectedType === "TRACK_STREAM_TIMELINE" && (!filenameAck || !streamsAck)) errors.push({id: "track-acknowledgements", message: "Accept both track-timeline acknowledgements."});
    if (warningCategories.some((warning) => !warningAcks[warning.code || "WARNING"])) errors.push({id: "warning-acknowledgements", message: "Acknowledge every material warning category."});
    if (validSongRows.some((row) => !mapping[row.originalRowNumber] || (mapping[row.originalRowNumber].mode === "mapped" ? !mapping[row.originalRowNumber].releaseId : !mapping[row.originalRowNumber].reason))) errors.push({id: "song-mappings", message: "Map or explicitly leave every valid song row unmatched."});
    if (!confirmCommit) errors.push({id: "commit-confirmation", message: "Confirm the final commit review."});
    return errors;
  }, [artistId, confirmCommit, filenameAck, mapping, periodEnd, periodStart, preview, releaseId, streamsAck, validSongRows, warningAcks, warningCategories]);

  async function commitImport() {
    if (!preview?.previewToken || formErrors.length) {
      document.getElementById(formErrors[0]?.id || "import-workflow")?.focus();
      return;
    }
    setBusy("commit"); setError(null);
    try {
      const commit = await adminFetch<{importId: string}>("/api/analytics/imports/commit", {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({
          previewToken: preview.previewToken,
          clientIdempotencyKey: crypto.randomUUID(),
          artistProfileId: artistId || null,
          releaseId: releaseId || null,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          acknowledgeWarnings: warningCategories.length ? warningCategories.every((warning) => warningAcks[warning.code || "WARNING"]) : false,
          acknowledgeFilenameNotIdentity: filenameAck,
          acknowledgeTrackStreamsNotRetention: streamsAck,
          songMappings: validSongRows.map((row) => ({originalRowNumber: row.originalRowNumber, releaseId: mapping[row.originalRowNumber]?.mode === "mapped" ? mapping[row.originalRowNumber].releaseId : null, leaveUnmatched: mapping[row.originalRowNumber]?.mode === "unmatched", unmatchedReason: mapping[row.originalRowNumber]?.reason || null, unmatchedNote: mapping[row.originalRowNumber]?.note || null}))
        })
      }, "The import could not be committed.");
      const detail = await adminFetch<ImportDetailResult>(`/api/analytics/imports/${encodeURIComponent(commit.importId)}`);
      setResult(detail.import); setPreview(null); setFile(null);
    } catch (caught) {
      const code = caught instanceof AdminRequestError ? caught.code : "UNKNOWN";
      setError({code, message: importErrorCopy(code, getAdminErrorMessage(caught, "The import could not be committed."))});
    } finally { setBusy(null); }
  }

  const artistName = artists.find((artist) => artist.id === artistId)?.displayName || "Not selected";
  const selectedRelease = releases.find((release) => release.id === releaseId);
  const rejectedRows = preview?.rowPreview.filter((row) => row.outcome === "REJECTED") || [];
  const warningRows = preview?.rowPreview.filter((row) => row.warnings.length > 0 && row.outcome !== "REJECTED") || [];
  const awaitingRows = preview?.detectedType === "SONGS_PERIOD" ? validSongRows.filter((row) => !mapping[row.originalRowNumber]) : [];
  const readyRows = preview?.rowPreview.filter((row) => row.outcome !== "REJECTED" && !row.warnings.length) || [];

  return (
    <section className="panel space-y-5 px-4 py-5 sm:px-6" id="import-workflow">
      <div><p className="field-label">Private analytics intake</p><h2 className="mt-2 text-2xl font-semibold text-ink">Upload and preview</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Accepted exports: Artist Audience Timeline, Track Stream Timeline, Songs Period, and Playlists Period. Raw CSV files remain private, are never publicly exposed, and expire after 30 days; normalized analytics records remain.</p></div>
      <form className="space-y-4" onSubmit={createPreview}>
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-edge-strong bg-input p-5 text-center transition motion-reduce:transition-none hover:bg-surface-hover focus-within:outline focus-within:outline-2 focus-within:outline-brand-primary" onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLLabelElement>) => {event.preventDefault(); selectFile(event.dataTransfer.files[0] || null);}}>
          <UploadCloud aria-hidden="true" className="text-brand-primary" size={28} />
          <span className="mt-3 font-semibold text-ink">Drop one Spotify CSV here or choose a file</span>
          <span className="mt-1 text-xs text-muted">CSV only · maximum 10 MiB</span>
          <input accept=".csv,text/csv" className="sr-only" id="spotify-csv" onChange={(event) => selectFile(event.target.files?.[0] || null)} ref={fileInputRef} type="file" />
        </label>
        {file ? <p aria-live="polite" className="text-sm text-secondary">Selected: <span className="font-semibold text-ink">{file.name}</span> ({formatBytes(file.size)})</p> : null}
        <button className="action-button-primary" disabled={!file || busy !== null} type="submit">{busy === "preview" ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> Uploading and parsing</> : <><FileSearch aria-hidden="true" size={16} /> Create private preview</>}</button>
      </form>

      {error ? <ErrorState title={error.code.replaceAll("_", " ")} message={error.message} /> : null}
      {result ? <div aria-live="polite" className="state-panel-success"><CheckCircle2 aria-hidden="true" size={18} /><div><p className="font-semibold">Import committed</p><p className="mt-1">Import <span className="font-mono">{result.id}</span> is {result.status.toLowerCase()}. Accepted {result.acceptedRowCount} rows, left {result.unmatchedRowCount} unmatched, recorded {result.warningCount} warning rows, and retained the raw file until {formatDateTime(result.rawFileExpiresAt)}.</p><p className="mt-1">Created {Object.values(result._count || {}).reduce((total, count) => total + count, 0)} normalized observation or snapshot records. Reconciliation recorded {result.validationSummary?.reconciliation?.entries?.length || 0} comparison result(s); open detail for differences, severity, availability, and comparison periods.</p><div className="mt-3 flex flex-wrap gap-2"><Link className="action-button-secondary text-xs" href={`/admin/retention-lab/imports/${result.id}`}>Open import detail</Link>{result.unmatchedRowCount > 0 ? <Link className="action-button-secondary text-xs" href={`/admin/retention-lab/mappings?import_id=${result.id}`}>Open mapping queue</Link> : null}</div></div></div> : null}

      {preview ? <div className="space-y-5 border-t border-edge pt-5">
        <div className="flex flex-wrap items-center gap-3"><StatusBadge value={preview.code} />{preview.duplicateFile ? <StatusBadge value="DUPLICATE FILE" /> : null}{preview.overlaps.length ? <StatusBadge value="OVERLAP WARNING" /> : null}<span className="text-sm text-muted">Preview expires {formatDateTime(preview.expiresAt)}</span></div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Export type", EXPORT_LABELS[preview.detectedType || ""] || preview.detectedType || "Not detected"], ["Performance label", preview.performanceLabel || "Not available"], ["Original filename", preview.originalFilename], ["Safe filename", preview.safeDisplayFilename !== preview.originalFilename ? preview.safeDisplayFilename : "Same as original"], ["File size", formatBytes(preview.fileSizeBytes)], ["SHA-256", preview.fileHash ? `${preview.fileHash.slice(0, 12)}…${preview.fileHash.slice(-8)}` : "Unavailable"], ["Parser", preview.parserVersion], ["Normalization", preview.normalizationVersion], ["Date range", preview.dateRange ? `${preview.dateRange.minimumDate} to ${preview.dateRange.maximumDate}` : preview.previewPeriod ? `${preview.previewPeriod.periodStart} to ${preview.previewPeriod.periodEnd}` : "Needs confirmation"], ["Rows", String(preview.rowPreview.length)], ["Accepted", String(preview.counts.accepted)], ["Warnings", String(preview.counts.warnings)], ["Rejected", String(preview.counts.rejected)], ["Unmatched", String(preview.counts.unmatched)], ["Missing dates", String(preview.dateRange?.missingDates?.length || 0)]
          ].map(([label, value]) => <div className="rounded-lg border border-edge bg-input p-3" key={label}><dt className="field-label">{label}</dt><dd className="mt-2 break-words text-sm font-semibold text-ink">{value}</dd></div>)}
        </dl>
        {preview.overlaps.map((overlap, index) => <div className="state-panel-warning" key={`${overlap.importId}-${index}`}><AlertTriangle aria-hidden="true" size={18} /><p><strong>{overlap.classification.replaceAll("_", " ")} overlap:</strong> {overlap.message}{overlap.importId ? <> <Link className="underline" href={`/admin/retention-lab/imports/${overlap.importId}`}>Open import</Link>.</> : null}</p></div>)}

        <div><h3 className="text-lg font-semibold text-ink">Required context</h3><div className="mt-3 grid gap-4 lg:grid-cols-2">
          {preview.detectedType !== "TRACK_STREAM_TIMELINE" ? <label className="field-shell" id="import-artist"><span className="field-label">Artist profile</span><select className="field-input" onChange={(event) => setArtistId(event.target.value)} value={artistId}>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.displayName} ({artist.slug})</option>)}</select><span className="field-help">Selected artist: {artistName}</span></label> : null}
          {preview.detectedType === "TRACK_STREAM_TIMELINE" ? <div className="field-shell" id="import-release"><label className="field-label">Release identity</label><ReleasePicker ariaLabel="Select release for track timeline" emptyOption={{label: "Select release", value: ""}} onValueChange={setReleaseId} releases={releases} value={releaseId} /><p className="field-help">The filename is context only; it is not authoritative identity.</p></div> : null}
          {preview.requiresPeriodConfirmation ? <><label className="field-shell"><span className="field-label">Report start date</span><input className="field-input" id="period-start" onChange={(event) => setPeriodStart(event.target.value)} type="date" value={periodStart} /></label><label className="field-shell"><span className="field-label">Report end date</span><input className="field-input" id="period-end" onChange={(event) => setPeriodEnd(event.target.value)} type="date" value={periodEnd} /></label></> : null}
        </div></div>

        {preview.detectedType === "TRACK_STREAM_TIMELINE" ? <fieldset className="rounded-xl border border-edge bg-input p-4" id="track-acknowledgements"><legend className="px-1 font-semibold text-ink">Track timeline acknowledgements</legend><label className="mt-2 flex gap-3 text-sm text-secondary"><input checked={filenameAck} onChange={(event) => setFilenameAck(event.target.checked)} type="checkbox" /><span>The filename is not authoritative track or release identity.</span></label><label className="mt-3 flex gap-3 text-sm text-secondary"><input checked={streamsAck} onChange={(event) => setStreamsAck(event.target.checked)} type="checkbox" /><span>Track streams measure stream performance, not listener retention.</span></label></fieldset> : null}

        <div><h3 className="text-lg font-semibold text-ink">Validation summary</h3><div className="mt-3 grid gap-3 lg:grid-cols-2"><ValidationGroup rows={readyRows} title="Ready" tone="bg-emerald-400" /><ValidationGroup rows={warningRows} title="Warnings" tone="bg-amber-400" /><ValidationGroup rows={awaitingRows} title="Awaiting Mapping" tone="bg-sky-400" /><ValidationGroup issues={preview.blockingErrors} rows={rejectedRows} title="Rejected" tone="bg-red-400" /></div></div>

        {warningCategories.length ? <fieldset className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" id="warning-acknowledgements"><legend className="px-1 font-semibold text-ink">Material warning acknowledgements</legend>{warningCategories.map((warning) => {const code = warning.code || "WARNING"; return <label className="mt-3 flex gap-3 text-sm text-secondary" key={code}><input checked={Boolean(warningAcks[code])} onChange={(event) => setWarningAcks((current) => ({...current, [code]: event.target.checked}))} type="checkbox" /><span><strong className="font-mono text-xs text-ink">{code}</strong>: {warning.message || "I reviewed this warning category."}</span></label>;})}</fieldset> : null}

        {preview.detectedType === "SONGS_PERIOD" ? <div id="song-mappings" tabIndex={-1}><h3 className="text-lg font-semibold text-ink">Song row mapping</h3><p className="mt-1 text-sm text-muted">Unmatched is valid data awaiting catalog identity; it is not a rejected row. Suggestions remain unconfirmed until you choose them.</p><div className="mt-3 space-y-3">{validSongRows.map((row) => {const decision = mapping[row.originalRowNumber]; const suggestion = row.mappingSuggestion; return <article className="rounded-xl border border-edge bg-input p-4" key={row.originalRowNumber}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink">{safeRowTitle(row)}</p><p className="mt-1 text-xs text-muted">Source row {row.originalRowNumber} · {rowDate(row)}</p></div><StatusBadge value={decision ? decision.mode === "mapped" ? "CONFIRMED FOR COMMIT" : "UNMATCHED" : suggestion?.confidence || "NO MATCH"} /></div>{suggestion ? <div className="mt-3 rounded-lg border border-edge bg-surface-elevated p-3 text-sm"><p><strong>Suggestion:</strong> {suggestion.candidateRelease?.title || "No single candidate"}</p><p className="mt-1 text-muted">Method {suggestion.matchMethod.replaceAll("_", " ")} · confidence {suggestion.confidence.replaceAll("_", " ")}{suggestion.existingAliasId ? " · existing confirmed alias" : ""}</p>{suggestion.competingCandidates.length ? <p className="mt-1 text-muted">Competing: {suggestion.competingCandidates.map((candidate) => candidate.title).join(", ")}</p> : null}{suggestion.candidateRelease ? <button className="action-button-secondary mt-3 text-xs" onClick={() => setMapping((current) => ({...current, [row.originalRowNumber]: {mode: "mapped", releaseId: suggestion.candidateRelease!.id, reason: "", note: ""}}))} type="button">Use suggestion</button> : null}</div> : null}<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"><ReleasePicker ariaLabel={`Select release for source row ${row.originalRowNumber}`} emptyOption={{label: "Select a release", value: ""}} onValueChange={(value) => setMapping((current) => ({...current, [row.originalRowNumber]: {mode: "mapped", releaseId: value, reason: "", note: ""}}))} releases={releases.filter((release) => !artistId || !release.artistProfileId || release.artistProfileId === artistId)} value={decision?.mode === "mapped" ? decision.releaseId : ""} /><button className="action-button-secondary" onClick={() => setMapping((current) => ({...current, [row.originalRowNumber]: {mode: "unmatched", releaseId: "", reason: "", note: ""}}))} type="button">Leave unmatched</button></div>{decision?.mode === "unmatched" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="field-shell"><span className="field-label">Unmatched reason</span><select className="field-input" onChange={(event) => setMapping((current) => ({...current, [row.originalRowNumber]: {...decision, reason: event.target.value}}))} value={decision.reason}><option value="">Select reason</option>{UNMATCHED_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-shell"><span className="field-label">Optional note</span><input className="field-input" maxLength={500} onChange={(event) => setMapping((current) => ({...current, [row.originalRowNumber]: {...decision, note: event.target.value}}))} value={decision.note} /></label></div> : null}</article>;})}</div></div> : null}

        {formErrors.length ? <div aria-labelledby="commit-errors-title" className="state-panel-danger" role="alert"><AlertTriangle aria-hidden="true" size={18} /><div><p className="font-semibold" id="commit-errors-title">Complete the review before committing</p><ul className="mt-2 list-disc space-y-1 pl-5">{formErrors.map((item) => <li key={item.id}><a className="underline" href={`#${item.id}`}>{item.message}</a></li>)}</ul></div></div> : null}
        <div className="rounded-xl border border-edge bg-surface-elevated p-4"><h3 className="font-semibold text-ink">Final commit review</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted">Export</dt><dd className="font-semibold text-ink">{EXPORT_LABELS[preview.detectedType || ""]}</dd></div><div><dt className="text-muted">Artist / release</dt><dd className="font-semibold text-ink">{preview.detectedType === "TRACK_STREAM_TIMELINE" ? selectedRelease?.title || "Not selected" : artistName}</dd></div><div><dt className="text-muted">Report period</dt><dd className="font-semibold text-ink">{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : preview.dateRange ? `${preview.dateRange.minimumDate} to ${preview.dateRange.maximumDate}` : "Not confirmed"}</dd></div><div><dt className="text-muted">Rows</dt><dd className="font-semibold text-ink">{preview.counts.accepted} accepted · {Object.values(mapping).filter((item) => item.mode === "unmatched").length} left unmatched · {preview.counts.rejected} rejected</dd></div><div><dt className="text-muted">Duplicate / overlap</dt><dd className="font-semibold text-ink">{preview.duplicateFile ? "Duplicate" : "No duplicate"} · {preview.overlaps.length ? `${preview.overlaps.length} overlap(s)` : "No overlap"}</dd></div><div><dt className="text-muted">Raw retention</dt><dd className="font-semibold text-ink">30 days after acceptance</dd></div></dl><label className="mt-4 flex gap-3 text-sm text-secondary" id="commit-confirmation"><input checked={confirmCommit} onChange={(event) => setConfirmCommit(event.target.checked)} type="checkbox" /><span>I confirm this context, these mapping decisions, and this commit. Normalized analytics data is permanent even after the private raw file expires.</span></label><button className="action-button-primary mt-4" disabled={!preview.previewToken || formErrors.length > 0 || busy !== null} onClick={commitImport} type="button">{busy === "commit" ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> Committing transaction</> : "Commit import"}</button></div>
      </div> : null}
    </section>
  );
}

export function ImportHistory({initial, artists, onReprocess}: {initial: {page: number; pageSize: number; total: number; items: ImportListItem[]}; artists: ArtistOption[]; onReprocess: (preview: SpotifyImportPreview) => void}) {
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState({status: "", type: "", artist: "", uploaded: "", withdrawn: ""});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ImportListItem | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  async function load(page = 1) {
    setBusy(true); setError(null);
    try {
      const query = new URLSearchParams({page: String(page), page_size: "25"});
      if (filters.status) query.set("status", filters.status);
      if (filters.type) query.set("import_type", filters.type);
      if (filters.artist) query.set("artist_profile_id", filters.artist);
      if (filters.uploaded) query.set("uploaded_from", `${filters.uploaded}T00:00:00.000Z`);
      if (filters.withdrawn) query.set("withdrawn", filters.withdrawn);
      setData(await adminFetch<typeof data>(`/api/analytics/imports?${query}`));
    } catch (caught) { setError(getAdminErrorMessage(caught, "Import history could not be loaded.")); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!withdrawTarget || !withdrawReason.trim()) return;
    setBusy(true); setError(null);
    try {
      await adminFetch(`/api/analytics/imports/${withdrawTarget.id}/withdraw`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({reason: withdrawReason})});
      setWithdrawTarget(null); setWithdrawReason(""); await load(data.page);
    } catch (caught) { setError(getAdminErrorMessage(caught, "The import could not be withdrawn.")); }
    finally { setBusy(false); }
  }
  async function reprocess(item: ImportListItem) {
    setBusy(true); setError(null);
    try { const preview = await adminFetch<SpotifyImportPreview>(`/api/analytics/imports/${item.id}/reprocess`, {method: "POST"}); onReprocess(preview); document.getElementById("import-workflow")?.scrollIntoView({behavior: "smooth"}); }
    catch (caught) { const code = caught instanceof AdminRequestError ? caught.code : "UNKNOWN"; setError(importErrorCopy(code, getAdminErrorMessage(caught, "This import could not be reprocessed."))); }
    finally { setBusy(false); }
  }
  return <section className="panel space-y-4 px-4 py-5 sm:px-6"><div><p className="field-label">Audit trail</p><h2 className="mt-2 text-2xl font-semibold text-ink">Import history</h2></div><form className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" onSubmit={(event) => {event.preventDefault(); void load(1);}}><label className="field-shell"><span className="field-label">Status</span><select className="field-input" onChange={(event) => setFilters({...filters, status: event.target.value})} value={filters.status}><option value="">All</option><option>IMPORTED</option><option>WITHDRAWN</option><option>REPLACED</option><option>FAILED</option></select></label><label className="field-shell"><span className="field-label">Import type</span><select className="field-input" onChange={(event) => setFilters({...filters, type: event.target.value})} value={filters.type}><option value="">All</option>{Object.entries(EXPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-shell"><span className="field-label">Artist</span><select className="field-input" onChange={(event) => setFilters({...filters, artist: event.target.value})} value={filters.artist}><option value="">All</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.displayName}</option>)}</select></label><label className="field-shell"><span className="field-label">Uploaded from</span><input className="field-input" onChange={(event) => setFilters({...filters, uploaded: event.target.value})} type="date" value={filters.uploaded} /></label><label className="field-shell"><span className="field-label">Withdrawn</span><select className="field-input" onChange={(event) => setFilters({...filters, withdrawn: event.target.value})} value={filters.withdrawn}><option value="">Either</option><option value="false">Active / not withdrawn</option><option value="true">Withdrawn</option></select></label><button className="action-button-secondary md:col-span-3 xl:col-span-1" disabled={busy} type="submit">Apply filters</button></form>{error ? <ErrorState message={error} /> : null}{busy ? <p aria-live="polite" className="text-sm text-muted"><LoaderCircle aria-hidden="true" className="mr-2 inline animate-spin" size={15} />Loading import history</p> : null}{!data.items.length ? <EmptyState title={data.total ? "No imports match these filters" : "No Spotify imports yet"} description="Create a preview above to begin the protected import workflow." /> : <><div className="table-surface mobile-scroll-x"><table className="min-w-[1180px] w-full text-left text-sm"><thead><tr>{["Filename", "Type / artist", "Uploaded", "Status", "Rows", "Raw file", "Replacement", "Actions"].map((label) => <th className="px-3 py-3 field-label" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.items.map((item) => <tr className="border-t border-edge" key={item.id}><td className="px-3 py-3"><p className="max-w-56 truncate font-semibold text-ink">{item.originalFilename}</p><p className="mt-1 font-mono text-[10px] text-muted">{item.id}</p></td><td className="px-3 py-3 text-secondary">{EXPORT_LABELS[item.importType] || item.importType}<br />{artists.find((artist) => artist.id === item.artistProfileId)?.displayName || item.artistProfileId}</td><td className="px-3 py-3 text-secondary">{item.uploadedByUsername}<br />{formatDateTime(item.uploadedAt)}</td><td className="px-3 py-3"><StatusBadge value={item.status} /></td><td className="px-3 py-3 text-secondary">{item.acceptedRowCount} accepted<br />{item.warningCount} warning · {item.unmatchedRowCount} unmatched · {item.rejectedRowCount} rejected</td><td className="px-3 py-3"><StatusBadge value={item.rawFileAvailability} /><p className="mt-1 text-xs text-muted">until {formatDateTime(item.rawFileExpiresAt)}</p></td><td className="px-3 py-3 text-secondary">{item.replacedByImportId ? `Replaced by ${item.replacedByImportId}` : "Current / none"}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><Link className="action-button-secondary text-xs" href={`/admin/retention-lab/imports/${item.id}`}>View</Link><button className="action-button-secondary text-xs" disabled={busy || item.rawFileAvailability !== "AVAILABLE"} onClick={() => void reprocess(item)} type="button">Reprocess</button><button className="action-button-danger text-xs" disabled={busy || item.status !== "IMPORTED"} onClick={() => setWithdrawTarget(item)} type="button">Withdraw</button></div></td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3"><button className="action-button-secondary text-xs" disabled={data.page <= 1 || busy} onClick={() => void load(data.page - 1)} type="button">Previous</button><p className="text-xs text-muted">Page {data.page} · {data.total} imports</p><button className="action-button-secondary text-xs" disabled={data.page * data.pageSize >= data.total || busy} onClick={() => void load(data.page + 1)} type="button">Next</button></div></>}
    {data.items.length ? <details className="rounded-xl border border-edge bg-input p-4"><summary className="cursor-pointer font-semibold text-ink">Coverage dates for this history page</summary><div className="mt-3 table-surface mobile-scroll-x"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="px-3 py-3 field-label" scope="col">Filename</th><th className="px-3 py-3 field-label" scope="col">Date range or confirmed report period</th><th className="px-3 py-3 field-label" scope="col">Period provenance</th></tr></thead><tbody>{data.items.map((item) => <tr className="border-t border-edge" key={`coverage-${item.id}`}><td className="px-3 py-3 text-ink">{item.originalFilename}</td><td className="px-3 py-3 text-secondary">{item.userConfirmedPeriodStart && item.userConfirmedPeriodEnd ? `${item.userConfirmedPeriodStart} to ${item.userConfirmedPeriodEnd}` : item.detectedPeriodStart && item.detectedPeriodEnd ? `${item.detectedPeriodStart} to ${item.detectedPeriodEnd}` : "No confirmed period"}</td><td className="px-3 py-3 text-secondary">{item.userConfirmedPeriodStart ? "User-confirmed report period" : item.detectedPeriodStart ? "Detected timeline range" : "Unavailable"}</td></tr>)}</tbody></table></div></details> : null}
    <AdminConfirmDialog description="Normalized records remain preserved, but this import will be excluded from current analytics. This does not delete the import or its history." onClose={() => setWithdrawTarget(null)} open={Boolean(withdrawTarget)} title="Withdraw analytics import"><label className="field-shell"><span className="field-label">Withdrawal reason</span><textarea className="field-input min-h-28" maxLength={500} onChange={(event) => setWithdrawReason(event.target.value)} required value={withdrawReason} /></label>{withdrawTarget?.replacedByImportId ? <p className="mt-3 text-sm text-amber-200">This import already has replacement context. Review both records after withdrawal.</p> : null}<label className="mt-4 flex gap-3 text-sm text-secondary"><input checked={Boolean(withdrawReason.trim())} readOnly type="checkbox" /><span>I understand this excludes the import from current analytics while preserving normalized history.</span></label><div className="mt-5 flex justify-end gap-2"><button className="action-button-secondary" onClick={() => setWithdrawTarget(null)} type="button">Cancel</button><button className="action-button-danger" disabled={!withdrawReason.trim() || busy} onClick={() => void withdraw()} type="button">Confirm withdrawal</button></div></AdminConfirmDialog>
  </section>;
}

export function RetentionImportCenter(props: {artists: ArtistOption[]; releases: RetentionReleaseOption[]; canonicalArtistId: string | null; imports: {page: number; pageSize: number; total: number; items: ImportListItem[]}}) {
  const [reprocessPreview, setReprocessPreview] = useState<SpotifyImportPreview | null>(null);
  return <div className="space-y-6"><SpotifyImportWorkflow artists={props.artists} canonicalArtistId={props.canonicalArtistId} initialPreview={reprocessPreview} key={reprocessPreview?.previewId || reprocessPreview?.expiresAt || "upload"} releases={props.releases} /><ImportHistory artists={props.artists} initial={props.imports} onReprocess={setReprocessPreview} /></div>;
}
