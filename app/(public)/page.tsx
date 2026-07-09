export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {Sparkles} from "lucide-react";

import {
  getHomepageFeaturedReleases,
  getRandomPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {getPublicReleaseDiscoveryMetadata, formatCollaboratorsList} from "@/lib/public-utils";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";

import {BrandPillarsCarousel} from "@/components/brand-pillars-carousel";
import {PublicReleaseCard} from "@/components/public-release-card";
import {PublicPlatformLinks} from "@/components/public-platform-links";

export default async function PublicHomePage() {
  const siteSettings = await getSiteSettings();
  const [heroFeaturedReleases, recentReleases, exclusiveOfferState] = await Promise.all([
    getHomepageFeaturedReleases(siteSettings.site_content.home.featured_release_ids),
    getRandomPublishedReleases(3),
    readPublicExclusiveOffer()
  ]);
  const content = siteSettings.site_content.home;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-12">
        <section className="public-panel overflow-hidden border-[rgba(246,201,69,0.2)] bg-[linear-gradient(135deg,rgba(246,201,69,0.13),rgba(10,12,16,0.94)_28%,rgba(10,12,16,0.98)_100%)] px-5 py-9 sm:px-10 sm:py-14">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr] xl:items-center">
            <div className="flex justify-center xl:justify-start">
              <div className="public-eyebrow inline-flex items-center gap-2 rounded-full border border-[rgba(246,201,69,0.3)] bg-[var(--brand-primary-soft)] px-3 py-1">
                <Sparkles size={12} />
                {content.hero_badge_text}
              </div>
            </div>
            <div className="hidden justify-end xl:flex">
              <div className="public-eyebrow inline-flex items-center rounded-full border border-[rgba(246,201,69,0.3)] bg-[var(--brand-primary-soft)] px-3 py-1">
                {content.featured_releases_eyebrow}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_1fr] xl:items-stretch">
            <div className="relative h-full">
              <div className="pointer-events-none absolute -left-12 top-8 h-48 w-48 rounded-full bg-[#c9a347]/12 blur-3xl sm:h-64 sm:w-64" />
              <div className="pointer-events-none absolute left-12 top-24 h-40 w-40 rounded-full bg-white/[0.04] blur-3xl" />

              <div className="relative flex h-full flex-col items-center justify-center px-4 py-7 text-center sm:px-8 sm:py-8">
                <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
                  <h1 className="public-heading text-5xl font-semibold sm:text-6xl xl:text-7xl">
                    {siteSettings.artist_name}
                  </h1>

                  <p className="mx-auto mt-5 max-w-3xl text-lg font-semibold leading-7 text-[#e9dcc0] sm:text-2xl sm:leading-8">
                    {siteSettings.tagline}
                  </p>

                  <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                    <Link
                      className="public-action-secondary"
                      href="/music"
                    >
                      {content.secondary_cta_label}
                    </Link>

                    {exclusiveOfferState.isAvailable ? (
                      <Link
                        className="public-action-primary"
                        href="/exclusives"
                      >
                        {content.exclusive_cta_label}
                      </Link>
                    ) : null}

                    <Link
                      className="public-action-secondary"
                      href="/commissions"
                    >
                      Commissions
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col gap-4">
              <div className="flex justify-center xl:hidden">
                <div className="public-eyebrow inline-flex items-center rounded-full border border-[rgba(246,201,69,0.3)] bg-[var(--brand-primary-soft)] px-3 py-1">
                  {content.featured_releases_eyebrow}
                </div>
              </div>
              {heroFeaturedReleases.length > 0 ? (
                <div className="grid flex-1 gap-4">
                  {heroFeaturedReleases.map((release, index) => {
                    const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);

                    return (
                    <article
                      className="rounded-xl border border-white/10 bg-black/15 p-4"
                      key={release.id}
                    >
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 sm:grid-cols-[88px_1fr] sm:items-start">
                        <Link
                          className="public-art-frame relative block aspect-square overflow-hidden rounded-lg border border-white/10"
                          href={`/music/${release.slug}`}
                        >
                          {release.cover_art_path ? (
                            <Image
                              alt={coverArtAltText}
                              className="object-cover"
                              fill
                              priority={index === 0}
                              sizes="88px"
                              src={release.cover_art_path}
                            />
                          ) : (
                            <div className="public-art-placeholder justify-center px-3 text-center text-[10px] uppercase tracking-[0.24em]">
                              {siteSettings.artist_name}
                            </div>
                          )}
                        </Link>

                        <div>
                          <Link href={`/music/${release.slug}`}>
                            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#fff8ec] transition hover:text-[#f1ca61]">
                              {release.title}
                            </h2>
                          </Link>
                          {release.collaborator && release.collaborator_name.trim() ? (
                            <p className="mt-1 text-xs font-semibold text-[#e3c16e]">
                              with {formatCollaboratorsList(release.collaborator_name)}
                            </p>
                          ) : null}
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#aeb6c0]">
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
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/15 px-5 py-5 text-sm leading-7 text-[#aeb6c0]">
                  {content.featured_releases_empty_text}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="public-eyebrow">
              {content.brand_pillars_eyebrow}
            </p>
            <h2 className="public-heading mt-3 text-3xl font-semibold">
              {content.brand_pillars_heading}
            </h2>
          </div>
          <BrandPillarsCarousel pillars={content.brand_pillars} />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="public-eyebrow">
                {content.recent_releases_eyebrow}
              </p>
              <h2 className="public-heading mt-3 text-3xl font-semibold">
                {content.recent_releases_heading}
              </h2>
              <p className="mt-2 text-sm text-[#aeb6c0]">
                Three random tracks from the vvviruz catalog. Refresh for a new signal.
              </p>
            </div>
            <Link
              className="border-b border-transparent pb-1 text-sm font-semibold text-[#e3c16e] transition hover:border-[rgba(246,201,69,0.7)] hover:text-[#fff2c8]"
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
