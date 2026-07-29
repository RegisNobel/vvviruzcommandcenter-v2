export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";

import type {Metadata} from "next";

import {
  getEligiblePublicProjects,
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
  getYouTubeEmbedUrl
} from "@/lib/public-utils";
import {PublicCollaboratorCredits} from "@/components/public-collaborator-credits";

import {PublicPlatformLinks} from "@/components/public-platform-links";
import {BreakingBarzExperience} from "@/components/breaking-barz-experience";
import {PublicRelatedReleaseItem} from "@/components/public-related-release-item";
import {ProjectTrackedLink} from "@/components/public-project-analytics";
import {getPublicProjectPath} from "@/lib/public-projects";
import {listPublicAnnotations} from "@/lib/repositories/fan-content";

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
    alternates: {canonical: `/music/${encodeURIComponent(release.slug)}`},
    openGraph: {
      title: socialShareTitle,
      description: socialShareDescription,
      url: `/music/${encodeURIComponent(release.slug)}`,
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
  const [release, siteSettings, eligibleProjects] = await Promise.all([
    getPublishedReleaseBySlug(slug),
    getSiteSettings(),
    getEligiblePublicProjects()
  ]);

  if (!release) {
    notFound();
  }

  const [relatedReleases, annotations] = await Promise.all([
    getRelatedPublishedReleases(release.id, release.type),
    listPublicAnnotations(release.id)
  ]);
  const eligibleProjectSlugs = new Set<string>(eligibleProjects.map((project) => project.slug));
  const projectCategories = release.categories.filter((category) =>
    eligibleProjectSlugs.has(category.slug)
  );
  const youtubeEmbedUrl = getYouTubeEmbedUrl(
    release.featured_video_url || release.youtube_url
  );
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);
  const aboutText = (release.public_long_description || release.public_description || "").trim();
  const languages = release.languages ?? [];
  const genres = release.genres ?? [];
  const moods = release.moods ?? [];
  const themes = release.themes ?? [];
  const listenerContexts = release.listener_contexts ?? [];
  const inspirationContext = release.inspiration_context?.trim() || "";
  const trackProfileSummary = inspirationContext || aboutText;
  const profileRows = [
    {label: "Language", values: languages},
    {
      label: "Genre",
      values:
        genres.length > 0
          ? genres
          : [release.type === "nerdcore" ? "Nerdcore" : "Hip-Hop/Rap"]
    },
    {label: "Mood", values: moods},
    {label: "Themes", values: themes},
    {label: "Best for", values: listenerContexts}
  ].filter((row) => row.values.length > 0);
  const hasPublicLyrics = release.public_lyrics_enabled && Boolean(release.lyrics.trim());
  const hasRelatedReleases = relatedReleases.length > 0;
  const hasRightRail = Boolean(youtubeEmbedUrl) || hasRelatedReleases;
  const content = siteSettings.site_content.release;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  const releaseJsonLd = buildPublicReleaseJsonLd({
    artistName: siteSettings.artist_name,
    projectCategories,
    release
  });
  const rightRail = hasRightRail ? <>
    {youtubeEmbedUrl ? (
      <article className="public-panel px-5 py-5">
        <h2 className="public-eyebrow">{content.video_heading}</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl} title={`${release.title} video`}/>
        </div>
      </article>
    ) : null}
    {hasRelatedReleases ? (
      <section aria-labelledby="related-releases-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><p className="public-eyebrow">{content.related_releases_eyebrow}</p><h2 className="public-heading mt-2 text-2xl font-semibold" id="related-releases-heading">{content.related_releases_heading}</h2></div><Link className="shrink-0 border-b border-transparent pb-1 text-xs font-semibold text-[#e3c16e] transition hover:border-[rgba(246,201,69,0.7)] hover:text-[#fff2c8]" href="/music">{content.related_releases_view_all_label}</Link></div>
        <div className="space-y-3">{relatedReleases.map((relatedRelease)=><PublicRelatedReleaseItem fallbackText={siteSettings.artist_name} key={relatedRelease.id} platformLabels={platformLabels} release={relatedRelease}/>)}</div>
      </section>
    ) : null}
  </> : null;

  return (
    <main className="public-page-wrap">
      <script
        dangerouslySetInnerHTML={{__html: stringifyJsonLd(releaseJsonLd)}}
        type="application/ld+json"
      />
      <div className="space-y-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#9da7b1]">
          <Link className="transition hover:text-[#fff8ec]" href="/">Home</Link>
          <span aria-hidden="true">/</span>
          {projectCategories.length === 1 ? (
            <>
              <Link className="transition hover:text-[#fff8ec]" href="/projects">Projects</Link>
              <span aria-hidden="true">/</span>
              <Link
                className="transition hover:text-[#fff8ec]"
                href={getPublicProjectPath(projectCategories[0].slug)}
              >
                {projectCategories[0].name}
              </Link>
            </>
          ) : (
            <Link className="transition hover:text-[#fff8ec]" href="/music">
              Music
            </Link>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#e3c16e]">{release.title}</span>
        </nav>

        <section className="public-panel overflow-hidden px-5 py-7 sm:px-9 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12 xl:gap-14">
            <div className="public-art-frame overflow-hidden rounded-xl border border-white/10">
              <div className="relative aspect-square w-full">
                {release.cover_art_path ? (
                  <Image
                    alt={coverArtAltText}
                    className="object-cover"
                    data-release-cover
                    fill
                    priority
                    sizes="(max-width: 639px) calc(100vw - 64px), (max-width: 1023px) calc(100vw - 112px), (max-width: 1343px) calc(44vw - 74px), 520px"
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

            <div className="min-w-0">
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
                  <PublicCollaboratorCredits
                    collaboratorName={release.collaborator_name}
                    profiles={release.collaborator_profiles}
                  />
                </p>
              ) : null}

              {release.categories.length > 0 ? (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="public-eyebrow">
                    Part of
                  </span>
                  {release.categories.map((category) =>
                    eligibleProjectSlugs.has(category.slug) ? (
                      <ProjectTrackedLink
                        categorySlug={category.slug}
                        className="public-filter-chip public-filter-chip-active py-1 text-xs"
                        eventType="release_project_link_click"
                        href={getPublicProjectPath(category.slug)}
                        key={category.id}
                        page="release"
                        releaseId={release.id}
                        sourcePage="release-detail"
                      >
                        {category.name}
                      </ProjectTrackedLink>
                    ) : (
                      <Link
                        className="public-filter-chip py-1 text-xs"
                        href={`/music?category=${encodeURIComponent(category.slug)}`}
                        key={category.id}
                      >
                        {category.name}
                      </Link>
                    )
                  )}
                </div>
              ) : null}

              <div className="mt-8 border-t border-white/10 pt-5">
                <h2 className="public-eyebrow">Listen now</h2>
                <PublicPlatformLinks
                  appleMusicUrl={release.apple_music_url}
                  className="mt-5"
                  labels={platformLabels}
                  spotifyUrl={release.spotify_url}
                  youtubeUrl={release.youtube_url}
                />
              </div>

              {trackProfileSummary || profileRows.length > 0 ? (
                <div className="mt-8 max-w-2xl border-t border-white/10 pt-6 text-left">
                  <h2 className="public-eyebrow">Track profile</h2>
                  {trackProfileSummary ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#c8d0d9]">
                      {trackProfileSummary}
                    </p>
                  ) : null}
                  {profileRows.length > 0 ? (
                    <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                      {profileRows.map((row) => (
                        <div
                          className={row.label === "Best for" ? "sm:col-span-2" : ""}
                          key={row.label}
                        >
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d2af5a]">
                            {row.label}
                          </dt>
                          <dd className="mt-2 text-sm leading-6 text-[#d7dde3]">
                            {row.values.join(", ")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {hasPublicLyrics ? <BreakingBarzExperience annotations={annotations} lyrics={release.lyrics} lyricsHeading={content.lyrics_heading} rail={hasRightRail ? rightRail : null} releaseId={release.id} releaseTitle={release.title}/> : hasRightRail ? <aside className="mx-auto max-w-2xl space-y-10">{rightRail}</aside> : null}
      </div>
    </main>
  );
}
