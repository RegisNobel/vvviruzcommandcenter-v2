import Link from "next/link";
import {BookOpen, Inbox, Plus} from "lucide-react";

import {
  listAdminBreakingBarz,
  parseBreakingBarzArtistNames
} from "@/lib/repositories/breaking-barz";
import {ErrorState} from "@/components/ui-state";
import {
  publishBreakingBarzSubmissionAction,
  rejectBreakingBarzSubmissionAction,
  saveBreakingBarzEntryAction
} from "./actions";

export const dynamic = "force-dynamic";

const inputClass = "field-input mt-2";
const panelClass = "command-surface space-y-5 p-5 sm:p-6";

type Category = {id: string; name: string; slug: string};

function submissionSongLinkDefaults(url: string) {
  const normalized = url.trim();
  if (!normalized) return {};
  if (/open\.spotify\.com/i.test(normalized)) return {spotifyUrl: normalized};
  if (/music\.apple\.com/i.test(normalized)) return {appleMusicUrl: normalized};
  if (/(?:youtube\.com|youtu\.be)/i.test(normalized)) return {youtubeUrl: normalized};
  return {sources: `Song link | ${normalized}`};
}

function CategoryFields({categories, selected = []}: {categories: Category[]; selected?: string[]}) {
  return (
    <fieldset>
      <legend className="field-label">Types</legend>
      <div className="mt-3 flex flex-wrap gap-3">
        {categories.map((category) => (
          <label className="flex items-center gap-2 text-sm text-ink" key={category.id}>
            <input defaultChecked={selected.includes(category.slug)} name="categorySlugs" type="checkbox" value={category.slug} />
            {category.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EntryFields({
  categories,
  defaults
}: {
  categories: Category[];
  defaults?: {
    id?: string;
    songTitle?: string;
    artistNames?: string;
    lyricExcerpt?: string;
    summary?: string;
    breakdown?: string;
    verificationStatus?: string;
    verificationNote?: string;
    spotifyUrl?: string;
    appleMusicUrl?: string;
    youtubeUrl?: string;
    sources?: string;
    categories?: string[];
  };
}) {
  return (
    <>
      {defaults?.id ? <input name="id" type="hidden" value={defaults.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Song title<input className={inputClass} defaultValue={defaults?.songTitle} name="songTitle" required /></label>
        <label className="field-label">Artists<input className={inputClass} defaultValue={defaults?.artistNames} name="artistNames" placeholder="Artist, Featured Artist" required /></label>
      </div>
      <label className="field-label">Lines<textarea className={`${inputClass} min-h-28`} defaultValue={defaults?.lyricExcerpt} maxLength={600} name="lyricExcerpt" required /></label>
      <label className="field-label">Summary<textarea className={`${inputClass} min-h-24`} defaultValue={defaults?.summary} maxLength={300} name="summary" required /></label>
      <label className="field-label">Full breakdown<textarea className={`${inputClass} min-h-40`} defaultValue={defaults?.breakdown} maxLength={8000} name="breakdown" required /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Verification
          <select className={inputClass} defaultValue={defaults?.verificationStatus || "interpretation"} name="verificationStatus">
            <option value="interpretation">Interpretation</option>
            <option value="verified_breakdown">Verified breakdown</option>
            <option value="artist_breakdown">Artist breakdown</option>
          </select>
        </label>
        <label className="field-label">Private verification note<input className={inputClass} defaultValue={defaults?.verificationNote} name="verificationNote" /></label>
      </div>
      <CategoryFields categories={categories} selected={defaults?.categories} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field-label">Spotify URL<input className={inputClass} defaultValue={defaults?.spotifyUrl} name="spotifyUrl" type="url" /></label>
        <label className="field-label">Apple Music URL<input className={inputClass} defaultValue={defaults?.appleMusicUrl} name="appleMusicUrl" type="url" /></label>
        <label className="field-label">YouTube URL<input className={inputClass} defaultValue={defaults?.youtubeUrl} name="youtubeUrl" type="url" /></label>
      </div>
      <label className="field-label">Sources<textarea className={`${inputClass} min-h-20`} defaultValue={defaults?.sources} name="sources" placeholder="Interview | https://..." /></label>
    </>
  );
}

export default async function AdminBreakingBarzPage({searchParams}: {searchParams: Promise<{message?: string; error?: string}>}) {
  const [{message, error}, data] = await Promise.all([searchParams, listAdminBreakingBarz()]);
  const pending = data.submissions.filter((item) => item.status === "pending");
  const reviewed = data.submissions.filter((item) => item.status !== "pending");
  const externalEntries = data.entries.filter((item) => !item.releaseAnnotationId);
  const linkedEntries = data.entries.filter((item) => item.releaseAnnotationId);

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="command-surface px-5 py-6 sm:px-7">
        <div className="pill"><BookOpen size={12} /> Discovery</div>
        <h1 className="mt-4 text-4xl font-semibold text-ink">Breaking Barz</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Publish your lyric breakdowns, review fan suggestions, and see release annotations that flow into the public feed.</p>
      </header>
      {message ? <div className="state-panel-success" role="status">{message}</div> : null}
      {error ? <ErrorState title="Breaking Barz was not changed" message={error} /> : null}

      <section className={panelClass}>
        <div className="flex items-center gap-3"><Plus size={18} /><h2 className="text-2xl font-semibold text-ink">Add a breakdown from any song</h2></div>
        <form action={saveBreakingBarzEntryAction} className="space-y-5">
          <EntryFields categories={data.categories} />
          <div className="flex gap-3">
            <button className="action-button-secondary" name="action" type="submit" value="draft">Save draft</button>
            <button className="action-button-primary" name="action" type="submit" value="publish">Publish</button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3"><Inbox size={18} /><h2 className="text-2xl font-semibold text-ink">Fan suggestions ({pending.length})</h2></div>
        {pending.length ? pending.map((submission) => (
          <article className={panelClass} key={submission.id}>
            <div><h3 className="text-xl font-semibold text-ink">{submission.songTitle}</h3><p className="mt-1 text-sm text-muted">{parseBreakingBarzArtistNames(submission.artistNames).join(" · ")}</p></div>
            <form action={publishBreakingBarzSubmissionAction} className="space-y-5">
              <input name="submissionId" type="hidden" value={submission.id} />
              <EntryFields categories={data.categories} defaults={{songTitle: submission.songTitle, artistNames: parseBreakingBarzArtistNames(submission.artistNames).join(", "), lyricExcerpt: submission.lyricExcerpt, summary: submission.summary, breakdown: submission.breakdown, ...submissionSongLinkDefaults(submission.songUrl)}} />
              <label className="field-label">Private review note<input className={inputClass} name="reviewNote" /></label>
              <div className="flex flex-wrap gap-3">
                <button className="action-button-primary" name="action" type="submit" value="publish">Approve and publish</button>
                <button className="action-button-danger" formAction={rejectBreakingBarzSubmissionAction} formNoValidate type="submit">Reject</button>
              </div>
            </form>
          </article>
        )) : <div className={panelClass}><p className="text-sm text-muted">No pending suggestions.</p></div>}
      </section>

      {reviewed.length ? (
        <section className={panelClass}>
          <h2 className="text-2xl font-semibold text-ink">Reviewed suggestions ({reviewed.length})</h2>
          <div className="divide-y divide-edge">
            {reviewed.map((submission) => (
              <div className="py-4" key={submission.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{submission.songTitle}</p>
                  <span className="pill">{submission.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{parseBreakingBarzArtistNames(submission.artistNames).join(" · ")}</p>
                {submission.reviewNote ? <p className="mt-2 text-sm text-muted">{submission.reviewNote}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-ink">Standalone entries ({externalEntries.length})</h2>
        {externalEntries.map((entry) => {
          const latest = entry.versions[0];
          return latest ? (
            <details className={panelClass} key={entry.id}>
              <summary className="cursor-pointer font-semibold text-ink">{entry.songTitle} <span className="ml-2 text-xs uppercase text-muted">{entry.status}</span></summary>
              <form action={saveBreakingBarzEntryAction} className="space-y-5 pt-4">
                <EntryFields categories={data.categories} defaults={{id: entry.id, songTitle: latest.songTitle, artistNames: parseBreakingBarzArtistNames(latest.artistNames).join(", "), lyricExcerpt: latest.lyricExcerpt, summary: latest.summary, breakdown: latest.breakdown, verificationStatus: latest.verificationStatus, verificationNote: latest.verificationNote, spotifyUrl: latest.spotifyUrl, appleMusicUrl: latest.appleMusicUrl, youtubeUrl: latest.youtubeUrl, sources: latest.sources.map((source) => `${source.label} | ${source.url}`).join("\n"), categories: parseBreakingBarzArtistNames(latest.categorySlugs)}} />
                <div className="flex flex-wrap gap-3">
                  <button className="action-button-secondary" name="action" type="submit" value="draft">Save revision</button>
                  <button className="action-button-primary" name="action" type="submit" value="publish">Publish revision</button>
                  <button className="action-button-danger" name="action" type="submit" value="withdraw">Withdraw</button>
                </div>
              </form>
            </details>
          ) : null;
        })}
      </section>

      <section className={panelClass}>
        <h2 className="text-2xl font-semibold text-ink">Release-linked entries ({linkedEntries.length})</h2>
        <div className="divide-y divide-edge">
          {linkedEntries.map((entry) => (
            <div className="flex items-center justify-between gap-4 py-4" key={entry.id}>
              <div><p className="font-semibold text-ink">{entry.songTitle}</p><p className="mt-1 text-xs uppercase text-muted">{entry.status}</p></div>
              {entry.release ? <Link className="action-button-secondary" href={`/admin/releases/${entry.releaseId}`}>Edit release annotation</Link> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
