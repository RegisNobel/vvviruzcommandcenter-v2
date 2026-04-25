import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, Disc3, Music2, PlaySquare} from "lucide-react";

import type {Metadata} from "next";

import {getLinksPageRelease, getSiteSettings} from "@/lib/repositories/public-site";
import {normalizeExternalUrl} from "@/lib/public-utils";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";

const platformAccentStyles = {
  spotify:
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/16 hover:shadow-[0_0_30px_rgba(16,185,129,0.18)]",
  apple:
    "border-white/16 bg-white/[0.06] text-[#f5f2ea] hover:border-white/30 hover:bg-white/[0.1] hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]",
  youtubeMusic:
    "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:border-rose-400/52 hover:bg-rose-500/16 hover:shadow-[0_0_30px_rgba(244,63,94,0.16)]",
  youtubeVideo:
    "border-red-500/34 bg-red-500/10 text-red-100 hover:border-red-400/55 hover:bg-red-500/16 hover:shadow-[0_0_30px_rgba(239,68,68,0.18)]"
} as const;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const selectedRelease = await getLinksPageRelease(siteSettings.site_content.links.selected_release_id);

  return {
    title: selectedRelease
      ? selectedRelease.title
      : siteSettings.site_content.metadata.links_page_title,
    description:
      selectedRelease?.public_description ||
      siteSettings.site_content.metadata.links_page_description
  };
}

function createPlatformButtons(release: NonNullable<Awaited<ReturnType<typeof getLinksPageRelease>>>) {
  const defaults = {
    listen_on_spotify_label: "Listen on Spotify",
    listen_on_apple_music_label: "Listen on Apple Music",
    listen_on_youtube_music_label: "Listen on YouTube Music",
    watch_on_youtube_label: "Watch on YouTube"
  };

  return function buildButtons(labels: Partial<typeof defaults>) {
    const resolvedLabels = {
      ...defaults,
      ...labels
    };

    return [
      {
        id: "spotify",
        label: resolvedLabels.listen_on_spotify_label,
        href: normalizeExternalUrl(release.spotify_url),
        icon: Disc3,
        style: platformAccentStyles.spotify
      },
      {
        id: "apple",
        label: resolvedLabels.listen_on_apple_music_label,
        href: normalizeExternalUrl(release.apple_music_url),
        icon: Music2,
        style: platformAccentStyles.apple
      },
      {
        id: "youtube-music",
        label: resolvedLabels.listen_on_youtube_music_label,
        href: normalizeExternalUrl(release.youtube_url),
        icon: Disc3,
        style: platformAccentStyles.youtubeMusic
      },
      {
        id: "youtube-video",
        label: resolvedLabels.watch_on_youtube_label,
        href: normalizeExternalUrl(release.featured_video_url),
        icon: PlaySquare,
        style: platformAccentStyles.youtubeVideo
      }
    ].filter((platform) => platform.href);
  };
}

export default async function PublicLinksPage() {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.links;
  const platformContent = siteSettings.site_content.platforms;
  const [selectedRelease, exclusiveOfferState] = await Promise.all([
    getLinksPageRelease(content.selected_release_id),
    readPublicExclusiveOffer()
  ]);

  if (!selectedRelease) {
    return (
      <main className="relative min-h-[calc(100vh-140px)] overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_36%),linear-gradient(180deg,rgba(5,6,9,0.92),rgba(9,11,15,1))]" />
        <div className="relative mx-auto flex max-w-[560px] justify-center">
          <section className="w-full rounded-[34px] border border-white/10 bg-[#0c1015]/72 px-6 py-10 text-center backdrop-blur-2xl">
            <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
              {content.badge_text}
            </div>
            <p className="mt-6 text-sm leading-7 text-[#b2bac4]">{content.empty_state_text}</p>
          </section>
        </div>
      </main>
    );
  }

  const platformButtons = createPlatformButtons(selectedRelease)({
    listen_on_spotify_label: platformContent.listen_on_spotify_label,
    listen_on_apple_music_label: platformContent.listen_on_apple_music_label,
    listen_on_youtube_music_label: platformContent.listen_on_youtube_music_label,
    watch_on_youtube_label: platformContent.watch_on_youtube_label
  });
  const hasCoverArt = Boolean(selectedRelease.cover_art_path.trim());

  return (
    <main className="relative min-h-[calc(100vh-140px)] overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      {hasCoverArt ? (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 scale-[1.09]">
              <Image
                alt={`${selectedRelease.title} cover background`}
                className="object-cover object-center blur-[36px]"
                fill
                priority
                sizes="100vw"
                src={selectedRelease.cover_art_path}
                unoptimized
              />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,9,0.46),rgba(7,9,13,0.9)_35%,rgba(7,9,13,0.98))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.14),transparent_32%)]" />
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_36%),linear-gradient(180deg,rgba(5,6,9,0.92),rgba(9,11,15,1))]" />
      )}

      <div className="relative mx-auto flex max-w-[560px] justify-center">
        <section className="w-full rounded-[38px] border border-white/10 bg-[#0b0f14]/70 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(8,11,15,0.4))] px-5 py-7 text-center sm:px-6 sm:py-8">
            <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
              {content.badge_text}
            </div>

            <div className="mt-6 flex justify-center">
              {hasCoverArt ? (
                <div className="relative h-44 w-44 overflow-hidden rounded-[28px] border border-white/10 bg-[#12161b] shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:h-52 sm:w-52">
                  <Image
                    alt={`${selectedRelease.title} cover art`}
                    className="object-cover"
                    fill
                    priority
                    sizes="208px"
                    src={selectedRelease.cover_art_path}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-[28px] border border-white/10 bg-[#11161c] px-6 text-center text-2xl font-semibold tracking-[-0.03em] text-[#f6efdf] sm:h-52 sm:w-52">
                  {selectedRelease.title}
                </div>
              )}
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-[#f7f1e6] sm:text-[2.5rem]">
              {selectedRelease.title}
            </h1>
            {selectedRelease.collaborator && selectedRelease.collaborator_name.trim() ? (
              <p className="mt-2 text-sm font-semibold text-[#d7b45e]">
                with {selectedRelease.collaborator_name.trim()}
              </p>
            ) : null}

            <div className="mt-8 space-y-3">
              {platformButtons.length > 0 ? (
                <>
                  {platformButtons.map((platform) => {
                  const Icon = platform.icon;

                  return (
                    <Link
                      className={`flex w-full items-center justify-between gap-4 rounded-[22px] border px-5 py-4 text-left transition duration-200 hover:scale-[1.01] ${platform.style}`}
                      href={platform.href}
                      key={platform.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-current/20 bg-black/15">
                          <Icon size={18} />
                        </span>
                        <span className="text-sm font-semibold sm:text-base">{platform.label}</span>
                      </span>
                      <ArrowUpRight size={18} className="opacity-70" />
                    </Link>
                  );
                  })}

                  {exclusiveOfferState.isAvailable ? (
                    <Link
                      className="flex w-full items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm font-semibold text-[#f2ead8] transition duration-200 hover:scale-[1.01] hover:border-[#c9a347]/35 hover:bg-[#c9a347]/10 hover:text-[#f7f1e6]"
                      href="/exclusive"
                    >
                      {content.exclusive_cta_label}
                    </Link>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] px-5 py-5 text-sm leading-7 text-[#a9b1bb]">
                  {content.empty_state_text}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

