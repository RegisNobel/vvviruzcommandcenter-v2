"use client";

import Image from "next/image";
import {ArrowRight} from "lucide-react";

import {HomepageTrackedLink} from "@/components/homepage-tracked-link";

export type LockInSpotlightRelease = {
  coverArtAltText: string;
  coverArtPath: string;
  id: string;
  slug: string;
  title: string;
};

type LockInSpotlightProps = {
  ctaLabel: string;
  eyebrow: string;
  headline: string;
  preview?: boolean;
  release: LockInSpotlightRelease;
  statement: string;
};

export function LockInSpotlight({
  ctaLabel,
  eyebrow,
  headline,
  preview = false,
  release,
  statement
}: LockInSpotlightProps) {
  const destination = `/music/${release.slug}`;
  const actionClassName =
    "group/action inline-flex min-h-12 items-center justify-center gap-3 border border-[rgba(246,201,69,0.58)] bg-[#f6c945] px-6 py-3 text-sm font-black uppercase tracking-[0.15em] text-[#090b0e] transition duration-300 hover:border-[#ffe58d] hover:bg-[#ffe078] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c945] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b0e]";

  return (
    <section className="relative isolate overflow-clip border-y border-[rgba(246,201,69,0.24)] bg-[#090b0e]">
      {release.coverArtPath ? (
        <Image
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden scale-110 object-cover opacity-30 blur-3xl sm:block"
          fill
          sizes="(max-width: 1280px) 100vw, 1280px"
          src={release.coverArtPath}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,11,0.98)_0%,rgba(6,8,11,0.9)_45%,rgba(6,8,11,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_50%,rgba(246,201,69,0.16),transparent_34%)]" />

      <div className="relative grid min-h-[480px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:px-12 lg:py-16">
        <div className="relative z-10 max-w-3xl">
          <p className="public-eyebrow">{eyebrow}</p>
          <h2 className="public-heading mt-5 max-w-[12ch] text-[clamp(2.75rem,7vw,6.5rem)] font-black uppercase leading-[0.87] tracking-[-0.055em] text-[#fff8ec]">
            {headline}
          </h2>
          <p className="mt-7 max-w-xl text-sm font-bold uppercase tracking-[0.18em] text-[#d7dde5] sm:text-base">
            {statement}
          </p>
          <div className="mt-9">
            {preview ? (
              <span className={actionClassName}>
                {ctaLabel}
                <ArrowRight aria-hidden="true" size={17} />
              </span>
            ) : (
              <HomepageTrackedLink
                className={actionClassName}
                eventType="homepage_spotlight_click"
                href={destination}
                linkLabel={ctaLabel}
                linkType="lock_in_spotlight"
                releaseId={release.id}
              >
                {ctaLabel}
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform group-hover/action:translate-x-1"
                  size={17}
                />
              </HomepageTrackedLink>
            )}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[430px] lg:justify-self-end">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-[rgba(246,201,69,0.11)] blur-3xl" />
          {release.coverArtPath ? (
            <Image
              alt={release.coverArtAltText}
              className="relative object-cover shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
              fill
              sizes="(max-width: 1024px) 82vw, 430px"
              src={release.coverArtPath}
            />
          ) : (
            <div className="public-art-placeholder relative flex h-full items-end p-7 text-left">
              <span className="text-2xl font-black uppercase tracking-[-0.02em] text-[#fff8ec]">
                {release.title}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
