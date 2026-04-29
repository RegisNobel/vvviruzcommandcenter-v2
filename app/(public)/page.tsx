export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {Sparkles} from "lucide-react";

import {
  getHomepageFeaturedReleases,
  getPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";

import {BrandPillarsCarousel} from "@/components/brand-pillars-carousel";
import {PublicReleaseCard} from "@/components/public-release-card";
import {PublicPlatformLinks} from "@/components/public-platform-links";

export default async function PublicHomePage() {
  const siteSettings = await getSiteSettings();
  const [heroFeaturedReleases, recentReleases, exclusiveOfferState] = await Promise.all([
    getHomepageFeaturedReleases(siteSettings.site_content.home.featured_release_ids),
    getPublishedReleases({limit: 3}),
    readPublicExclusiveOffer()
  ]);
  const content = siteSettings.site_content.home;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-[#c9a347]/18 bg-[linear-gradient(135deg,rgba(201,163,71,0.12),rgba(10,12,16,0.94)_26%,rgba(10,12,16,0.98)_100%)] px-4 py-8 sm:px-10 sm:py-14">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr] xl:items-center">
            <div className="flex justify-center xl:justify-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a347]/30 bg-[#c9a347]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b45e]">
                <Sparkles size={12} />
                {content.hero_badge_text}
              </div>
            </div>
            <div className="hidden justify-end xl:flex">
              <div className="inline-flex items-center rounded-full border border-[#c9a347]/30 bg-[#c9a347]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b45e]">
                {content.featured_releases_eyebrow}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_1fr] xl:items-stretch">
            <div className="relative h-full">
              <div className="pointer-events-none absolute -left-12 top-8 h-48 w-48 rounded-full bg-[#c9a347]/12 blur-3xl sm:h-64 sm:w-64" />
              <div className="pointer-events-none absolute left-12 top-24 h-40 w-40 rounded-full bg-white/[0.04] blur-3xl" />

              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-8">
                <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
                  <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[#f7f1e6] sm:text-6xl xl:text-7xl">
                    {siteSettings.artist_name}
                  </h1>

                  <p className="mx-auto mt-5 max-w-3xl text-lg font-semibold leading-7 text-[#e2d7bf] sm:text-2xl sm:leading-8">
                    {siteSettings.tagline}
                  </p>

                  <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                    <Link
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-[#f4eedf] transition hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10"
                      href="/music"
                    >
                      {content.secondary_cta_label}
                    </Link>

                    {exclusiveOfferState.isAvailable ? (
                      <Link
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c9a347]/36 bg-[#c9a347] px-5 py-3 text-sm font-semibold text-[#13161a] transition hover:scale-[1.01] hover:bg-[#d8b761]"
                        href="/exclusives"
                      >
                        {content.exclusive_cta_label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col gap-4">
              <div className="flex justify-center xl:hidden">
                <div className="inline-flex items-center rounded-full border border-[#c9a347]/30 bg-[#c9a347]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b45e]">
                  {content.featured_releases_eyebrow}
                </div>
              </div>
              {heroFeaturedReleases.length > 0 ? (
                <div className="grid flex-1 gap-4">
                  {heroFeaturedReleases.map((release, index) => (
                    <article
                      className="rounded-[28px] border border-white/10 bg-[#0f1217]/92 p-4"
                      key={release.id}
                    >
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 sm:grid-cols-[88px_1fr] sm:items-start">
                        <Link
                          className="relative block aspect-square overflow-hidden rounded-[20px] border border-white/10 bg-[#15181d]"
                          href={`/music/${release.slug}`}
                        >
                          {release.cover_art_path ? (
                            <Image
                              alt={`${release.title} cover art`}
                              className="object-cover"
                              fill
                              priority={index === 0}
                              sizes="88px"
                              src={release.cover_art_path}
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.18),transparent_45%),linear-gradient(180deg,#171a1f_0%,#0d0f12_100%)] px-3 text-center text-[10px] uppercase tracking-[0.24em] text-[#d0b16b]">
                              {siteSettings.artist_name}
                            </div>
                          )}
                        </Link>

                        <div>
                          <Link href={`/music/${release.slug}`}>
                            <h2 className="text-xl font-semibold tracking-tight text-[#f4eedf] transition hover:text-[#d5b15b]">
                              {release.title}
                            </h2>
                          </Link>
                          {release.collaborator && release.collaborator_name.trim() ? (
                            <p className="mt-1 text-xs font-semibold text-[#d7b45e]">
                              with {release.collaborator_name.trim()}
                            </p>
                          ) : null}
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#98a0a8]">
                            {release.public_description}
                          </p>
                          <PublicPlatformLinks
                            appleMusicUrl={release.apple_music_url}
                            className="mt-4"
                            compact
                            labels={platformLabels}
                            spotifyUrl={release.spotify_url}
                            youtubeUrl={release.youtube_url}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-[#0f1217]/92 px-5 py-5 text-sm leading-7 text-[#98a0a8]">
                  {content.featured_releases_empty_text}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d949d]">
              {content.brand_pillars_eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f4eedf]">
              {content.brand_pillars_heading}
            </h2>
          </div>
          <BrandPillarsCarousel pillars={content.brand_pillars} />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d949d]">
                {content.recent_releases_eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f4eedf]">
                {content.recent_releases_heading}
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-[#d5b15b] transition hover:text-[#eccd7d]"
              href="/music"
            >
              {content.recent_releases_view_all_label}
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recentReleases.map((release, index) => (
              <PublicReleaseCard
                fallbackText={siteSettings.artist_name}
                key={release.id}
                platformLabels={platformLabels}
                priority={index === 0}
                release={release}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

