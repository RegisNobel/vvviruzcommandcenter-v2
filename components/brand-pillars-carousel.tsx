"use client";

import Image from "next/image";
import {useEffect, useMemo, useState} from "react";

import type {BrandPillar} from "@/lib/types";

import {DEFAULT_BRAND_PILLAR_ICON_FILES, getSiteIconUrl} from "@/lib/site-assets";

type BrandPillarsCarouselProps = {
  pillars: BrandPillar[];
};

export function BrandPillarsCarousel({pillars}: BrandPillarsCarouselProps) {
  const visiblePillars = pillars.slice(0, DEFAULT_BRAND_PILLAR_ICON_FILES.length);
  const loopedPillars = useMemo(() => {
    if (visiblePillars.length === 0) {
      return [];
    }

    return [...visiblePillars, visiblePillars[0]];
  }, [visiblePillars]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);

  useEffect(() => {
    if (visiblePillars.length <= 1 || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      setIsTransitionEnabled(true);
      setActiveIndex((current) => current + 1);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isPaused, visiblePillars.length]);

  useEffect(() => {
    if (activeIndex < visiblePillars.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsTransitionEnabled(false);
      setActiveIndex(0);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, visiblePillars.length]);

  useEffect(() => {
    if (isTransitionEnabled) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsTransitionEnabled(true);
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTransitionEnabled]);

  if (visiblePillars.length === 0) {
    return null;
  }

  return (
    <div
      className="space-y-4"
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#101318]">
        <div
          className={`flex ease-out ${isTransitionEnabled ? "transition-transform duration-700" : ""}`}
          style={{transform: `translateX(-${activeIndex * 100}%)`}}
        >
          {loopedPillars.map((pillar, index) => (
            <article
              className="grid min-w-full gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.95fr] lg:items-center"
              key={`${pillar.id}-${index}`}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0e12]">
                <Image
                  alt={pillar.title}
                  className="object-cover"
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  src={getSiteIconUrl(
                    pillar.imageFile ||
                      DEFAULT_BRAND_PILLAR_ICON_FILES[index % visiblePillars.length] ||
                      DEFAULT_BRAND_PILLAR_ICON_FILES[0]
                  )}
                />
              </div>

              <div>
                <h3 className="text-3xl font-semibold tracking-tight text-[#f4eedf] sm:text-4xl">
                  {pillar.title}
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#98a0a8] sm:text-base">
                  {pillar.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {visiblePillars.map((pillar, index) => (
            <button
              aria-label={`Show ${pillar.title}`}
              className={`h-2.5 rounded-full transition ${
                index === (activeIndex % visiblePillars.length)
                  ? "w-8 bg-[#c9a347]"
                  : "w-2.5 bg-white/20 hover:bg-white/40"
              }`}
              key={pillar.id}
              onClick={() => {
                setIsTransitionEnabled(true);
                setActiveIndex(index);
              }}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
