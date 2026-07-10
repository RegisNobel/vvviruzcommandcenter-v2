export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";

import type {Metadata} from "next";

import {
  getPublishedReleaseBySlug,
  getRelatedPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {
  buildPublicReleaseJsonLd,
  stringifyJsonLd
} from "@/lib/public-release-schema";
import {
  formatPublicReleaseDate,
  getPublicReleaseDiscoveryMetadata,
  getSpotifyEmbedUrl,
  getYouTubeEmbedUrl,
  formatCollaboratorsList
} from "@/lib/public-utils";

import {PublicPlatformLinks} from "@/components/public-platform-links";
import {PublicReleaseCard} from "@/components/public-release-card";

type ReleasePageParams = {
  slug: string;
};

export async function generateMetadata({
  params
}: {
  params: Promise<ReleasePageParams>;
}): Promise<Metadata> {
  const {slug} = await params;
  const [release, siteSettings] = await Promise.all([
    getPublishedReleaseBySlug(slug),
    getSiteSettings()
  ]);
  const metadata = siteSettings.site_content.metadata;

  if (!release) {
    return {
      title: metadata.release_not_found_title,
      description: metadata.release_not_found_description
    };
  }
  const {
    coverArtAltText,
    metaDescription,
    seoTitle,
    socialShareDescription,
    socialShareTitle
  } = getPublicReleaseDiscoveryMetadata(release);

  return {
    title: seoTitle,
    description: metaDescription,
    openGraph: {
      title: socialShareTitle,
      description: socialShareDescription,
      images: release.cover_art_path
        ? [
            {
              url: release.cover_art_path,
              alt: coverArtAltText
            }
          ]
        : []
    },
    twitter: {
      card: release.cover_art_path ? "summary_large_image" : "summary",
      title: socialShareTitle,
      description: socialShareDescription,
      images: release.cover_art_path ? [release.cover_art_path] : []
    }
  };
}

export default async function PublicReleaseDetailPage({
  params
}: {
  params: Promise<ReleasePageParams>;
}) {
  const {slug} = await params;
  const [release, siteSettings] = await Promise.all([
    getPublishedReleaseBySlug(slug),
    getSiteSettings()
  ]);

  if (!release) {
    notFound();
  }

  const [relatedReleases] = await Promise.all([
    getRelatedPublishedReleases(release.id, release.type)
  ]);
  const spotifyEmbedUrl = getSpotifyEmbedUrl(release.spotify_url);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(
    release.featured_video_url || release.youtube_url
  );
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);
  const aboutText = (release.public_long_description || release.public_description || "").trim();
  const hasPublicLyrics = release.public_lyrics_enabled && Boolean(release.lyrics.trim());
  const content = siteSettings.site_content.release;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  const releaseJsonLd = buildPublicReleaseJsonLd({
    artistName: siteSettings.artist_name,
    release
  });

  return (
    <main className="public-page-wrap">
      <script
        dangerouslySetInnerHTML={{__html: stringifyJsonLd(releaseJsonLd)}}
        type="application/ld+json"
      />
      <div className="space-y-12">
        <Link
          className="inline-flex items-center gap-2 border-b border-transparent pb-1 text-sm font-semibold text-[#e3c16e] transition hover:border-[rgba(246,201,69,0.7)] hover:text-[#fff2c8]"
          href="/music"
        >
          {content.back_to_music_label}
        </Link>

        <section className="public-panel overflow-hidden px-5 py-7 sm:px-9 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-12">
            <div className="public-art-frame overflow-hidden rounded-xl border border-white/10">
              <div className="relative aspect-square w-full">
                {release.cover_art_path ? (
                  <Image
                    alt={coverArtAltText}
                    className="object-cover"
                    data-release-cover
                    fill
                    priority
                    sizes="(max-width: 639px) calc(100vw - 64px), (max-width: 1023px) calc(100vw - 112px), (max-width: 1343px) calc(46vw - 74px), 542px"
                    src={release.cover_art_path}
                  />
                ) : (
                  <div className="public-art-placeholder flex-col justify-end px-7 py-7 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d8b861]">
                      vvviruz archive
                    </span>
                    <strong className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[#fff5df]">
                      {release.title}
                    </strong>
                    <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9da7b1]">
                      {siteSettings.artist_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="public-eyebrow flex flex-wrap items-center gap-3">
                <span>{release.type}</span>
                <span className="text-[#746842]">/</span>
                <span>{formatPublicReleaseDate(release.release_date)}</span>
              </div>

              <h1 className="public-heading mt-5 text-4xl font-semibold sm:text-6xl">
                {release.title}
              </h1>

              {release.collaborator && release.collaborator_name.trim() ? (
                <p className="mt-4 text-sm font-semibold text-[#e3c16e]">
                  with {formatCollaboratorsList(release.collaborator_name)}
                </p>
              ) : null}

              {release.categories.length > 0 ? (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="public-eyebrow">
                    Part of
                  </span>
                  {release.categories.map((category) => (
                    <Link
                      className="public-filter-chip public-filter-chip-active py-1 text-xs"
                      href={`/music?category=${encodeURIComponent(category.slug)}`}
                      key={category.id}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-8 border-t border-white/10 pt-5">
                <p className="public-eyebrow">Listen now</p>
                <PublicPlatformLinks
                  appleMusicUrl={release.apple_music_url}
                  className="mt-5"
                  labels={platformLabels}
                  spotifyUrl={release.spotify_url}
                  youtubeUrl={release.youtube_url}
                />
              </div>

            </div>
          </div>
        </section>

        {aboutText || hasPublicLyrics ? (
        <section className="grid gap-10 lg:grid-cols-2 lg:gap-x-16">
          {aboutText ? (
            <article className="py-1 text-left">
              <p className="public-eyebrow">About this track</p>
              <p className="mt-5 whitespace-pre-wrap text-[15px] leading-8 text-[#d7dde3] sm:text-base">
                {aboutText}
              </p>
            </article>
          ) : null}

          {hasPublicLyrics ? (
              <article className="pt-10 text-right lg:pt-1">
                <p className="public-eyebrow text-right">{content.lyrics_heading}</p>
                <pre className="mt-5 whitespace-pre-wrap text-right font-sans text-sm leading-8 text-[#d7dde3] sm:text-[15px]">
                  {release.lyrics}
                </pre>
              </article>
          ) : null}
        </section>
        ) : null}

        {spotifyEmbedUrl || youtubeEmbedUrl ? (
          <section className="grid gap-6 xl:grid-cols-2">
            {spotifyEmbedUrl ? (
              <article className="public-panel px-5 py-5">
                <p className="public-eyebrow">
                  {content.spotify_heading}
                </p>
                <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                  <iframe
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    className="h-[352px] w-full"
                    loading="lazy"
                    src={spotifyEmbedUrl}
                    title={`${release.title} on Spotify`}
                  />
                </div>
              </article>
            ) : null}

            {youtubeEmbedUrl ? (
              <article className="public-panel px-5 py-5">
                <p className="public-eyebrow">
                  {content.video_heading}
                </p>
                <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="aspect-video w-full"
                    loading="lazy"
                    src={youtubeEmbedUrl}
                    title={`${release.title} video`}
                  />
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {relatedReleases.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="public-eyebrow">
                  {content.related_releases_eyebrow}
                </p>
                <h2 className="public-heading mt-3 text-3xl font-semibold">
                  {content.related_releases_heading}
                </h2>
              </div>
              <Link
                className="border-b border-transparent pb-1 text-sm font-semibold text-[#e3c16e] transition hover:border-[rgba(246,201,69,0.7)] hover:text-[#fff2c8]"
                href="/music"
              >
                {content.related_releases_view_all_label}
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {relatedReleases.map((relatedRelease) => (
                <PublicReleaseCard
                  fallbackText={siteSettings.artist_name}
                  key={relatedRelease.id}
                  platformLabels={platformLabels}
                  release={relatedRelease}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
