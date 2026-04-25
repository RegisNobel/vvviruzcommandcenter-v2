"use client";

import {useDeferredValue, useMemo, useState} from "react";
import Link from "next/link";
import {CalendarClock, Pin, PinOff, PlusCircle, Search} from "lucide-react";
import {useRouter} from "next/navigation";

import {getReleaseProgressTone} from "@/lib/releases";
import type {ReleaseSummary} from "@/lib/types";

function formatReleaseType(value: "nerdcore" | "mainstream") {
  return value === "mainstream" ? "Mainstream" : "Nerdcore";
}

function formatReleaseDate(value: string) {
  if (!value) {
    return "No date set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function matchesReleaseSearch(release: ReleaseSummary, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    release.title,
    release.type,
    release.status,
    release.release_date
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function ReleasesPageContent({releases}: {releases: ReleaseSummary[]}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [releaseItems, setReleaseItems] = useState(releases);
  const [busyReleaseId, setBusyReleaseId] = useState<string | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim().toLowerCase();
  const filteredReleases = useMemo(
    () =>
      releaseItems.filter((release) =>
        matchesReleaseSearch(release, normalizedSearchValue)
      ),
    [normalizedSearchValue, releaseItems]
  );

  async function togglePinnedState(
    event: React.MouseEvent<HTMLButtonElement>,
    release: ReleaseSummary
  ) {
    event.stopPropagation();
    event.preventDefault();
    setBusyReleaseId(release.id);

    try {
      const response = await fetch(`/api/releases/${release.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pinned: !release.pinned
        })
      });
      const payload = (await response.json()) as {
        summary?: ReleaseSummary;
        message?: string;
      };

      if (!response.ok || !payload.summary) {
        throw new Error(payload.message ?? "Pin update failed.");
      }

      setReleaseItems((currentReleases) =>
        [...currentReleases]
          .map((currentRelease) =>
            currentRelease.id === payload.summary?.id ? payload.summary : currentRelease
          )
          .sort((left, right) => {
            if (left.pinned !== right.pinned) {
              return left.pinned ? -1 : 1;
            }

            return right.updated_on.localeCompare(left.updated_on);
          })
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Pin update failed.");
    } finally {
      setBusyReleaseId(null);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="md:sticky md:top-[89px] z-30 panel overflow-hidden border-[#32363d] bg-[#15181c]/95 px-6 py-7 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Release planning</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Releases
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Track collaborator details, lyrics, concept notes, stage completion,
                cover art, and simple task lists for every release.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="action-button-secondary" href="/admin/releases/roadmap">
                <CalendarClock size={16} />
                Roadmap
              </Link>
              <Link className="action-button-primary" href="/admin/releases/new">
                <PlusCircle size={16} />
                New Release
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
            <label className="space-y-2">
              <span className="field-label">Search Releases</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  size={16}
                />
                <input
                  className="field-input pl-11"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Find a release by title..."
                  value={searchValue}
                />
              </span>
            </label>

            <div className="rounded-[24px] border border-edge bg-panel-subtle px-4 py-4">
              <p className="field-label">Results</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {filteredReleases.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                {normalizedSearchValue ? "matching releases" : "total releases"}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {filteredReleases.map((release, index) => (
            <article
              className="panel cursor-pointer px-4 py-5 transition sm:px-6 sm:py-6 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel-subtle"
              key={release.id}
              onClick={() => router.push(`/admin/releases/${release.id}`)}
            >
              <div className="grid gap-5 lg:grid-cols-[80px_minmax(0,1.2fr)_150px_180px_minmax(240px,1fr)_132px] lg:items-center">
                <div className="pill w-fit">{index + 1}</div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="truncate text-lg font-semibold text-ink">
                      {release.title}
                    </p>
                    {release.pinned ? <span className="pill">Pinned</span> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {formatReleaseType(release.type)}
                  </p>
                </div>

                <div>
                  <p className="field-label">Stage</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {release.status}
                  </p>
                </div>

                <div>
                  <p className="field-label">Release Date</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatReleaseDate(release.release_date)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="field-label">Progress</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#23262c]">
                      <div
                        className={`h-full rounded-full ${getReleaseProgressTone(
                          release.progress_percentage
                        )}`}
                        style={{width: `${release.progress_percentage}%`}}
                      />
                    </div>
                    <span className="text-sm font-semibold text-ink">
                      {release.progress_percentage}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    className={release.pinned ? "action-button-primary" : "action-button-secondary"}
                    disabled={busyReleaseId === release.id}
                    onClick={(event) => void togglePinnedState(event, release)}
                    type="button"
                  >
                    {release.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    {busyReleaseId === release.id
                      ? "Saving..."
                      : release.pinned
                        ? "Unpin"
                        : "Pin"}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {releaseItems.length === 0 ? (
            <div className="panel px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No releases yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Create your first release to start tracking the song, visuals, promo,
                and tasks in one place.
              </p>
            </div>
          ) : null}

          {releaseItems.length > 0 && filteredReleases.length === 0 ? (
            <div className="panel px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No matching releases</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Try a different title or clear the search to see the full catalog.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
