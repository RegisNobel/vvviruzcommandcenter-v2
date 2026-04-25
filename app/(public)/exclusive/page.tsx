export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import type {Metadata} from "next";

import {ExclusiveSignupForm} from "@/components/exclusive-signup-form";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";

export async function generateMetadata(): Promise<Metadata> {
  const {siteSettings} = await readPublicExclusiveOffer();

  return {
    title: siteSettings.site_content.metadata.exclusive_page_title,
    description: siteSettings.site_content.metadata.exclusive_page_description
  };
}

export default async function PublicExclusivePage() {
  const {siteSettings, offer, isAvailable} = await readPublicExclusiveOffer();
  const hasArt = Boolean(offer.exclusive_track_art_path.trim());

  return (
    <main className="relative min-h-[calc(100vh-140px)] overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      {hasArt ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 scale-[1.08]">
            <Image
              alt={`${offer.exclusive_track_title || siteSettings.artist_name} artwork`}
              className="object-cover object-center blur-[42px]"
              fill
              priority
              sizes="100vw"
              src={offer.exclusive_track_art_path}
              unoptimized
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,9,0.42),rgba(7,9,13,0.9)_30%,rgba(7,9,13,0.98))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_32%)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_34%),linear-gradient(180deg,rgba(5,6,9,0.92),rgba(9,11,15,1))]" />
      )}

      <div className="relative mx-auto max-w-[720px]">
        <section className="rounded-[38px] border border-white/10 bg-[#0b0f14]/78 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(8,11,15,0.42))] px-5 py-7 text-center sm:px-8 sm:py-9">
            <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
              {offer.badge_text}
            </div>

            {hasArt ? (
              <div className="mt-6 flex justify-center">
                <div className="relative h-44 w-44 overflow-hidden rounded-[28px] border border-white/10 bg-[#12161b] shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:h-52 sm:w-52">
                  <Image
                    alt={`${offer.exclusive_track_title} artwork`}
                    className="object-cover"
                    fill
                    priority
                    sizes="208px"
                    src={offer.exclusive_track_art_path}
                    unoptimized
                  />
                </div>
              </div>
            ) : null}

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-[#f7f1e6] sm:text-[2.7rem]">
              {offer.headline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#d1d8df] sm:text-lg">
              {offer.subtext}
            </p>
            {offer.brand_line.trim() ? (
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d2af5a]">
                {offer.brand_line}
              </p>
            ) : null}

            {offer.exclusive_track_title.trim() ? (
              <div className="mt-7 rounded-[24px] border border-white/10 bg-black/18 px-5 py-5 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d2af5a]">
                  Exclusive Track
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-[#f7f1e6]">
                  {offer.exclusive_track_title}
                </p>
                {offer.exclusive_track_description.trim() ? (
                  <p className="mt-3 text-sm leading-7 text-[#b6bec7]">
                    {offer.exclusive_track_description}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 text-left">
              {isAvailable ? (
                <ExclusiveSignupForm
                  consentLabel={offer.consent_label}
                  ctaLabel={offer.cta_label}
                  downloadLabel={offer.download_label}
                  emailLabel={offer.email_label}
                  nameLabel={offer.name_label}
                  successHeading={offer.success_heading}
                  trackTitle={offer.exclusive_track_title}
                />
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-black/16 px-6 py-8 text-center">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#f7f1e6]">
                    {offer.unavailable_heading}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[#b6bec7]">
                    {offer.unavailable_body}
                  </p>
                  <div className="mt-6 flex justify-center">
                    <Link
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-[#f4eedf] transition hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10"
                      href="/music"
                    >
                      Back to Music
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

