export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, Dumbbell, Play, Sparkles} from "lucide-react";

import {HomepageTrackedLink} from "@/components/homepage-tracked-link";
import {PublicReleaseCard} from "@/components/public-release-card";
import {getHomepageStreamingTarget} from "@/lib/homepage-brand";
import {getPublicProjectPath} from "@/lib/public-projects";
import {
  formatCollaboratorsList,
  getPublicReleaseDiscoveryMetadata,
  normalizeExternalUrl
} from "@/lib/public-utils";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";
import {
  getBuiltForMotionReleases,
  getHomepageFeaturedReleases,
  getHomepageProjects,
  getRandomPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";

export default async function PublicHomePage() {
  const siteSettings = await getSiteSettings();
  const [featuredReleases, projects, motionReleases, randomReleases, exclusiveOfferState] =
    await Promise.all([
      getHomepageFeaturedReleases(siteSettings.site_content.home.featured_release_ids),
      getHomepageProjects(),
      siteSettings.site_content.home.built_for_motion_enabled
        ? getBuiltForMotionReleases(
            siteSettings.site_content.home.built_for_motion_release_ids,
            siteSettings.site_content.home.built_for_motion_release_id
          )
        : Promise.resolve([]),
      getRandomPublishedReleases(3),
      readPublicExclusiveOffer()
    ]);
  const content = siteSettings.site_content.home;
  const heroRelease = featuredReleases[0];
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  const heroStreamingTarget = heroRelease ? getHomepageStreamingTarget(heroRelease) : null;
  const heroWatchUrl = heroRelease
    ? normalizeExternalUrl(heroRelease.featured_video_url) ||
      (heroStreamingTarget?.platform !== "youtube"
        ? normalizeExternalUrl(heroRelease.youtube_url)
        : "")
    : "";
  return (
    <main className="public-page-wrap">
      <div className="space-y-16 sm:space-y-20">
        <section className="public-panel public-hero relative overflow-hidden px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(246,201,69,0.2),transparent_36%),linear-gradient(135deg,rgba(246,201,69,0.07),transparent_48%)]" />
          {heroRelease ? (
            <div className="relative grid gap-8 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:items-center md:gap-8 lg:gap-12">
              <Link
                className="public-art-stage group relative mx-auto block aspect-square w-full max-w-[280px] overflow-hidden sm:max-w-[520px] md:max-w-[360px] lg:max-w-[520px]"
                href={`/music/${heroRelease.slug}`}
              >
                {heroRelease.cover_art_path ? (
                  <Image
                    alt={getPublicReleaseDiscoveryMetadata(heroRelease).coverArtAltText}
                    className="object-cover transition duration-700 group-hover:scale-[1.025]"
                    fill
                    priority
                    sizes="(max-width: 1024px) 92vw, 520px"
                    src={heroRelease.cover_art_path}
                  />
                ) : (
                  <div className="public-art-placeholder flex-col justify-end px-8 py-8 text-left">
                    <span className="public-eyebrow">Featured release</span>
                    <strong className="mt-3 text-3xl text-[#fff5df]">{heroRelease.title}</strong>
                  </div>
                )}
              </Link>

              <div className="max-w-2xl">
                <div className="public-eyebrow inline-flex items-center gap-2 rounded-full border border-[rgba(246,201,69,0.28)] bg-[var(--brand-primary-soft)] px-3 py-1.5">
                  <Sparkles size={12} />
                  {content.hero_badge_text}
                </div>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#c8b27b]">
                  {siteSettings.artist_name}
                </p>
                <Link href={`/music/${heroRelease.slug}`}>
                  <h1 className="public-heading mt-3 text-4xl font-semibold transition hover:text-[#f1ca61] sm:text-5xl lg:text-6xl">
                    {heroRelease.title}
                  </h1>
                </Link>
                {heroRelease.collaborator && heroRelease.collaborator_name.trim() ? (
                  <p className="mt-3 text-sm font-semibold text-[#e3c16e]">
                    with {formatCollaboratorsList(heroRelease.collaborator_name)}
                  </p>
                ) : null}
                <p className="mt-5 line-clamp-3 max-w-xl text-base leading-8 text-[#b8c0ca] sm:line-clamp-none sm:text-lg">
                  {heroRelease.public_description || siteSettings.tagline}
                </p>
                {heroRelease.categories.length > 0 ? (
                  <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
                    {heroRelease.categories.slice(0, 3).map((category) => (
                      <Link
                        className="public-filter-chip text-xs"
                        href={`/music?category=${encodeURIComponent(category.slug)}`}
                        key={category.id}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <HomepageTrackedLink
                    className="public-action-primary"
                    eventType="homepage_primary_cta_click"
                    href={heroStreamingTarget?.href || `/music/${heroRelease.slug}`}
                    linkLabel={heroStreamingTarget?.label || "Explore release"}
                    linkType={heroStreamingTarget?.platform || "release_detail"}
                    releaseId={heroRelease.id}
                    target={heroStreamingTarget ? "_blank" : undefined}
                  >
                    <Play fill="currentColor" size={15} />
                    {heroStreamingTarget?.label || "Explore release"}
                  </HomepageTrackedLink>
                  {heroWatchUrl ? (
                    <HomepageTrackedLink
                      className="public-action-secondary"
                      eventType="homepage_primary_cta_click"
                      href={heroWatchUrl}
                      linkLabel="Watch video"
                      linkType="video"
                      releaseId={heroRelease.id}
                      target="_blank"
                    >
                      Watch video
                      <ArrowUpRight size={15} />
                    </HomepageTrackedLink>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative mx-auto max-w-3xl py-12 text-center sm:py-20">
              <div className="public-eyebrow inline-flex items-center gap-2">
                <Sparkles size={12} />
                {content.hero_badge_text}
              </div>
              <h1 className="public-heading mt-5 text-5xl font-semibold sm:text-7xl">
                {siteSettings.artist_name}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#c4cbd3]">
                {siteSettings.tagline}
              </p>
              <Link className="public-action-primary mt-8" href="/music">
                Explore music
              </Link>
            </div>
          )}
        </section>

        {projects.length > 0 ? (
          <section className="space-y-5">
            <div className="max-w-2xl">
              <p className="public-eyebrow">Explore projects</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold sm:text-4xl">
                Follow the worlds inside the catalog
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#aeb6c0]">
                Recurring series and connected releases, organized by the ideas that keep evolving.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {projects.map((project) => {
                const release = project.representativeRelease;
                const href = getPublicProjectPath(project.slug);

                return (
                  <HomepageTrackedLink
                    className="public-quiet-card group flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:border-[rgba(246,201,69,0.34)]"
                    eventType="project_card_click"
                    href={href}
                    key={project.id}
                    linkLabel={project.slug}
                    linkType="release_project"
                    releaseId={release.id}
                  >
                    <span className="public-art-frame relative block aspect-[4/3] overflow-hidden rounded-none border-0 border-b border-white/10">
                      {release.cover_art_path ? (
                        <Image
                          alt={getPublicReleaseDiscoveryMetadata(release).coverArtAltText}
                          className="object-cover transition duration-500 group-hover:scale-[1.035]"
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                          src={release.cover_art_path}
                        />
                      ) : (
                        <span className="public-art-placeholder px-5 text-center text-sm uppercase tracking-[0.2em]">
                          {project.name}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col px-5 py-5">
                      <span className="public-eyebrow">{project.releaseCount} releases</span>
                      <strong className="mt-3 text-xl tracking-[-0.03em] text-[#fff8ec]">
                        {project.name}
                      </strong>
                      <span className="mt-3 line-clamp-4 text-sm leading-6 text-[#aeb6c0]">
                        {project.description}
                      </span>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[#e3c16e]">
                        Enter project <ArrowUpRight size={15} />
                      </span>
                    </span>
                  </HomepageTrackedLink>
                );
              })}
            </div>
          </section>
        ) : null}

        {motionReleases.length > 0 ? (
          <section className="public-panel-quiet relative overflow-hidden px-5 py-8 sm:px-7 sm:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(246,201,69,0.11),transparent_34%),linear-gradient(90deg,rgba(246,201,69,0.04),transparent_55%)]" />
            <div className="relative">
              <div className="max-w-2xl">
                <p className="public-eyebrow inline-flex items-center gap-2">
                  <Dumbbell size={14} /> High-energy picks
                </p>
                <h2 className="public-heading mt-3 text-3xl font-semibold sm:text-4xl">
                  {content.built_for_motion_heading}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#aeb6c0]">
                  {content.built_for_motion_description}
                </p>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {motionReleases.map((release) => {
                  const streamingTarget = getHomepageStreamingTarget(release);

                  return (
                    <article
                      className="group grid grid-cols-[88px_minmax(0,1fr)] gap-4 rounded-lg border border-white/10 bg-[#0d1116]/80 p-3 transition hover:-translate-y-0.5 hover:border-[rgba(246,201,69,0.32)] sm:grid-cols-[104px_minmax(0,1fr)]"
                      key={release.id}
                    >
                      <Link
                        className="public-art-stage relative aspect-square overflow-hidden rounded-md"
                        href={`/music/${release.slug}`}
                      >
                        {release.cover_art_path ? (
                          <Image
                            alt={getPublicReleaseDiscoveryMetadata(release).coverArtAltText}
                            className="object-cover transition duration-500 group-hover:scale-[1.035]"
                            fill
                            sizes="104px"
                            src={release.cover_art_path}
                          />
                        ) : (
                          <span className="public-art-placeholder px-2 text-center text-xs">
                            {release.title}
                          </span>
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-col py-1">
                        <Link
                          className="line-clamp-2 text-base font-semibold leading-5 text-[#fff8ec] transition hover:text-[#f1ca61]"
                          href={`/music/${release.slug}`}
                        >
                          {release.title}
                        </Link>
                        {release.collaborator && release.collaborator_name.trim() ? (
                          <span className="mt-1 line-clamp-1 text-xs font-semibold text-[#d9b85e]">
                            with {formatCollaboratorsList(release.collaborator_name)}
                          </span>
                        ) : null}
                        <HomepageTrackedLink
                          className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-semibold text-[#e3c16e] hover:text-[#fff2c8]"
                          eventType="workout_collection_click"
                          href={streamingTarget?.href || `/music/${release.slug}`}
                          linkLabel={release.title}
                          linkType={streamingTarget?.platform || "release_detail"}
                          releaseId={release.id}
                          target={streamingTarget ? "_blank" : undefined}
                        >
                          Play it loud <ArrowUpRight size={13} />
                        </HomepageTrackedLink>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="public-eyebrow">{content.recent_releases_eyebrow}</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold sm:text-4xl">
                {content.recent_releases_heading}
              </h2>
              <p className="mt-2 text-sm text-[#aeb6c0]">
                Three random tracks from the vvviruz catalog. Refresh for a new signal.
              </p>
            </div>
            <Link className="text-sm font-semibold text-[#e3c16e] hover:text-[#fff2c8]" href="/music">
              {content.recent_releases_view_all_label}
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {randomReleases.map((release) => (
              <PublicReleaseCard
                fallbackText={siteSettings.artist_name}
                key={release.id}
                platformLabels={platformLabels}
                release={release}
              />
            ))}
          </div>
        </section>

        {exclusiveOfferState.offer.exclusive_track_enabled ? (
          <section className="public-panel relative overflow-hidden px-6 py-10 text-center sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(246,201,69,0.14),transparent_48%)]" />
            <div className="relative mx-auto max-w-3xl">
              <p className="public-eyebrow">From the vault</p>
              <h2 className="public-heading mt-4 text-3xl font-semibold sm:text-5xl">
                {content.exclusive_cta_heading}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#b8c0ca]">
                {content.exclusive_cta_description}
              </p>
              <HomepageTrackedLink
                className="public-action-primary mt-8"
                eventType="homepage_exclusives_click"
                href="/exclusives"
                linkLabel={content.exclusive_cta_label}
                linkType="insider_access"
              >
                {content.exclusive_cta_label}
                <ArrowUpRight size={15} />
              </HomepageTrackedLink>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
