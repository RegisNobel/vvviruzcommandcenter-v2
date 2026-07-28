"use client";

import {useEffect, useMemo, useState} from "react";
import {Archive, BookOpen, Plus, Save, Send, X} from "lucide-react";

import {parseCanonicalLyrics} from "@/lib/lyrics";
import type {ReleaseAnnotationRecord} from "@/lib/types";

const inputClass = "field-input mt-2";

const TYPE_OPTIONS = [
  ["punchline", "Punchline"],
  ["double_meaning", "Double Meaning"],
  ["metaphor_wordplay", "Metaphor / Wordplay"],
  ["anime_reference", "Anime Reference"],
  ["game_reference", "Game Reference"],
  ["character_lore", "Character Lore"],
  ["language_translation", "Language / Translation"],
  ["personal_context", "Personal Context"],
  ["production_detail", "Production Detail"],
  ["sample", "Sample"],
  ["collaborator_note", "Collaborator Note"]
] as const;

const CONFIDENCE_OPTIONS = [
  ["verified", "Verified"],
  ["official_context", "Artist Commentary"],
  ["interpretive", "Interpretation"],
  ["needs_review", "Needs Review"]
] as const;

function emptyForm() {
  return {
    id: "",
    type: "double_meaning",
    title: "",
    summary: "",
    explanation: "",
    confidence: "official_context",
    sectionId: "",
    startLineIndex: 0,
    endLineIndex: 0,
    sources: [{label: "", url: ""}]
  };
}

type AnnotationForm = ReturnType<typeof emptyForm>;

function statusLabel(annotation: ReleaseAnnotationRecord) {
  if (annotation.status === "needs_reanchoring") return "Needs re-anchoring";
  if (annotation.status === "ready" && annotation.is_public) return "Public";
  if (annotation.status === "ready") return "Saved / private";
  if (annotation.status === "archived") return "Archived";
  return "Draft";
}

