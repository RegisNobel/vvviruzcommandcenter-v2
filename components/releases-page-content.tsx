"use client";

import {useDeferredValue, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {StickyContextBar} from "@/components/sticky-context-bar";
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
    release.release_date,
    release.collaborator_name,
    release.slug,
    release.upc,
    release.isrc
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getDiscoveryStatusClass(status: ReleaseSummary["discovery_status"]) {
  if (status === "Ready") {
    return "status-badge-ready";
  }

  if (status === "Needs polish") {
    return "status-badge-warning";
  }

  return "status-badge-danger";
}

export function ReleasesPageContent({releases}: {releases: ReleaseSummary[]}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [releaseItems, setReleaseItems] = useState(releases);
  const [busyReleaseId, setBusyReleaseId] = useState<string | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const [isCommandDockVisible, setIsCommandDockVisible] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function updateCommandDockVisibility() {
      const header = headerRef.current;

      if (!header) {
        return;
      }

      setIsCommandDockVisible(header.getBoundingClientRect().bottom <= 112);
    }

    updateCommandDockVisibility();
    window.addEventListener("scroll", updateCommandDockVisibility, {passive: true});
    window.addEventListener("resize", updateCommandDockVisibility);

    return () => {
      window.removeEventListener("scroll", updateCommandDockVisibility);
      window.removeEventListener("resize", updateCommandDockVisibility);
    };
  }, []);

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
        <section className="command-surface overflow-hidden px-5 py-6 sm:px-6" ref={headerRef}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Release planning</div>
              <h1 className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.35rem]">
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
                  placeholder="Find by title, collaborator, slug, UPC, or ISRC..."
                  value={searchValue}
                />
              </span>
            </label>

            <div className="rounded-xl border border-edge bg-surface-elevated px-4 py-4">
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


        <StickyContextBar
          className="hidden lg:block"
          isVisible={isCommandDockVisible}
          title="Releases"
          centerSlot={
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                size={16}
              />
              <input
                className="field-input pl-11"
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Find by title, collaborator, slug, UPC, or ISRC..."
                value={searchValue}
              />
            </span>
          }
          rightSlot={
            <>
              <span className="pill hidden sm:inline-flex">{filteredReleases.length} results</span>
              <Link className="action-button-secondary" href="/admin/releases/roadmap">
                <CalendarClock size={16} />
                Roadmap
              </Link>
              <Link className="action-button-primary" href="/admin/releases/new">
                <PlusCircle size={16} />
                New Release
              </Link>
            </>
          }
        />
        <section className="command-surface overflow-hidden">
          <div className="hidden border-b border-edge bg-surface-elevated px-4 py-3 text-left lg:grid lg:grid-cols-[42px_minmax(0,1.25fr)_112px_136px_minmax(180px,1fr)_minmax(210px,1fr)_112px] lg:items-center lg:gap-5">
            <span className="table-label">#</span>
            <span className="table-label">Release</span>
            <span className="table-label">Stage</span>
            <span className="table-label">Date</span>
            <span className="table-label">Internal Progress</span>
            <span className="table-label">Discovery Quality</span>
            <span className="table-label text-right">Action</span>
          </div>

          <div className="divide-y divide-edge">
            {filteredReleases.map((release, index) => (
              <article
                className="command-row cursor-pointer px-4 py-4"
                key={release.id}
                onClick={() => router.push(`/admin/releases/${release.id}`)}
              >
                <div className="grid gap-4 lg:grid-cols-[42px_minmax(0,1.25fr)_112px_136px_minmax(180px,1fr)_minmax(210px,1fr)_112px] lg:items-center lg:gap-5">
                  <div className="flex items-center gap-3 lg:block">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface-elevated text-xs font-semibold text-secondary">
                      {index + 1}
                    </div>
                    <span className="table-label lg:hidden">Release</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="truncate text-lg font-semibold text-ink">
                        {release.title}
                      </p>
                      {release.pinned ? <span className="status-badge-info">Pinned</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {formatReleaseType(release.type)}
                    </p>
                  </div>

                  <div>
                    <p className="table-label lg:hidden">Stage</p>
                    <p className="mt-1 text-sm font-semibold text-ink lg:mt-0">
                      {release.status}
                    </p>
                  </div>

                  <div>
                    <p className="table-label lg:hidden">Release Date</p>
                    <p className="mt-1 text-sm font-semibold text-ink lg:mt-0">
                      {formatReleaseDate(release.release_date)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="table-label lg:hidden">Internal Progress</p>
                    <div className="mt-2 flex items-center gap-3 lg:mt-0">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
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

                  <div className="min-w-0">
                    <p className="table-label lg:hidden">Discovery Quality</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 lg:mt-0">
                      <span className={getDiscoveryStatusClass(release.discovery_status)}>
                        {release.discovery_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {release.discovery_passed} passed / {release.discovery_warning} warning / {release.discovery_missing} missing
                    </p>
                  </div>

                  <div className="flex items-center justify-start gap-3 lg:justify-end">
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
          </div>

          {releaseItems.length === 0 ? (
            <div className="px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No releases yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Create your first release to start tracking the song, visuals, promo,
                and tasks in one place.
              </p>
            </div>
          ) : null}

          {releaseItems.length > 0 && filteredReleases.length === 0 ? (
            <div className="px-4 py-7 sm:px-6 sm:py-8">
              <p className="text-lg font-semibold text-ink">No matching releases</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Try a different title, collaborator, slug, UPC, or ISRC.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
