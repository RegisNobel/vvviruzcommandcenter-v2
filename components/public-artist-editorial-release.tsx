import Image from "next/image";
import Link from "next/link";
import {
  AtSign,
  ExternalLink,
  Instagram,
  MessageCircle,
  Music2,
  Youtube
} from "lucide-react";

import {ArtistAnalytics} from "@/components/artist-analytics";
import {BreakingBarzExperience} from "@/components/breaking-barz-experience";
import type {
  ArtistEditorialReleaseSnapshot,
  ArtistProfileSnapshot
} from "@/lib/artist-profiles";
import {getCountryFlagImageUrl} from "@/lib/artist-profiles";
import {getYouTubeEmbedUrl} from "@/lib/public-utils";

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function externalLinkProps(href: string) {
  return /^https?:\/\//i.test(href)
    ? {rel: "noreferrer", target: "_blank" as const}
    : {};
}

function normalizePlatformKey(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

function isSocialPlatform(platform: string, label: string) {
  const keys = [normalizePlatformKey(platform), normalizePlatformKey(label)];
  return !keys.some((key) =>
    ["spotify", "apple-music", "applemusic"].includes(key)
  );
}

function getSocialIcon(platform: string, label: string) {
  const key = `${normalizePlatformKey(platform)} ${normalizePlatformKey(label)}`;
  if (key.includes("youtube")) return Youtube;
  if (key.includes("instagram")) return Instagram;
  if (key.includes("discord")) return MessageCircle;
  if (key.includes("tiktok")) return Music2;
  if (key.includes("twitter") || key.split(" ").includes("x")) return AtSign;
  return ExternalLink;
}

export function PublicArtistEditorialRelease({
  profile,
  release,
  preview
}: {
  profile: ArtistProfileSnapshot;
  release: ArtistEditorialReleaseSnapshot;
  preview?: {version: number; approvalStatus: string; token: string};
}) {
  const listeningLinks = [
    {label: "Spotify", url: release.streamingLinks.spotify},
    {label: "Apple Music", url: release.streamingLinks.appleMusic},
    {label: "YouTube", url: release.streamingLinks.youtube}
  ].filter((item) => item.url);
  const profileRows = [
    {label: "Language", values: release.languages},
    {label: "Genre", values: release.genres},
    {label: "Mood", values: release.moods},
    {label: "Themes", values: release.themes},
    {label: "Best for", values: release.listenerContexts}
  ].filter((item) => item.values.length);
  const backHref = preview
    ? `/preview/artists/${encodeURIComponent(preview.token)}`
    : `/artists/${encodeURIComponent(profile.slug)}`;
  const canShowLyrics =
    Boolean(release.lyrics.trim()) &&
    Boolean(
      preview ||
        (release.publicLyricsEnabled && release.lyricsRightsConfirmed)
    );
  const videoUrl = getYouTubeEmbedUrl(release.featuredVideoUrl);
  const locationFlagUrl = getCountryFlagImageUrl(profile.locationCountryCode);
  const socialLinks = profile.links.filter(
    (link) => link.url.trim() && isSocialPlatform(link.platform, link.label)
  );
  const artistLinksRail = socialLinks.length ? (
    <section
      aria-labelledby="artist-release-social-links-heading"
      className="lg:sticky lg:top-24"
      key="artist-release-social-links"
    >
      <div className="border-l-2 border-[var(--artist-accent)]/60 pl-4">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--artist-accent)]"
          id="artist-release-social-links-heading"
        >
          {profile.pageCopy.platformLabel || "Social links"}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
          {profile.displayName}
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {socialLinks.map((link) => {
          const Icon = getSocialIcon(link.platform, link.label);
          return (
            <a
              className="group flex min-h-14 items-center gap-3 border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:border-[var(--artist-accent)]/55 hover:bg-[var(--artist-accent)]/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--artist-accent)]"
              data-artist-event="artist_platform_click"
              data-artist-label={link.label}
              href={link.url}
              key={`${link.platform}-${link.url}`}
              {...externalLinkProps(link.url)}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-black/20 text-[var(--artist-accent)] transition group-hover:border-[var(--artist-accent)]/40">
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              <ExternalLink
                aria-hidden="true"
                className="shrink-0 text-white/30 transition group-hover:text-[var(--artist-accent)]"
                size={14}
                strokeWidth={1.8}
              />
            </a>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <main className={`artist-profile artist-theme-${profile.themeFamily}`}>
      {!preview ? (
        <ArtistAnalytics
          artistProfileId={profile.artistProfileId}
          releaseId={release.id}
          viewEventType="artist_release_view"
        />
      ) : null}
      {preview ? (
        <div className="artist-preview-banner">
          <span>Private editorial preview</span>
          <span>
            Version {preview.version} ·{" "}
            {preview.approvalStatus.replaceAll("_", " ")}
          </span>
        </div>
      ) : null}

      <article className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--artist-accent)] transition hover:text-white"
            href={backHref}
          >
            ← {profile.displayName}
          </Link>
          {profile.location ? (
            <div className="artist-profile-location-badge !static">
              {locationFlagUrl ? (
                <Image
                  alt=""
                  aria-hidden="true"
                  className="artist-profile-location-badge__flag"
                  height={18}
                  src={locationFlagUrl}
                  unoptimized
                  width={24}
                />
              ) : null}
              <span>{profile.location}</span>
            </div>
          ) : null}
        </div>

        <section className="mt-7 grid gap-8 border-y border-white/10 py-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:gap-14">
          <div className="relative aspect-square overflow-hidden border border-white/10 bg-black/30">
            {release.coverArtUrl ? (
              <Image
                alt={release.coverArtAlt || `${release.title} cover artwork`}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 42vw"
                src={release.coverArtUrl}
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--artist-accent)]">
                    Artist selection
                  </p>
                  <p className="mt-4 text-4xl font-semibold text-white">
                    {release.title}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--artist-accent)]">
              Featured release · {release.type}
              {release.releaseDate ? ` · ${formatDate(release.releaseDate)}` : ""}
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-7xl">
              {release.title}
            </h1>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-white/65">
              {release.primaryArtistName || profile.displayName}
            </p>
            {release.context ? (
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75">
                {release.context}
              </p>
            ) : null}

            {listeningLinks.length ? (
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  Listen
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {listeningLinks.map((item) => (
                    <a
                      className="artist-profile-button artist-profile-button--primary"
                      data-artist-event="artist_streaming_click"
                      data-artist-label={item.label}
                      data-release-id={release.id}
                      href={item.url}
                      key={item.label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {profileRows.length || release.credits.length ? (
              <aside className="mt-8 border border-white/10 bg-black/20 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--artist-accent)]">
                  Track profile
                </p>
                <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                  {release.credits.length ? (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Credits
                      </dt>
                      <dd className="mt-2 space-y-1 text-sm leading-6 text-white/75">
                        {release.credits.map((credit) => (
                          <p key={`${credit.name}-${credit.role}`}>
                            {credit.name} ·{" "}
                            {credit.role.toLowerCase().replaceAll("_", " ")}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {profileRows.map((row) => (
                    <div key={row.label}>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        {row.label}
                      </dt>
                      <dd className="mt-2 text-sm leading-6 text-white/75">
                        {row.values.join(", ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            ) : null}
          </div>
        </section>

        {videoUrl ? (
          <section className="border-b border-white/10 py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--artist-accent)]">
              Watch
            </p>
            <div className="mt-5 overflow-hidden border border-white/10">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="aspect-video w-full"
                loading="lazy"
                src={videoUrl}
                title={`${release.title} video`}
              />
            </div>
          </section>
        ) : null}

        {canShowLyrics ? (
          <div className="py-12">
            <BreakingBarzExperience
              annotations={release.annotations}
              lyrics={release.lyrics}
              lyricsHeading="Lyrics & Breakdowns"
              rail={artistLinksRail}
              releaseId={release.id}
              releaseTitle={release.title}
            />
          </div>
        ) : (
          <section className="py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--artist-accent)]">
              Editorial depth
            </p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">
              Lyrics and breakdowns will appear here after publication permission is confirmed.
            </p>
          </section>
        )}
      </article>
    </main>
  );
}
