import Image from "next/image";
import Link from "next/link";

import {formatPublicReleaseDate} from "@/lib/public-utils";
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
  const collaboratorName = release.collaborator ? release.collaborator_name.trim() : "";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111317] transition hover:-translate-y-0.5 hover:border-[#c9a347]/40 hover:bg-[#15181d]">
      <Link className="block" href={`/music/${release.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-[#181b20]">
          {release.cover_art_path ? (
            <Image
              alt={`${release.title} cover art`}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              priority={priority}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              src={release.cover_art_path}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.18),transparent_45%),linear-gradient(180deg,#171a1f_0%,#0d0f12_100%)] px-6 text-center text-sm uppercase tracking-[0.28em] text-[#d0b16b]">
              {fallbackText}
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-5 py-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f959d]">
          <span>{release.type}</span>
          <span className="text-[#4f545c]">/</span>
          <span>{formatPublicReleaseDate(release.release_date)}</span>
        </div>

        <div className="mt-4">
          <Link href={`/music/${release.slug}`}>
            <h3 className="text-xl font-semibold tracking-tight text-[#f3eddf] transition group-hover:text-[#d5b15b]">
              {release.title}
            </h3>
          </Link>
          {collaboratorName ? (
            <p className="mt-2 text-xs font-semibold text-[#d7b45e]">
              with {collaboratorName}
            </p>
          ) : null}
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#98a0a8]">
            {release.public_description}
          </p>
        </div>

        <PublicPlatformLinks
          appleMusicUrl={release.apple_music_url}
          className="mt-auto pt-5"
          compact
          labels={platformLabels}
          spotifyUrl={release.spotify_url}
          youtubeUrl={release.youtube_url}
        />
      </div>
    </article>
  );
}


