export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {PublicReleaseCard} from "@/components/public-release-card";
import {buildPublicProjectJsonLd} from "@/lib/public-project-schema";
import {stringifyJsonLd} from "@/lib/public-release-schema";
import {getPublicProjectPath} from "@/lib/public-projects";
import {getPublicReleaseDiscoveryMetadata} from "@/lib/public-utils";
import {
  getPublicProjectBySlug,
  getSiteSettings
} from "@/lib/repositories/public-site";

type ProjectPageParams = {slug: string};

export async function generateMetadata({
  params
}: {
  params: Promise<ProjectPageParams>;
}): Promise<Metadata> {
  const {slug} = await params;
  const project = await getPublicProjectBySlug(slug);

  if (!project) {
    return {title: "Project not found", robots: {index: false, follow: true}};
  }

  const canonical = getPublicProjectPath(project.slug);
  const image = project.representativeRelease.cover_art_path;
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(project.representativeRelease);

  return {
    title: project.name,
    description: project.description,
    alternates: {canonical},
    openGraph: {
      title: project.name,
      description: project.description,
      url: canonical,
      images: image ? [{url: image, alt: `${project.name}: ${coverArtAltText}`}] : []
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: project.name,
      description: project.description,
      images: image ? [image] : []
    }
  };
}

export default async function PublicProjectPage({
  params
}: {
  params: Promise<ProjectPageParams>;
}) {
  const {slug} = await params;
  const [project, siteSettings] = await Promise.all([
    getPublicProjectBySlug(slug),
    getSiteSettings()
  ]);

  if (!project) {
    notFound();
  }

  const platformLabels = {
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    spotify: siteSettings.site_content.platforms.spotify_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(
    project.representativeRelease
  );
  const jsonLd = buildPublicProjectJsonLd({
    artistName: siteSettings.artist_name,
    project
  });

  return (
    <main className="public-page-wrap">
      <script
        dangerouslySetInnerHTML={{__html: stringifyJsonLd(jsonLd)}}
        type="application/ld+json"
      />
      <div className="space-y-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#9da7b1]">
          <Link className="transition hover:text-[#fff8ec]" href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link className="transition hover:text-[#fff8ec]" href="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#e3c16e]">{project.name}</span>
        </nav>

        <section className="public-panel overflow-hidden px-5 py-7 sm:px-9 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-12">
            <div className="public-art-frame relative aspect-square overflow-hidden rounded-xl border border-white/10">
              {project.representativeRelease.cover_art_path ? (
                <Image
                  alt={`${project.name} project artwork, represented by ${coverArtAltText}`}
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 1023px) calc(100vw - 80px), 430px"
                  src={project.representativeRelease.cover_art_path}
                />
              ) : null}
            </div>
            <div>
              <p className="public-eyebrow">vvviruz project</p>
              <h1 className="public-heading mt-5 text-4xl font-semibold sm:text-6xl">
                {project.name}
              </h1>
              <div className="public-copy mt-6 space-y-5 text-sm leading-8 sm:text-base">
                {project.description.split(/\n{2,}/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="public-filter-chip public-filter-chip-active">
                  {project.releaseCount} {project.releaseCount === 1 ? "release" : "releases"}
                </span>
                <span className="public-filter-chip">
                  Latest: {project.latestRelease.title}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="project-releases-heading" className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="public-eyebrow">The catalog</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold" id="project-releases-heading">
                {project.name} releases
              </h2>
            </div>
            <Link className="text-sm font-semibold text-[#e3c16e] hover:text-[#fff2c8]" href="/music">
              View all music
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {project.releases.map((release, index) => (
              <PublicReleaseCard
                fallbackText={siteSettings.artist_name}
                key={release.id}
                platformLabels={platformLabels}
                priority={index < 2}
                projectTracking={{
                  categorySlug: project.slug,
                  position: index + 1,
                  sourcePage: "project-hub"
                }}
                release={release}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
