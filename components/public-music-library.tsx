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
    ...release.categories.map((category) => category.name),
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
    <section className="space-y-7">
      <label className="public-panel block px-4 py-4 sm:px-5">
        <span className="public-eyebrow">
          Search Releases
        </span>
        <span className="relative mt-3 block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9da7b1]"
            size={16}
          />
          <input
            className="w-full rounded-md border border-white/10 bg-black/20 px-11 py-3 text-sm text-[#fff8ec] outline-none transition placeholder:text-[#7f8994] focus:border-[rgba(246,201,69,0.68)] focus:ring-2 focus:ring-[rgba(246,201,69,0.14)]"
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
        <div className="rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-8 text-sm leading-7 text-[#aeb6c0] sm:px-8 sm:py-10">
          {releases.length === 0
            ? emptyText
            : "No releases match that search yet. Try a title, type, or keyword."}
        </div>
      )}
    </section>
  );
}
