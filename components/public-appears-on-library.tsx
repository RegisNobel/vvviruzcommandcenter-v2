import Image from "next/image";
import Link from "next/link";
import {ExternalLink, Play} from "lucide-react";

import {normalizeExternalUrl} from "@/lib/public-utils";
import type {AppearsOnRecord} from "@/lib/types";

const platformButtonStyles = {
  apple:
    "border-pink-400/35 bg-pink-500/10 text-pink-100 hover:border-pink-300/70 hover:bg-pink-500/20",
  spotify:
    "border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/70 hover:bg-emerald-500/20",
  youtube:
    "border-red-400/35 bg-red-500/10 text-red-100 hover:border-red-300/70 hover:bg-red-500/20",
  youtubeMusic:
    "border-red-300/30 bg-red-500/10 text-red-100 hover:border-red-300/70 hover:bg-red-500/20"
};

export function PublicAppearsOnLibrary({
  records,
  emptyText
}: {
  records: AppearsOnRecord[];
  emptyText: string;
}) {
  if (records.length === 0) {
    return (
      <div className="public-panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-[#8d949d]">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {records.map((record) => {
        const platformLinks = [
          {
            href: normalizeExternalUrl(record.spotify_url),
            key: "spotify",
            label: "SP",
            name: "Spotify",
            style: platformButtonStyles.spotify
          },
          {
            href: normalizeExternalUrl(record.apple_music_url),
            key: "apple",
            label: "AM",
            name: "Apple Music",
            style: platformButtonStyles.apple
          },
          {
            href: normalizeExternalUrl(record.youtube_music_url),
            key: "youtube-music",
            label: "YM",
            name: "YouTube Music",
            style: platformButtonStyles.youtubeMusic
          },
          {
            href: normalizeExternalUrl(record.youtube_url),
            key: "youtube",
            label: "YT",
            name: "YouTube",
            style: platformButtonStyles.youtube
          }
        ].filter((link) => link.href);
        
        return (
          <article
            key={record.id}
            className="public-release-card group flex flex-col gap-3 p-3"
          >
            <div className="public-art-frame relative aspect-square w-full overflow-hidden">
              {record.cover_art_url ? (
                <Image
                  src={record.cover_art_url}
                  alt={record.title}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1c2128]">
                  <Play className="opacity-20" size={32} />
                </div>
              )}
              
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a347] text-[#13161a] shadow-lg">
                  <ExternalLink size={20} className="ml-0.5" />
                </div>
              </div>
            </div>

            <div className="space-y-2 px-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate font-semibold tracking-[-0.01em] text-[#ece6da]">
                  {record.title}
                </h3>
                {platformLinks.length > 0 ? (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {platformLinks.map((link) => (
                      <Link
                        aria-label={`Open ${record.title} on ${link.name}`}
                        className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[10px] font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5 ${link.style}`}
                        href={link.href}
                        key={link.key}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={link.name}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="truncate text-sm text-[#8d949d] mt-0.5">
                {record.artists}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
