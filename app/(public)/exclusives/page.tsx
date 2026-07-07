export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import type {Metadata} from "next";
import {
  ArrowUpRight,
  BadgeCheck,
  Lightbulb,
  PenLine,
  Radio,
  Swords,
  Trophy,
  Play
} from "lucide-react";

import {cookies} from "next/headers";

import {ExclusiveSignupForm} from "@/components/exclusive-signup-form";
import {normalizeExternalUrl} from "@/lib/public-utils";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";
import {prisma} from "@/lib/db/prisma";
import {extractYouTubeVideoId, getCanonicalYouTubeWatchUrl} from "@/lib/youtube-utils";
import {TrackedExternalLink} from "@/components/tracked-external-link";
import {InsiderAccessAnalytics} from "@/components/insider-access-analytics";

const COMMUNITY_MARKERS = [Lightbulb, PenLine, Swords, Trophy, Radio, BadgeCheck];

export async function generateMetadata(): Promise<Metadata> {
  const {siteSettings} = await readPublicExclusiveOffer();

  return {
    title: "Insider Access",
    description: "Get early access to unreleased previews, work-in-progress drafts, and join our Discord community."
  };
}

export default async function PublicExclusivesPage({
  searchParams
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const token = resolvedSearchParams?.t || cookieStore.get("vcc_exclusive_access")?.value;

  const {offer} = await readPublicExclusiveOffer();

  let isUnlocked = false;
  if (token) {
    const subscriber = await prisma.subscriber.findUnique({
      where: { downloadToken: token }
    });
    if (subscriber) {
      isUnlocked = true;
    }
  }

  // Resolve associated release if configured
  const release = offer.release_id
    ? await prisma.release.findUnique({
        where: { id: offer.release_id }
      })
    : null;

  // Derivations
  const derivedTitle = offer.exclusive_track_title.trim() || release?.title || "Upcoming Preview";
  const derivedArtwork = offer.exclusive_track_art_path.trim() || release?.coverArtPath || "";
  const derivedDescription = offer.exclusive_track_description.trim() || release?.publicDescription || "";

  // Determine preview availability
  let isPreviewActive = offer.exclusive_track_enabled && Boolean(offer.private_external_url.trim());
  let youtubeUrl = "";

  if (isPreviewActive) {
    try {
      const videoId = extractYouTubeVideoId(offer.private_external_url);
      // ONLY set the YouTube watch URL if the visitor is unlocked
      if (isUnlocked) {
        youtubeUrl = getCanonicalYouTubeWatchUrl(videoId);
      }
    } catch (err) {
      console.error("Failed to parse YouTube URL:", err);
      isPreviewActive = false;
    }
  }

  const hasArt = Boolean(derivedArtwork);
  const discordInviteUrl = normalizeExternalUrl(offer.discord_invite_url);
  const benefits = offer.community_benefits.filter(
    (benefit) => benefit.title.trim() || benefit.description.trim()
  );

  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#06080b] px-4 py-10 sm:px-6 sm:py-16">
      <InsiderAccessAnalytics releaseId={offer.release_id} releaseTitle={derivedTitle} />

      {hasArt && isPreviewActive ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 scale-[1.08] opacity-80">
            <Image
              alt=""
              className="object-cover object-center blur-[48px]"
              fill
              sizes="256px"
              src={derivedArtwork}
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,9,0.58),rgba(7,9,13,0.92)_32%,rgba(6,8,11,0.99))]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.18),transparent_33%),linear-gradient(180deg,rgba(5,6,9,0.96),rgba(7,9,13,1))]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.024)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:52px_52px] opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[#c9a347]/10 blur-[90px]" />

      <div className="relative mx-auto max-w-[1160px]">
        <section className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[42px] border border-white/10 bg-[#0c1015]/82 px-5 py-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:px-7 sm:py-12 lg:px-10">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(201,163,71,0.72),transparent)]" />
          <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
            {offer.badge_text || "Insider Access"}
          </div>

          {isPreviewActive ? (
            <>
              {hasArt ? (
                <div className="mt-7 flex justify-center">
                  <div className="relative h-44 w-44 overflow-hidden rounded-[28px] border border-white/10 bg-[#12161b] shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:h-52 sm:w-52">
                    <Image
                      alt={`${derivedTitle} artwork`}
                      className="object-cover"
                      fill
                      priority
                      sizes="208px"
                      src={derivedArtwork}
                    />
                  </div>
                </div>
              ) : null}

              <h1 className="mx-auto mt-7 max-w-2xl text-3xl font-semibold tracking-[-0.055em] text-[#f7f1e6] sm:text-[2.85rem] sm:leading-[1.02]">
                {isUnlocked ? offer.success_heading || "Insider Access Unlocked" : offer.headline}
              </h1>
              
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#d1d8df] sm:text-lg">
                {isUnlocked ? (offer.success_message || "You have unlocked early access previews.") : offer.subtext}
              </p>

              {derivedTitle && (
                <div className="mt-6 inline-flex flex-col items-center">
                  <span className="text-xs uppercase tracking-widest text-[#c9a347]/80">Current Preview</span>
                  <span className="mt-1 text-lg font-bold text-[#f7f1e6]">{derivedTitle}</span>
                  {derivedDescription && (
                    <span className="mt-1 max-w-md text-xs text-[#a0aab5]">{derivedDescription}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="mx-auto mt-7 max-w-2xl text-3xl font-semibold tracking-[-0.055em] text-[#f7f1e6] sm:text-[2.85rem] sm:leading-[1.02]">
                {offer.headline || "Join Insider Access"}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#d1d8df] sm:text-lg">
                {offer.subtext || "Get early access to unreleased tracks, drafts, and updates."}
              </p>

              <div className="mt-8 rounded-[28px] border border-white/5 bg-white/[0.02] px-6 py-10 text-center">
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c9a347]">Preview Status</span>
                <h3 className="mt-3 text-xl font-bold text-[#f7f1e6]">Next preview coming soon</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#98a1aa]">
                  Sign up below to lock in your access. You will receive an email notice the exact second the next unreleased draft goes live.
                </p>
              </div>
            </>
          )}

          {offer.brand_line.trim() ? (
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d2af5a]">
              {offer.brand_line}
            </p>
          ) : null}

          <div className="mx-auto mt-8 max-w-[640px] text-left">
            {isUnlocked ? (
              isPreviewActive && youtubeUrl ? (
                <div className="flex flex-col items-center space-y-6 text-center">
                  <TrackedExternalLink
                    href={youtubeUrl}
                    eventType="exclusive_preview_open"
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#c9a347] to-[#e6c167] px-8 py-4 text-base font-bold text-[#13161a] transition hover:scale-[1.02] active:scale-[0.98] shadow-[0_12px_40px_rgba(201,163,71,0.25)]"
                  >
                    <Play size={18} fill="currentColor" />
                    {offer.instant_unlock_button_label || "Access the Current Preview"}
                  </TrackedExternalLink>
                  <p className="text-center text-xs leading-6 text-[#8f98a3]">
                    This private video is unlisted. Please check back often as previews rotate out when commercial releases occur.
                  </p>
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-black/16 px-6 py-8 text-center">
                  <h3 className="text-xl font-semibold tracking-tight text-[#f7f1e6]">
                    Insider Access Activated
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#b6bec7]">
                    You are signed up! There is no active preview right now, but you will receive an email notice when the next track is uploaded.
                  </p>
                </div>
              )
            ) : (
              <ExclusiveSignupForm
                consentLabel={offer.consent_label}
                ctaLabel={offer.cta_label}
                emailLabel={offer.email_label}
                nameLabel={offer.name_label}
                successHeading={offer.success_heading}
                unlockExperience={offer.unlock_experience}
              />
            )}
          </div>
        </section>

        <section className="relative mx-auto mt-12 max-w-[1120px] overflow-hidden rounded-[42px] border border-white/10 bg-[#0b0f14]/70 px-4 py-10 backdrop-blur-xl sm:mt-16 sm:px-7 sm:py-12 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,163,71,0.17),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(74,100,190,0.11),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:38px_38px] opacity-35" />

          <div className="relative">
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
                {offer.community_badge_text}
              </div>
            </div>

            <div className="mx-auto mt-6 max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-[-0.055em] text-[#f7f1e6] sm:text-5xl sm:leading-[1.04]">
                {offer.community_headline}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-8 text-[#e8dcc3]">
                {offer.community_subheadline}
              </p>
              {offer.community_microcopy.trim() ? (
                <p className="mx-auto mt-3 max-w-xl text-sm uppercase tracking-[0.18em] text-[#8f98a3]">
                  {offer.community_microcopy}
                </p>
              ) : null}
            </div>

            {benefits.length > 0 ? (
              <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {benefits.map((benefit, index) => {
                  const Marker = COMMUNITY_MARKERS[index % COMMUNITY_MARKERS.length];

                  return (
                    <article
                      className="group relative min-h-[220px] overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(9,12,17,0.76))] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#c9a347]/45 hover:shadow-[0_20px_60px_rgba(201,163,71,0.12)]"
                      key={benefit.id || `${benefit.title}-${index}`}
                    >
                      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#c9a347]/0 blur-2xl transition group-hover:bg-[#c9a347]/12" />
                      <div className="relative flex items-center justify-between gap-3">
                        <span className="rounded-full border border-[#c9a347]/26 bg-[#c9a347]/10 px-3 py-1 text-xs font-bold text-[#d7b663]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-[#d7b663] transition group-hover:border-[#c9a347]/35 group-hover:bg-[#c9a347]/10">
                          <Marker size={18} />
                        </span>
                      </div>
                      <h3 className="relative mt-6 text-lg font-semibold leading-7 text-[#f7f1e6]">
                        {benefit.title}
                      </h3>
                      <p className="relative mt-4 text-sm leading-7 text-[#a7b0ba]">
                        {benefit.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : null}

            <div className="mx-auto mt-10 max-w-2xl rounded-[34px] border border-[#c9a347]/22 bg-[linear-gradient(135deg,rgba(201,163,71,0.16),rgba(8,10,13,0.88))] px-5 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:px-8">
              <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#f7f1e6]">
                {offer.community_cta_heading}
              </h3>
              <div className="mt-6 flex justify-center">
                {discordInviteUrl ? (
                  <TrackedExternalLink
                    className="inline-flex w-full justify-center rounded-full border border-[#c9a347]/42 bg-[#c9a347] px-6 py-4 text-sm font-semibold text-[#14120d] transition duration-300 hover:scale-[1.02] hover:bg-[#e2bf68] sm:w-auto"
                    href={discordInviteUrl}
                    eventType="exclusive_discord_cta"
                  >
                    {offer.community_cta_label}
                    <ArrowUpRight className="ml-2" size={16} />
                  </TrackedExternalLink>
                ) : (
                  <button
                    className="inline-flex w-full cursor-not-allowed justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-[#8d949d] sm:w-auto"
                    disabled
                    type="button"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#98a1aa]">
                {discordInviteUrl
                  ? offer.community_cta_helper
                  : "Discord invite coming soon."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
