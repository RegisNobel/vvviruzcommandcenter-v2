import Link from "next/link";
import {Disc3, Music2, PlaySquare} from "lucide-react";

import {normalizeExternalUrl} from "@/lib/public-utils";

type PublicPlatformLinksProps = {
  appleMusicUrl?: string;
  className?: string;
  compact?: boolean;
  labels?: {
    apple_music: string;
    spotify: string;
    youtube: string;
  };
  spotifyUrl?: string;
  youtubeUrl?: string;
};

const platformConfig = [
  {
    key: "spotify",
    label: "Spotify",
    icon: Disc3,
    colorClassName:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-500/16"
  },
  {
    key: "apple_music",
    label: "Apple Music",
    icon: Music2,
    colorClassName:
      "border-pink-500/40 bg-pink-500/10 text-pink-200 hover:border-pink-400/60 hover:bg-pink-500/16"
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: PlaySquare,
    colorClassName:
      "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400/60 hover:bg-rose-500/16"
  }
] as const;

export function PublicPlatformLinks({
  appleMusicUrl = "",
  className = "",
  compact = false,
  labels,
  spotifyUrl = "",
  youtubeUrl = ""
}: PublicPlatformLinksProps) {
  const resolvedLabels = {
    spotify: labels?.spotify || "Spotify",
    apple_music: labels?.apple_music || "Apple Music",
    youtube: labels?.youtube || "YouTube"
  };
  const links = {
    spotify: normalizeExternalUrl(spotifyUrl),
    apple_music: normalizeExternalUrl(appleMusicUrl),
    youtube: normalizeExternalUrl(youtubeUrl)
  };
  const availablePlatforms = platformConfig.filter((platform) => links[platform.key]);
  const compactGridClassName =
    availablePlatforms.length === 3
      ? "grid-cols-3"
      : availablePlatforms.length === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div
      className={`${
        compact
          ? `grid ${compactGridClassName} gap-2`
          : "flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      } ${className}`.trim()}
    >
      {availablePlatforms.map((platform) => {
        const href = links[platform.key];

        const Icon = platform.icon;

        return (
          <Link
            className={`inline-flex min-w-0 items-center justify-center rounded-md border font-semibold transition ${platform.colorClassName} ${
              compact
                ? "w-full gap-1.5 px-2 py-1.5 text-[11px] sm:text-xs"
                : "w-full gap-2 px-4 py-2 text-sm sm:w-auto"
            }`}
            href={href}
            key={platform.key}
            rel="noreferrer"
            target="_blank"
          >
            <Icon className="shrink-0" size={compact ? 13 : 16} />
            <span className={compact ? "min-w-0 truncate whitespace-nowrap" : ""}>
              {resolvedLabels[platform.key]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
