export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import type {Metadata} from "next";

import {HomepageTrackedLink} from "@/components/homepage-tracked-link";
import {LockInSpotlight} from "@/components/lock-in-spotlight";
import {PublicReleaseCard} from "@/components/public-release-card";
import {getPublicProjectPath} from "@/lib/public-projects";
import {getPublicReleaseDiscoveryMetadata} from "@/lib/public-utils";
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";
import {
  getHomepageProjects,
  getLockInSpotlightRelease,
  getRandomPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const metadata = siteSettings.site_content.metadata;
  const title = metadata.site_title || siteSettings.artist_name;

  return {
    title: "Home",
    description: metadata.site_description,
    alternates: {canonical: "/"},
    openGraph: {
      type: "website",
      title,
      description: metadata.site_description,
      url: "/"
    },
    twitter: {
      card: "summary",
      title,
      description: metadata.site_description
    }
  };
}

export default async function PublicHomePage() {
  const siteSettings = await getSiteSettings();
  const [projects, spotlightRelease, randomReleasePool, exclusiveOfferState] =
    await Promise.all([
      getHomepageProjects(),
      getLockInSpotlightRelease(siteSettings.site_content.home.lock_in_spotlight_release_id),
      getRandomPublishedReleases(4),
      readPublicExclusiveOffer()
    ]);
  const content = siteSettings.site_content.home;
  const randomReleases = randomReleasePool
    .filter((release) => release.id !== spotlightRelease?.id)
    .slice(0, 3);
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  return (
    <main className="public-page-wrap">
      <div className="space-y-16 sm:space-y-20">
        <LockInSpotlight
          asHero
          ctaLabel={content.lock_in_spotlight_cta_label || "GO BEAST MODE"}
          eyebrow={content.lock_in_spotlight_eyebrow || "5:00 AM PROTOCOL"}
          headline={content.lock_in_spotlight_headline || "SURPASS YOUR LIMITS"}
          release={
            spotlightRelease
              ? {
                  coverArtAltText:
                    getPublicReleaseDiscoveryMetadata(spotlightRelease).coverArtAltText,
                  coverArtPath: spotlightRelease.cover_art_path,
                  id: spotlightRelease.id,
                  slug: spotlightRelease.slug,
                  title: spotlightRelease.title
                }
              : null
          }
          statement={content.lock_in_spotlight_statement || "IGNORE THE NOISE. LOCK IN."}
        />

        {projects.length > 0 ? (
          <section className="space-y-5">
            <div className="max-w-2xl">
              <p className="public-eyebrow">Explore projects</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold sm:text-4xl">
                The worlds inside the catalog
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
                        View project <ArrowUpRight size={15} />
                      </span>
                    </span>
                  </HomepageTrackedLink>
                );
              })}
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
