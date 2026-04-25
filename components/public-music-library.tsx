"use client";

import {useDeferredValue, useMemo, useState} from "react";
import {Search} from "lucide-react";

import type {PublicReleaseRecord} from "@/lib/types";

import {PublicReleaseCard} from "@/components/public-release-card";

type PublicMusicLibraryProps = {
  emptyText: string;
  fallbackText: string;
  platformLabels: {
    apple_music: string;
    spotify: string;
    youtube: string;
  };
  releases: PublicReleaseRecord[];
};

function matchesSearch(release: PublicReleaseRecord, query: string) {
  if (!query) {
    return true;
  }

  return [
    release.title,
    release.type,
    release.public_description,
    release.public_long_description,
    release.collaborator_name,
    release.release_date
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function PublicMusicLibrary({
  emptyText,
  fallbackText,
  platformLabels,
  releases
}: PublicMusicLibraryProps) {
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();
  const filteredReleases = useMemo(
    () => releases.filter((release) => matchesSearch(release, normalizedSearchValue)),
    [normalizedSearchValue, releases]
  );

  return (
    <section className="space-y-5">
      <label className="block rounded-[26px] border border-white/10 bg-[#0f1217]/92 px-4 py-4 sm:px-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d949d]">
          Search Releases
        </span>
        <span className="relative mt-3 block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8d949d]"
            size={16}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-[#090c10] px-11 py-3 text-sm text-[#f3eddf] outline-none transition placeholder:text-[#6f7781] focus:border-[#c9a347]/60 focus:ring-2 focus:ring-[#c9a347]/20"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Find a release by title, type, or description"
            value={searchValue}
          />
        </span>
      </label>

      {releases.length > 0 && filteredReleases.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredReleases.map((release, index) => (
            <PublicReleaseCard
              fallbackText={fallbackText}
              key={release.id}
              platformLabels={platformLabels}
              priority={index < 2}
              release={release}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[30px] border border-dashed border-white/12 bg-[#0f1217]/92 px-4 py-8 text-sm leading-7 text-[#98a0a8] sm:px-8 sm:py-10">
          {releases.length === 0
            ? emptyText
            : "No releases match that search yet. Try a title, type, or keyword."}
        </div>
      )}
    </section>
  );
}
