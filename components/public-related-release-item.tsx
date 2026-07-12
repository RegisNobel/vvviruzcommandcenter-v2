import Image from "next/image";
import Link from "next/link";

import {PublicPlatformLinks} from "@/components/public-platform-links";
import {
  formatCollaboratorsList,
  formatPublicReleaseDate,
  getPublicCardTitleSize,
  getPublicReleaseDiscoveryMetadata
} from "@/lib/public-utils";
import type {PublicReleaseRecord} from "@/lib/types";

type PublicRelatedReleaseItemProps = {
  fallbackText?: string;
  platformLabels?: {
    apple_music: string;
    spotify: string;
    youtube: string;
  };
  release: PublicReleaseRecord;
};

export function PublicRelatedReleaseItem({
  fallbackText = "",
  platformLabels,
  release
}: PublicRelatedReleaseItemProps) {
  const collaboratorName = release.collaborator
    ? formatCollaboratorsList(release.collaborator_name)
    : "";
  const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);
  const titleSizeClass = getPublicCardTitleSize(release.title, "compact");

  return (
    <article className="public-release-card p-4">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
        <Link
          aria-label={`Open ${release.title}`}
          className="public-art-frame relative aspect-square overflow-hidden rounded-lg border border-white/10"
          href={`/music/${release.slug}`}
        >
          {release.cover_art_path ? (
            <Image
              alt={coverArtAltText}
              className="object-cover transition duration-500 hover:scale-[1.04]"
              fill
              sizes="88px"
              src={release.cover_art_path}
            />
          ) : (
            <div className="public-art-placeholder flex-col justify-end px-3 py-3 text-left">
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#d8b861]">
                vvviruz
              </span>
              {fallbackText ? (
                <span className="mt-1 line-clamp-2 text-[8px] uppercase tracking-[0.12em] text-[#9da7b1]">
                  {fallbackText}
                </span>
              ) : null}
            </div>
          )}
        </Link>

        <div className="min-w-0">
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.17em] text-[#9da7b1]">
            {release.type} / {formatPublicReleaseDate(release.release_date)}
          </p>
          <Link className="group block" href={`/music/${release.slug}`}>
            <h3
              className={`mt-2 truncate font-semibold leading-6 tracking-[-0.03em] text-[#fff8ec] transition group-hover:text-[#f1ca61] ${titleSizeClass}`}
              title={release.title}
            >
              {release.title}
            </h3>
          </Link>
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
          <div className="min-h-10 overflow-hidden">
            {release.public_description ? (
              <p className="line-clamp-2 text-xs leading-5 text-[#aeb6c0]">
                {release.public_description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <PublicPlatformLinks
        appleMusicUrl={release.apple_music_url}
        className="mt-4 border-t border-white/8 pt-4"
        compact
        labels={platformLabels}
        spotifyUrl={release.spotify_url}
        youtubeUrl={release.youtube_url}
      />
    </article>
  );
}
