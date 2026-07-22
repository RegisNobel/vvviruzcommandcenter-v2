"use client";

import {ArrowUpRight, ChevronLeft, ChevronRight, Radio} from "lucide-react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect, useRef, useState} from "react";

import {trackLatestIntelClick, trackLatestIntelView} from "@/components/public-fan-content-analytics";
import {getLatestIntelTypeLabel, shouldShowLatestIntel} from "@/lib/latest-intel";
import type {PublicFanUpdate} from "@/lib/types";

const ROTATION_DELAY_MS = 7_000;
const IMPRESSION_DELAY_MS = 750;

function createPageVisitId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatIntelDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function LatestIntelRail({
  configuredHubPaths,
  items
}: {
  configuredHubPaths: string[];
  items: PublicFanUpdate[];
}) {
  const pathname = usePathname() || "/";
  const shouldRender = items.length > 0 && shouldShowLatestIntel(pathname, configuredHubPaths);
  const railRef = useRef<HTMLElement>(null);
  const viewedIdsRef = useRef(new Set<string>());
  const [activeIndex, setActiveIndex] = useState(0);
  const [visit, setVisit] = useState({id: "", pathname: ""});
  const [isDesktopAutoplay, setIsDesktopAutoplay] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [manualAnnouncement, setManualAnnouncement] = useState("");

  const pageVisitId = visit.pathname === pathname ? visit.id : "";
  const activeItem = items[activeIndex] || items[0];

  useEffect(() => {
    setVisit({id: createPageVisitId(), pathname});
    setActiveIndex(0);
    setManualPaused(false);
    setManualAnnouncement("");
    viewedIdsRef.current.clear();
  }, [pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAutoplay = () => setIsDesktopAutoplay(desktopQuery.matches && !reducedMotionQuery.matches);
    updateAutoplay();
    desktopQuery.addEventListener("change", updateAutoplay);
    reducedMotionQuery.addEventListener("change", updateAutoplay);
    return () => {
      desktopQuery.removeEventListener("change", updateAutoplay);
      reducedMotionQuery.removeEventListener("change", updateAutoplay);
    };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsTabVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const element = railRef.current;
    if (!element || !shouldRender) {
      setIsInView(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      {threshold: [0, 0.5, 1]}
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (
      !shouldRender ||
      items.length < 2 ||
      !isDesktopAutoplay ||
      !isInView ||
      !isTabVisible ||
      isHovered ||
      isFocusWithin ||
      manualPaused
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, ROTATION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isDesktopAutoplay, isFocusWithin, isHovered, isInView, isTabVisible, items.length, manualPaused, shouldRender]);

  useEffect(() => {
    if (!shouldRender || !activeItem || !pageVisitId || !isInView || !isTabVisible) return;
    if (viewedIdsRef.current.has(activeItem.id)) return;
    const timer = window.setTimeout(() => {
      viewedIdsRef.current.add(activeItem.id);
      trackLatestIntelView(activeItem.id, pageVisitId);
    }, IMPRESSION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeItem, isInView, isTabVisible, pageVisitId, shouldRender]);

  if (!shouldRender || !activeItem) return null;

  function navigateTo(index: number) {
    const normalizedIndex = (index + items.length) % items.length;
    setActiveIndex(normalizedIndex);
    setManualPaused(true);
    setManualAnnouncement(`Showing Intel update ${normalizedIndex + 1} of ${items.length}: ${items[normalizedIndex].title}`);
  }

  return (
    <section
      aria-label="Latest Intel"
      aria-roledescription="carousel"
      className="relative z-30 border-b border-[var(--public-gold)]/30 bg-[linear-gradient(105deg,rgba(31,27,18,0.98),rgba(13,16,20,0.99)_48%,rgba(13,16,20,0.98))] shadow-[0_14px_36px_rgba(0,0,0,0.24)] lg:sticky lg:top-[69px]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false);
      }}
      onFocus={() => setIsFocusWithin(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={railRef}
    >
      <div className="mx-auto flex min-h-[72px] max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-primary)] opacity-35 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
            </span>
            <span className="hidden sm:inline">Latest Intel</span>
            <Radio aria-hidden="true" className="sm:hidden" size={14} />
          </span>

          <div className="h-8 w-px shrink-0 bg-white/10" />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--public-muted)] sm:text-[10px]">
              <span className="truncate text-[#d8b861]">{getLatestIntelTypeLabel(activeItem.type)}</span>
              <span aria-hidden="true">/</span>
              <time dateTime={activeItem.published_at}>{formatIntelDate(activeItem.published_at)}</time>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <strong className="line-clamp-2 min-w-0 text-sm leading-5 text-[var(--public-ink)] sm:line-clamp-1 sm:text-base">
                {activeItem.title}
              </strong>
              {activeItem.summary ? (
                <span className="hidden min-w-0 truncate text-sm text-[var(--public-muted)] md:block">
                  {activeItem.summary}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {activeItem.href ? (
          <Link
            className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] transition hover:text-[var(--brand-primary-hover)] sm:inline-flex"
            href={activeItem.href}
            onClick={() => trackLatestIntelClick({intelId: activeItem.id, pageVisitId, targetUrl: activeItem.href, label: activeItem.title})}
          >
            Read update
            <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        ) : null}

        {items.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              aria-label="Previous Intel update"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-[var(--public-muted)] transition hover:border-[var(--public-gold)]/60 hover:text-[var(--public-ink)]"
              onClick={() => navigateTo(activeIndex - 1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={15} />
            </button>
            <span className="hidden items-center gap-1 sm:flex">
              {items.map((item, index) => (
                <button
                  aria-current={index === activeIndex ? "true" : undefined}
                  aria-label={`Show update ${index + 1} of ${items.length}`}
                  className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-5 bg-[var(--brand-primary)]" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
                  key={item.id}
                  onClick={() => navigateTo(index)}
                  type="button"
                />
              ))}
            </span>
            <button
              aria-label="Next Intel update"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-[var(--public-muted)] transition hover:border-[var(--public-gold)]/60 hover:text-[var(--public-ink)]"
              onClick={() => navigateTo(activeIndex + 1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={15} />
            </button>
          </div>
        ) : null}
      </div>

      {activeItem.href ? (
        <Link
          className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] sm:hidden"
          href={activeItem.href}
          onClick={() => trackLatestIntelClick({intelId: activeItem.id, pageVisitId, targetUrl: activeItem.href, label: activeItem.title})}
        >
          Read update
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      ) : null}
      <p aria-live="polite" className="sr-only">{manualAnnouncement}</p>
    </section>
  );
}
