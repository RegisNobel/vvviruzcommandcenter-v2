"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject
} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {ArrowLeft, ArrowRight, BookOpen, X} from "lucide-react";

import {parseCanonicalLyrics} from "@/lib/lyrics";
import type {PublicReleaseAnnotation} from "@/lib/types";

function annotationTypeLabel(value: string) {
  const labels: Record<string, string> = {
    punchline: "Punchline",
    double_meaning: "Double Meaning",
    anime_reference: "Anime Reference",
    game_reference: "Game Reference",
    character_lore: "Character Lore",
    language_translation: "Language / Translation",
    personal_context: "Personal Context",
    production_detail: "Production Detail",
    sample: "Sample",
    collaborator_note: "Collaborator Note",
    lyric_note: "Lyric Note",
    reference: "Reference",
    story: "Story Context",
    language: "Language Note"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    verified: "Verified",
    official_context: "Artist Commentary",
    interpretive: "Interpretation",
    needs_review: "Context Note"
  };
  return labels[value] ?? "Context Note";
}

function trackAnnotationEvent(input: {
  eventType: "breaking_barz_summary_view" | "breaking_barz_open" | "breaking_barz_next" | "breaking_barz_previous" | "breaking_barz_reference_click";
  releaseId: string;
  annotationId: string;
  interactionSource: string;
}) {
  const body = JSON.stringify({
    eventType: input.eventType,
    page: "release",
    eventId: crypto.randomUUID(),
    path: window.location.pathname + window.location.search,
    releaseId: input.releaseId,
    contentType: "release_annotation",
    contentId: input.annotationId,
    interactionSource: input.interactionSource
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", new Blob([body], {type: "application/json"}));
  } else {
    void fetch("/api/analytics/track", {method: "POST", headers: {"content-type": "application/json"}, body, keepalive: true});
  }
}

function AnnotationPanel({
  annotation,
  index,
  total,
  onClose,
  onNavigate,
  releaseId,
  headingRef
}: {
  annotation: PublicReleaseAnnotation;
  index: number;
  total: number;
  onClose: () => void;
  onNavigate: (offset: -1 | 1) => void;
  releaseId: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return <article className="public-panel p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div><p className="public-eyebrow">Breaking Barz</p><p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8fb8e8]">{annotationTypeLabel(annotation.type)} / {confidenceLabel(annotation.confidence)} / {index + 1} of {total}</p></div>
      <button aria-label="Close Breaking Barz explanation" className="rounded-md border border-white/10 p-2 text-[#aeb6c0] transition hover:border-white/25 hover:text-white" onClick={onClose} type="button"><X size={18}/></button>
    </div>
    <h2 className="public-heading mt-5 text-2xl font-semibold" ref={headingRef} tabIndex={-1}>{annotation.title}</h2>
    <blockquote className="mt-4 whitespace-pre-wrap border-l-2 border-[#c9a347]/60 pl-4 text-sm italic leading-7 text-[#d7dde3]">{annotation.lyric_excerpt}</blockquote>
    <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#c5ccd4]">{annotation.explanation}</p>
    {annotation.sources.length ? <div className="mt-5 flex flex-wrap gap-3">{annotation.sources.map((source)=><a className="text-xs font-semibold text-[#e3c16e] underline-offset-4 hover:underline" href={source.url} key={`${source.label}:${source.url}`} onClick={()=>trackAnnotationEvent({eventType:"breaking_barz_reference_click",releaseId,annotationId:annotation.id,interactionSource:"reference_link"})} rel="noopener noreferrer" target="_blank">{source.label}</a>)}</div> : null}
    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
      <button className="public-action-secondary justify-center" disabled={index === 0} onClick={()=>onNavigate(-1)} type="button"><ArrowLeft size={15}/>Previous</button>
      <button className="public-action-secondary justify-center" disabled={index === total - 1} onClick={()=>onNavigate(1)} type="button">Next<ArrowRight size={15}/></button>
    </div>
  </article>;
}

export function BreakingBarzExperience({
  annotations,
  lyrics,
  lyricsHeading,
  rail,
  releaseId,
  releaseTitle
}: {
  annotations: PublicReleaseAnnotation[];
  lyrics: string;
  lyricsHeading: string;
  rail: ReactNode;
  releaseId: string;
  releaseTitle: string;
}) {
  const document = useMemo(() => parseCanonicalLyrics(lyrics), [lyrics]);
  const ordered = useMemo(() => [...annotations].sort((left,right)=>left.section_key.localeCompare(right.section_key)||left.section_occurrence-right.section_occurrence||left.start_line_index-right.start_line_index),[annotations]);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const selectedId = searchParams.get("bar") ?? "";
  const selectedIndex = ordered.findIndex((annotation)=>annotation.id===selectedId);
  const selected = selectedIndex >= 0 ? ordered[selectedIndex] : null;
  const [summaryId,setSummaryId]=useState("");
  const summaryTimer=useRef<number|null>(null);
  const headingRef=useRef<HTMLHeadingElement|null>(null);
  const markerRefs=useRef(new Map<string,HTMLButtonElement>());
  const lastOpened=useRef("");

  function annotationForLine(sectionKey:string,sectionOccurrence:number,lineIndex:number){return ordered.find((annotation)=>annotation.section_key===sectionKey&&annotation.section_occurrence===sectionOccurrence&&lineIndex>=annotation.start_line_index&&lineIndex<=annotation.end_line_index);}
  function updateBar(id:string){const next=new URLSearchParams(searchParams.toString());if(id)next.set("bar",id);else next.delete("bar");router.push(`${pathname}${next.size?`?${next.toString()}`:""}`,{scroll:false});}
  function open(annotation:PublicReleaseAnnotation,source:string){stopSummary();lastOpened.current=annotation.id;updateBar(annotation.id);trackAnnotationEvent({eventType:"breaking_barz_open",releaseId,annotationId:annotation.id,interactionSource:source});}
  function close(){updateBar("");window.setTimeout(()=>markerRefs.current.get(lastOpened.current)?.focus({preventScroll:true}),0);}
  function navigate(offset:-1|1){const next=ordered[selectedIndex+offset];if(!next)return;updateBar(next.id);trackAnnotationEvent({eventType:offset===1?"breaking_barz_next":"breaking_barz_previous",releaseId,annotationId:next.id,interactionSource:offset===1?"next":"previous"});const marker=markerRefs.current.get(next.id);window.setTimeout(()=>marker?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"}),0);}
  function startSummary(annotation:PublicReleaseAnnotation){if(summaryTimer.current)window.clearTimeout(summaryTimer.current);setSummaryId(annotation.id);summaryTimer.current=window.setTimeout(()=>{const key=`breaking-barz-summary:${annotation.id}`;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,"1");trackAnnotationEvent({eventType:"breaking_barz_summary_view",releaseId,annotationId:annotation.id,interactionSource:"summary"});}},500);}
  function stopSummary(){if(summaryTimer.current)window.clearTimeout(summaryTimer.current);summaryTimer.current=null;setSummaryId("");}
  function handleTextClick(event:MouseEvent<HTMLDivElement>,annotation:PublicReleaseAnnotation){if(window.getSelection()?.toString().trim())return;event.preventDefault();open(annotation,"lyrics_click");}

  useEffect(()=>{if(selected)window.setTimeout(()=>headingRef.current?.focus({preventScroll:true}),0);},[selected]);
  useEffect(()=>{
    if(!selected)return;
    const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
    window.addEventListener("keydown",handleKeyDown);
    return()=>window.removeEventListener("keydown",handleKeyDown);
  });
  useEffect(()=>()=>{if(summaryTimer.current)window.clearTimeout(summaryTimer.current);},[]);

  const hasRail=Boolean(rail)||annotations.length>0;
  return <>
    {annotations.length ? <div className="mb-6 rounded-lg border border-[#c9a347]/25 bg-[#c9a347]/[0.06] px-4 py-3"><p className="public-eyebrow">Breaking Barz</p><p className="mt-1 text-sm text-[#aeb6c0]">{annotations.length} annotated moment{annotations.length===1?"":"s"}. Highlighted lyrics include references, wordplay, and track context.</p></div> : null}
    <section className={hasRail?"grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)] lg:items-start lg:gap-12 xl:gap-16":"max-w-4xl"}>
      <article aria-label={`${releaseTitle} lyrics`} className="min-w-0 py-2 text-left">
        <h2 className="public-eyebrow">{lyricsHeading}</h2>
        <div className="mt-6 min-w-0 max-w-full">
          {document.tokens.map((token)=>{
            if(token.type==="heading")return <h3 className="mb-3 mt-8 max-w-full whitespace-pre-wrap break-words text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b861] first:mt-0" key={token.key}>{token.text}</h3>;
            if(token.type==="spacer")return <div aria-hidden="true" className="h-4" key={token.key}/>;
            const annotation=annotationForLine(token.sectionKey,token.sectionOccurrence,token.lineIndex);
            if(!annotation)return <div className="max-w-full whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.8] text-[#d7dde3] sm:text-base" key={token.key}>{token.text}</div>;
            const isStart=token.lineIndex===annotation.start_line_index;
            const isEnd=token.lineIndex===annotation.end_line_index;
            const isSelected=selected?.id===annotation.id;
            return <Fragment key={token.key}><div className={`group relative -mx-2 cursor-pointer border-l-2 px-2 pr-12 font-sans text-[15px] leading-[1.8] transition sm:pr-2 sm:text-base ${isStart?"rounded-t-md pt-1":""} ${isEnd?"rounded-b-md pb-1":""} ${isSelected?"border-[#f6c945] bg-[#c9a347]/15 text-[#fff8ec]":"border-[#c9a347]/55 bg-[#c9a347]/[0.07] text-[#d7dde3] hover:bg-[#c9a347]/[0.12]"}`} data-breaking-barz-range onClick={(event)=>handleTextClick(event,annotation)} onMouseEnter={()=>startSummary(annotation)} onMouseLeave={stopSummary}>
              {isStart?<button aria-label={`Open Breaking Barz explanation for: ${annotation.lyric_excerpt}`} className="absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#c9a347]/40 bg-[#111318] text-[#e3c16e] transition hover:border-[#e3c16e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6c945] sm:-left-9 sm:right-auto" onBlur={stopSummary} onClick={(event)=>{event.stopPropagation();open(annotation,"marker");}} onFocus={()=>startSummary(annotation)} ref={(node)=>{if(node)markerRefs.current.set(annotation.id,node);else markerRefs.current.delete(annotation.id);}} type="button"><BookOpen size={16}/></button>:null}
              <span className="whitespace-pre-wrap break-words">{token.text}</span>
              {isStart&&summaryId===annotation.id&&!selected?<div className="absolute right-0 top-full z-20 mt-2 w-[min(340px,calc(100vw-3rem))] rounded-lg border border-[#c9a347]/30 bg-[#12151a] p-4 shadow-2xl sm:left-2 sm:right-auto" role="status"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e3c16e]">{annotationTypeLabel(annotation.type)}</p><p className="mt-2 text-sm leading-6 text-[#d7dde3]">{annotation.summary}</p><p className="mt-2 text-xs font-semibold text-[#fff2c8]">Click the highlight for the full breakdown.</p></div>:null}
            </div></Fragment>;
          })}
        </div>
      </article>
      {hasRail?<aside aria-label={`${releaseTitle} media, annotations, and related releases`} className="space-y-10"><div className="hidden lg:block">{selected?<AnnotationPanel annotation={selected} headingRef={headingRef} index={selectedIndex} onClose={close} onNavigate={navigate} releaseId={releaseId} total={ordered.length}/>:null}</div>{rail}</aside>:null}
    </section>
    {selected?<div className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden" onMouseDown={(event)=>{if(event.currentTarget===event.target)close();}}><div aria-modal="true" className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0d1014] p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog"><AnnotationPanel annotation={selected} headingRef={headingRef} index={selectedIndex} onClose={close} onNavigate={navigate} releaseId={releaseId} total={ordered.length}/></div></div>:null}
  </>;
}
