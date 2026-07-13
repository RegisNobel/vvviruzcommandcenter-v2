import Image from "next/image";
import Link from "next/link";

import {
  formatPublicReleaseDate,
  getPublicReleaseDiscoveryMetadata,
  getPublicCardTitleSize,
  formatCollaboratorsList
} from "@/lib/public-utils";
import type {PublicReleaseRecord} from "@/lib/types";

import {PublicPlatformLinks} from "@/components/public-platform-links";
import {ProjectTrackedLink} from "@/components/public-project-analytics";

type ProjectTrackingContext = {
  categorySlug: string;
  position: number;
  sourcePage: string;
};

export function PublicReleaseCard({
  fallbackText = "",
  platformLabels,
  priority = false,
  projectTracking,
  release
}: {
  fallbackText?: string;
  platformLabels?: {
    apple_music: string;
    spotify: string;
    youtube: string;
  };
  priority?: boolean;
  projectTracking?: ProjectTrackingContext;
  release: PublicReleaseRecord;
}) {
  const collaboratorName = release.collaborator ? formatCollaboratorsList(release.collaborator_name) : "";
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);
  const titleSizeClass = getPublicCardTitleSize(release.title);
  const releaseHref = `/music/${release.slug}`;
  const detailLinkProps = projectTracking
    ? {
        categorySlug: projectTracking.categorySlug,
        eventType: "project_hub_release_click" as const,
        href: releaseHref,
        page: "projects" as const,
        position: projectTracking.position,
        releaseId: release.id,
        sourcePage: projectTracking.sourcePage
      }
    : null;

  return (
    <article className="public-release-card group">
      {detailLinkProps ? (
        <ProjectTrackedLink className="block" {...detailLinkProps}>
          <div className="public-art-frame aspect-square">
            {release.cover_art_path ? (
              <Image
                alt={coverArtAltText}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                fill
                priority={priority}
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                src={release.cover_art_path}
              />
            ) : (
              <div className="public-art-placeholder flex-col justify-end px-5 py-5 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d8b861]">
                  vvviruz archive
                </span>
                <strong className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#fff5df]">
                  {release.title}
                </strong>
                {fallbackText ? (
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9da7b1]">
                    {fallbackText}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </ProjectTrackedLink>
      ) : (
        <Link className="block" href={releaseHref}>
        <div className="public-art-frame aspect-square">
          {release.cover_art_path ? (
            <Image
              alt={coverArtAltText}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              priority={priority}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              src={release.cover_art_path}
            />
          ) : (
            <div className="public-art-placeholder flex-col justify-end px-5 py-5 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d8b861]">
                vvviruz archive
              </span>
              <strong className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#fff5df]">
                {release.title}
              </strong>
              {fallbackText ? (
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9da7b1]">
                  {fallbackText}
                </span>
              ) : null}
            </div>
          )}
        </div>
        </Link>
      )}

      <div className="flex flex-1 flex-col px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9da7b1]">
          <span>{release.type}</span>
          <span className="text-[#666f7b]">/</span>
          <span>{formatPublicReleaseDate(release.release_date)}</span>
        </div>

        <div className="mt-4 grid grid-rows-[1.75rem_1.25rem_4.5rem] gap-y-2">
          {detailLinkProps ? (
            <ProjectTrackedLink className="block min-w-0" {...detailLinkProps}>
              <h3
                className={`truncate font-semibold leading-7 tracking-[-0.04em] text-[#fff8ec] transition group-hover:text-[#f1ca61] ${titleSizeClass}`}
                title={release.title}
              >
                {release.title}
              </h3>
            </ProjectTrackedLink>
          ) : (
            <Link className="block min-w-0" href={releaseHref}>
            <h3
              className={`truncate font-semibold leading-7 tracking-[-0.04em] text-[#fff8ec] transition group-hover:text-[#f1ca61] ${titleSizeClass}`}
              title={release.title}
            >
              {release.title}
            </h3>
            </Link>
          )}
          <div className="min-h-5 overflow-hidden">
            {collaboratorName ? (
              <p
                className="truncate text-xs font-semibold leading-5 text-[#e3c16e]"
                title={`with ${collaboratorName}`}
              >
                with {collaboratorName}
              </p>
            ) : null}
          </div>
          <div className="min-h-[4.5rem] overflow-hidden">
            {release.public_description ? (
              <p className="line-clamp-3 text-sm leading-6 text-[#aeb6c0]">
                {release.public_description}
              </p>
            ) : null}
          </div>
        </div>

        <PublicPlatformLinks
          appleMusicUrl={release.apple_music_url}
          className="mt-auto border-t border-white/8 pt-5"
          compact
          labels={platformLabels}
          spotifyUrl={release.spotify_url}
          youtubeUrl={release.youtube_url}
        />
      </div>
    </article>
  );
}
