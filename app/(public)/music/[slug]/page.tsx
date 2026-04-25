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
  formatPublicReleaseDate,
  getSpotifyEmbedUrl,
  getYouTubeEmbedUrl
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

  return {
    title: release.title,
    description: release.public_description,
    openGraph: {
      title: release.title,
      description: release.public_description,
      images: release.cover_art_path
        ? [
            {
              url: release.cover_art_path,
              alt: `${release.title} cover art`
            }
          ]
        : []
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
  const description = release.public_long_description || release.public_description;
  const content = siteSettings.site_content.release;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#d5b15b] transition hover:text-[#eccd7d]"
          href="/music"
        >
          {content.back_to_music_label}
        </Link>

        <section className="rounded-[36px] border border-white/10 bg-[#0f1217]/92 px-4 py-7 sm:px-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#14171d]">
              <div className="relative aspect-square w-full">
                {release.cover_art_path ? (
                  <Image
                    alt={`${release.title} cover art`}
                    className="object-cover"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    src={release.cover_art_path}
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.18),transparent_42%),linear-gradient(180deg,#16191f_0%,#0d0f13_100%)] px-6 text-center text-sm uppercase tracking-[0.32em] text-[#d0b16b]">
                    {siteSettings.artist_name}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d949d]">
                <span>{release.type}</span>
                <span className="text-[#4f545c]">/</span>
                <span>{formatPublicReleaseDate(release.release_date)}</span>
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-5xl">
                {release.title}
              </h1>

              {release.collaborator && release.collaborator_name.trim() ? (
                <p className="mt-3 text-sm font-semibold text-[#d7b45e]">
                  with {release.collaborator_name.trim()}
                </p>
              ) : null}

              <p className="mt-5 max-w-3xl text-base leading-8 text-[#bac2cb]">
                {release.public_description}
              </p>

              {description !== release.public_description ? (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-[#98a0a8]">
                  {description}
                </p>
              ) : null}

              <PublicPlatformLinks
                appleMusicUrl={release.apple_music_url}
                className="mt-7"
                labels={platformLabels}
                spotifyUrl={release.spotify_url}
                youtubeUrl={release.youtube_url}
              />

              {release.public_lyrics_enabled && release.lyrics.trim() ? (
                <div className="mt-8 rounded-[26px] border border-white/10 bg-[#12151a] px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d949d]">
                    {content.lyrics_heading}
                  </p>
                  <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-[#dfe5eb]">
                    {release.lyrics}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {spotifyEmbedUrl || youtubeEmbedUrl ? (
          <section className="grid gap-6 xl:grid-cols-2">
            {spotifyEmbedUrl ? (
              <article className="rounded-[30px] border border-white/10 bg-[#0f1217]/92 px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d949d]">
                  {content.spotify_heading}
                </p>
                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
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
              <article className="rounded-[30px] border border-white/10 bg-[#0f1217]/92 px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d949d]">
                  {content.video_heading}
                </p>
                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d949d]">
                  {content.related_releases_eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f4eedf]">
                  {content.related_releases_heading}
                </h2>
              </div>
              <Link
                className="text-sm font-semibold text-[#d5b15b] transition hover:text-[#eccd7d]"
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

