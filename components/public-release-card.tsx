import Image from "next/image";
import Link from "next/link";

import {
  formatPublicReleaseDate,
  getPublicReleaseDiscoveryMetadata,
  formatCollaboratorsList
} from "@/lib/public-utils";
import type {PublicReleaseRecord} from "@/lib/types";

import {PublicPlatformLinks} from "@/components/public-platform-links";

export function PublicReleaseCard({
  fallbackText = "",
  platformLabels,
  priority = false,
  release
}: {
  fallbackText?: string;
  platformLabels?: {
    apple_music: string;
    spotify: string;
    youtube: string;
  };
  priority?: boolean;
  release: PublicReleaseRecord;
}) {
  const collaboratorName = release.collaborator ? formatCollaboratorsList(release.collaborator_name) : "";
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);

  return (
    <article className="public-release-card group">
      <Link className="block" href={`/music/${release.slug}`}>
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

      <div className="flex flex-1 flex-col px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9da7b1]">
          <span>{release.type}</span>
          <span className="text-[#666f7b]">/</span>
          <span>{formatPublicReleaseDate(release.release_date)}</span>
        </div>

        <div className="mt-4">
          <Link href={`/music/${release.slug}`}>
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#fff8ec] transition group-hover:text-[#f1ca61]">
              {release.title}
            </h3>
          </Link>
          {collaboratorName ? (
            <p className="mt-2 text-xs font-semibold text-[#e3c16e]">
              with {collaboratorName}
            </p>
          ) : null}
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#aeb6c0]">
            {release.public_description}
          </p>
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