export function ReleaseAnnotationsEditor({
  releaseId,
  lyrics,
  initialAnnotations
}: {
  releaseId: string;
  lyrics: string;
  initialAnnotations: ReleaseAnnotationRecord[];
}) {
  const document = useMemo(() => parseCanonicalLyrics(lyrics), [lyrics]);
  const sections = document.sections.filter((section) => section.lines.length > 0);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [form, setForm] = useState<AnnotationForm>(() => {
    const next = emptyForm();
    const first = sections[0];
    if (first) next.sectionId = `${first.key}:${first.occurrence}`;
    return next;
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedSection = sections.find(
    (section) => `${section.key}:${section.occurrence}` === form.sectionId
  ) ?? sections[0];
  const safeEnd = selectedSection
    ? Math.min(Math.max(form.endLineIndex, form.startLineIndex), selectedSection.lines.length - 1)
    : 0;
  const excerpt = selectedSection
    ? selectedSection.lines
        .slice(form.startLineIndex, safeEnd + 1)
        .map((line) => line.text)
        .join("\n")
    : "";
  const brokenCount = annotations.filter(
    (annotation) => annotation.status === "needs_reanchoring"
  ).length;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/releases/${releaseId}/annotations`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          annotations?: ReleaseAnnotationRecord[];
        };
        if (!cancelled && response.ok && payload.annotations) {
          setAnnotations(payload.annotations);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [lyrics, releaseId]);

  function reset() {
    const next = emptyForm();
    const first = sections[0];
    if (first) next.sectionId = `${first.key}:${first.occurrence}`;
    setForm(next);
    setMessage("");
  }

  function edit(annotation: ReleaseAnnotationRecord) {
    setForm({
      id: annotation.id,
      type: annotation.type,
      title: annotation.title,
      summary: annotation.summary,
      explanation: annotation.explanation,
      confidence: annotation.confidence,
      sectionId: `${annotation.section_key}:${annotation.section_occurrence}`,
      startLineIndex: annotation.start_line_index,
      endLineIndex: annotation.end_line_index,
      sources: annotation.sources.length ? annotation.sources : [{label: "", url: ""}]
    });
    setMessage(
      annotation.status === "needs_reanchoring"
        ? "Choose the correct current lyric range. Save repairs the anchor privately; Publish remains a separate action."
        : "Editing annotation. Publishing remains an explicit action."
    );
  }

  async function submit(action: "draft" | "publish" | "archive") {
    if (action === "archive" && !form.id) return;
    if (action === "archive" && !window.confirm("Archive this annotation? It will stop appearing publicly and release its lyric range.")) return;
    if (!selectedSection && action !== "archive") {
      setMessage("Add lyrics before creating an annotation.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/releases/${releaseId}/annotations`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          id: form.id || undefined,
          type: form.type,
          title: form.title,
          summary: form.summary,
          explanation: form.explanation,
          confidence: form.confidence,
          sectionKey: selectedSection?.key ?? "root",
          sectionOccurrence: selectedSection?.occurrence ?? 0,
          startLineIndex: form.startLineIndex,
          endLineIndex: safeEnd,
          action,
          sources: form.sources
        })
      });
      const payload = (await response.json()) as {
        annotations?: ReleaseAnnotationRecord[];
        message?: string;
      };
      if (!response.ok || !payload.annotations) throw new Error(payload.message || "Annotation could not be saved.");
      setAnnotations(payload.annotations);
      reset();
      setMessage(
        action === "publish"
          ? "Breaking Barz annotation published."
          : action === "archive"
            ? "Annotation archived."
            : "Annotation saved privately."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Annotation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="command-surface scroll-mt-36 space-y-5 p-5 sm:p-6" id="release-annotations">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Release Annotations</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Breaking Barz</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Select consecutive lyric lines, explain the bar, then explicitly publish it. Lyric edits automatically hide any annotation that can no longer be anchored safely.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-status-info/40 bg-[var(--status-info-soft)] px-3 py-1 text-xs font-semibold text-status-info">{annotations.filter((item) => item.status !== "archived").length} active</span>
          {brokenCount ? <span className="rounded-full border border-status-warning/40 bg-[var(--status-warning-soft)] px-3 py-1 text-xs font-semibold text-status-warning">{brokenCount} need re-anchoring</span> : null}
        </div>
      </div>

      {annotations.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {annotations.map((annotation) => (
            <button
              className="rounded-xl border border-edge bg-surface-elevated p-4 text-left transition hover:border-brand-primary/50"
              key={annotation.id}
              onClick={() => edit(annotation)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-ink">{annotation.title}</p><p className="mt-1 text-xs text-muted">{annotation.lyric_excerpt || "Anchor required"}</p></div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${annotation.status === "needs_reanchoring" ? "border-status-warning/40 bg-[var(--status-warning-soft)] text-status-warning" : annotation.is_public ? "border-status-success/40 bg-[var(--status-success-soft)] text-status-success" : "border-status-info/40 bg-[var(--status-info-soft)] text-status-info"}`}>{statusLabel(annotation)}</span>
              </div>
              {annotation.anchor_error ? <p className="mt-3 text-xs text-amber-300">{annotation.anchor_error}</p> : null}
            </button>
          ))}
        </div>
      ) : null}

      {!sections.length ? (
        <div className="rounded-xl border border-dashed border-edge p-5 text-sm text-muted">Add and save lyrics before creating Breaking Barz annotations.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">Section
              <select className={inputClass} value={form.sectionId} onChange={(event) => setForm((current) => ({...current, sectionId: event.target.value, startLineIndex: 0, endLineIndex: 0}))}>
                {sections.map((section) => <option key={`${section.key}:${section.occurrence}`} value={`${section.key}:${section.occurrence}`}>{section.heading || "Opening lines"}{section.occurrence ? ` (${section.occurrence + 1})` : ""}</option>)}
              </select>
            </label>
            <label>Start line
              <select className={inputClass} value={form.startLineIndex} onChange={(event) => {const value=Number(event.target.value);setForm((current)=>({...current,startLineIndex:value,endLineIndex:Math.max(current.endLineIndex,value)}));}}>
                {selectedSection?.lines.map((line) => <option key={line.lineIndex} value={line.lineIndex}>{line.lineIndex + 1}. {line.text}</option>)}
              </select>
            </label>
            <label>End line
              <select className={inputClass} value={safeEnd} onChange={(event) => setForm((current) => ({...current, endLineIndex: Number(event.target.value)}))}>
                {selectedSection?.lines.filter((line) => line.lineIndex >= form.startLineIndex && line.lineIndex < form.startLineIndex + 16).map((line) => <option key={line.lineIndex} value={line.lineIndex}>{line.lineIndex + 1}. {line.text}</option>)}
              </select>
            </label>
            <label>Type<select className={inputClass} value={form.type} onChange={(event)=>setForm((current)=>({...current,type:event.target.value}))}>{TYPE_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>Confidence<select className={inputClass} value={form.confidence} onChange={(event)=>setForm((current)=>({...current,confidence:event.target.value}))}>{CONFIDENCE_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label className="sm:col-span-2">Title <span className="text-xs text-muted">({form.title.length}/80)</span><input className={inputClass} maxLength={80} value={form.title} onChange={(event)=>setForm((current)=>({...current,title:event.target.value}))}/></label>
            <label className="sm:col-span-2">Summary <span className="text-xs text-muted">({form.summary.length}/300)</span><textarea className={inputClass} maxLength={300} rows={4} value={form.summary} onChange={(event)=>setForm((current)=>({...current,summary:event.target.value}))}/></label>
            <label className="sm:col-span-2">Full breakdown<textarea className={inputClass} maxLength={8000} rows={8} value={form.explanation} onChange={(event)=>setForm((current)=>({...current,explanation:event.target.value}))}/></label>
            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">Sources</p><button className="btn-secondary" onClick={()=>setForm((current)=>({...current,sources:[...current.sources,{label:"",url:""}]}))} type="button"><Plus size={14}/>Add source</button></div>
              {form.sources.map((source,index)=><div className="grid gap-2 sm:grid-cols-[0.4fr_1fr_auto]" key={index}><input aria-label={`Source ${index+1} label`} className="field-input" maxLength={120} placeholder="Source label" value={source.label} onChange={(event)=>setForm((current)=>({...current,sources:current.sources.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item)}))}/><input aria-label={`Source ${index+1} URL`} className="field-input" placeholder="https://..." value={source.url} onChange={(event)=>setForm((current)=>({...current,sources:current.sources.map((item,itemIndex)=>itemIndex===index?{...item,url:event.target.value}:item)}))}/><button aria-label={`Remove source ${index+1}`} className="btn-secondary" onClick={()=>setForm((current)=>({...current,sources:current.sources.filter((_,itemIndex)=>itemIndex!==index)}))} type="button"><X size={15}/></button></div>)}
            </div>
          </div>

          <aside className="rounded-xl border border-edge bg-surface-elevated p-5">
            <p className="section-kicker">Anchor preview</p>
            <blockquote className="mt-4 whitespace-pre-wrap border-l-2 border-brand-primary/60 pl-4 text-sm leading-7 text-ink">{excerpt || "Choose a lyric range."}</blockquote>
            {form.title || form.summary ? <div className="mt-5 rounded-lg border border-brand-primary/20 bg-brand-primary-soft p-4"><p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">Breaking Barz</p><h3 className="mt-2 font-semibold text-ink">{form.title || "Annotation title"}</h3><p className="mt-2 text-sm leading-6 text-muted">{form.summary || "Concise summary preview"}</p></div> : null}
          </aside>
        </div>
      )}

      {message ? <p className="text-sm text-amber-200" role="status">{message}</p> : null}
      {sections.length ? <div className="flex flex-wrap gap-3 border-t border-edge pt-4">
        <button className="btn-secondary" disabled={saving} onClick={()=>void submit("draft")} type="button"><Save size={15}/>Save</button>
        <button className="btn-primary" disabled={saving} onClick={()=>void submit("publish")} type="button"><Send size={15}/>Publish</button>
        {form.id ? <button className="btn-secondary ml-auto" disabled={saving} onClick={()=>void submit("archive")} type="button"><Archive size={15}/>Archive</button> : null}
        {form.id ? <button className="btn-secondary" onClick={reset} type="button"><BookOpen size={15}/>New Annotation</button> : null}
      </div> : null}
    </section>
  );
}
