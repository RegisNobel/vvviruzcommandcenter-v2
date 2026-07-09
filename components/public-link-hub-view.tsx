import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, Disc3, Music2, PlaySquare} from "lucide-react";

import {LinkPageAnalytics} from "@/components/link-page-analytics";
import {
  getPublicReleaseDiscoveryMetadata,
  normalizeExternalUrl,
  formatCollaboratorsList
} from "@/lib/public-utils";
import type {PublicReleaseRecord, SiteSettingsRecord} from "@/lib/types";

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

function appendPassthroughParams(href: string, passthroughParams: URLSearchParams) {
  if (!href || passthroughParams.size === 0) {
    return href;
  }

  try {
    const url = new URL(href);

    passthroughParams.forEach((value, key) => {
      if (!url.searchParams.has(key)) {
        url.searchParams.append(key, value);
      }
    });

    return url.toString();
  } catch {
    return href;
  }
}

interface PublicLinkHubViewProps {
  selectedRelease: PublicReleaseRecord | null;
  siteSettings: SiteSettingsRecord;
  passthroughParams: URLSearchParams;
  hubPath: string;
}

export function PublicLinkHubView({
  selectedRelease,
  siteSettings,
  passthroughParams,
  hubPath
}: PublicLinkHubViewProps) {
  const content = siteSettings.site_content.links;
  const platformContent = siteSettings.site_content.platforms;

  if (!selectedRelease) {
    return (
      <main className="public-conversion-shell">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_36%),linear-gradient(180deg,rgba(5,6,9,0.92),rgba(9,11,15,1))]" />
        <div className="relative mx-auto flex max-w-[560px] justify-center">
          <section className="public-panel w-full px-6 py-10 text-center sm:px-8 sm:py-12">
            <div className="public-eyebrow inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[#d7b663]">
              {content.badge_text}
            </div>
            <p className="mt-6 text-sm leading-7 text-[#b2bac4]">{content.empty_state_text}</p>
          </section>
        </div>
      </main>
    );
  }

  const buildButtons = [
    {
      id: "spotify",
      label: platformContent.listen_on_spotify_label || "Listen on Spotify",
      href: appendPassthroughParams(normalizeExternalUrl(selectedRelease.spotify_url), passthroughParams),
      icon: Disc3,
      style: platformAccentStyles.spotify
    },
    {
      id: "apple",
      label: platformContent.listen_on_apple_music_label || "Listen on Apple Music",
      href: appendPassthroughParams(normalizeExternalUrl(selectedRelease.apple_music_url), passthroughParams),
      icon: Music2,
      style: platformAccentStyles.apple
    },
    {
      id: "youtube-music",
      label: platformContent.listen_on_youtube_music_label || "Listen on YouTube Music",
      href: appendPassthroughParams(normalizeExternalUrl(selectedRelease.youtube_url), passthroughParams),
      icon: Disc3,
      style: platformAccentStyles.youtubeMusic
    },
    {
      id: "youtube-video",
      label: platformContent.watch_on_youtube_label || "Watch on YouTube",
      href: appendPassthroughParams(normalizeExternalUrl(selectedRelease.featured_video_url), passthroughParams),
      icon: PlaySquare,
      style: platformAccentStyles.youtubeVideo
    }
  ].filter((platform) => platform.href);

  const hasCoverArt = Boolean(selectedRelease.cover_art_path.trim());
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(selectedRelease);

  return (
    <main className="public-conversion-shell">
      {hasCoverArt ? (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 scale-[1.09]">
              <Image
                alt=""
                className="object-cover object-center blur-[36px]"
                fill
                sizes="256px"
                src={selectedRelease.cover_art_path}
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
        <LinkPageAnalytics releaseId={selectedRelease.id} releaseTitle={selectedRelease.title} hubPath={hubPath} />
        <section className="public-panel w-full px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="public-eyebrow inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[#d7b663]">
              {content.badge_text}
            </div>

            <div className="mt-6 flex justify-center">
              {hasCoverArt ? (
                <div className="public-art-stage relative h-44 w-44 overflow-hidden sm:h-52 sm:w-52">
                  <Image
                    alt={coverArtAltText}
                    className="object-cover"
                    fill
                    priority
                    sizes="208px"
                    src={selectedRelease.cover_art_path}
                  />
                </div>
              ) : (
                <div className="public-art-stage flex h-44 w-44 items-center justify-center px-6 text-center text-2xl font-semibold tracking-[-0.03em] text-[#f6efdf] sm:h-52 sm:w-52">
                  {selectedRelease.title}
                </div>
              )}
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-[#f7f1e6] sm:text-[2.5rem]">
              {selectedRelease.title}
            </h1>
            {selectedRelease.collaborator && selectedRelease.collaborator_name.trim() ? (
              <p className="mt-2 text-sm font-semibold text-[#d7b45e]">
                with {formatCollaboratorsList(selectedRelease.collaborator_name)}
              </p>
            ) : null}

            <div className="mt-8 space-y-3">
              {buildButtons.length > 0 ? (
                <>
                  {buildButtons.map((platform) => {
                    const Icon = platform.icon;

                    return (
                      <Link
                        className={`public-link-button w-full duration-200 hover:translate-y-[-1px] ${platform.style}`}
                        data-analytics-event="links_link_click"
                        data-analytics-link-label={platform.label}
                        data-analytics-link-type={platform.id}
                        data-analytics-target-url={platform.href}
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
                </>
              ) : (
                <div className="public-quiet-card border-dashed px-5 py-5 text-sm leading-7 text-[#a9b1bb]">
                  {content.empty_state_text}
                </div>
              )}
            </div>
        </section>
      </div>
    </main>
  );
}
