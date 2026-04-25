import Link from "next/link";
import {ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight, CircleDashed} from "lucide-react";

import {getReleaseProgressTone} from "@/lib/releases";
import type {ReleasePlanItem} from "@/lib/types";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

function getFirstWednesday(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));

  while (date.getUTCDay() !== 3) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getReleaseMonthIndex(release: ReleasePlanItem) {
  if (!release.release_date) {
    return -1;
  }

  const date = new Date(`${release.release_date}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? -1 : date.getUTCMonth();
}

function formatReleaseDate(value: string) {
  if (!value) {
    return "Unscheduled";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatShortDate(value: string) {
  if (!value) {
    return "TBD";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatReleaseType(value: string) {
  return value === "mainstream" ? "Mainstream" : "Nerdcore";
}

function getMonthProgress(releases: ReleasePlanItem[]) {
  if (releases.length === 0) {
    return 0;
  }

  const total = releases.reduce(
    (sum, release) => sum + release.progress_percentage,
    0
  );

  return Math.round(total / releases.length);
}

function getCompletedStageCount(release: ReleasePlanItem) {
  return release.stage_steps.filter((step) => step.complete).length;
}

function getReleaseSummaryText(releases: ReleasePlanItem[]) {
  if (releases.length === 0) {
    return "???";
  }

  return releases.map((release) => release.title).join(" x ");
}

export function ReleaseRoadmap({
  releases,
  year
}: {
  releases: ReleasePlanItem[];
  year: number;
}) {
  const monthSlots = monthNames.map((monthName, monthIndex) => {
    const targetDate = getFirstWednesday(year, monthIndex);
    const releaseItems = releases
      .filter((release) => getReleaseMonthIndex(release) === monthIndex)
      .sort((left, right) => {
        if (left.release_date !== right.release_date) {
          return left.release_date.localeCompare(right.release_date);
        }

        return left.title.localeCompare(right.title);
      });

    return {
      monthName,
      targetDateKey: toDateKey(targetDate),
      releases: releaseItems,
      progress: getMonthProgress(releaseItems)
    };
  });
  const scheduledCount = releases.length;
  const blockedCount = releases.filter((release) => release.blockers.length > 0).length;
  const readySoonCount = releases.filter(
    (release) => release.progress_percentage >= 80 && release.blockers.length === 0
  ).length;
  const openMonthCount = monthSlots.filter((slot) => slot.releases.length === 0).length;

  return (
    <main className="min-h-[calc(100vh-81px)] bg-[#0f1114] px-4 py-5 text-[#e7e2d8] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel md:sticky md:top-[89px] z-30 overflow-hidden border-[#32363d] bg-[#15181c]/95 px-6 py-7 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <CalendarClock size={12} />
                {year} Roadmap
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Release Roadmap
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Target cadence is the first Wednesday, but actual dates stay flexible
                and editable from each release detail page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="action-button-secondary" href={`/admin/releases/roadmap?year=${year - 1}`}>
                <ChevronLeft size={16} />
                {year - 1}
              </Link>
              <Link className="action-button-secondary" href="/admin/releases/roadmap">
                Current Year
              </Link>
              <Link className="action-button-secondary" href={`/admin/releases/roadmap?year=${year + 1}`}>
                {year + 1}
                <ChevronRight size={16} />
              </Link>
              <Link className="action-button-secondary" href="/admin/releases">
                Full Library
              </Link>
              <Link className="action-button-primary" href="/admin/releases/new">
                New Release
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-edge bg-panel-subtle px-4 py-4">
              <p className="field-label">Scheduled Releases</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{scheduledCount}</p>
            </div>
            <div className="rounded-[24px] border border-edge bg-panel-subtle px-4 py-4">
              <p className="field-label">Monthly Slots</p>
              <p className="mt-3 text-2xl font-semibold text-ink">12</p>
            </div>
            <div className="rounded-[24px] border border-edge bg-panel-subtle px-4 py-4">
              <p className="field-label">Ready / Near Ready</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{readySoonCount}</p>
            </div>
            <div className="rounded-[24px] border border-edge bg-panel-subtle px-4 py-4">
              <p className="field-label">Open Months</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{openMonthCount}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#30343b] bg-[#111418] p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#282d33] pb-4">
            <div>
              <p className="field-label">At a glance</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">{year} Songs</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              List view follows the working roadmap. Dates are scheduled dates, not
              locked distribution rules.
            </p>
          </div>

          <div className="mt-4 divide-y divide-[#252a31]">
            {monthSlots.map((slot, index) => {
              const releaseText = getReleaseSummaryText(slot.releases);
              const monthDateText = slot.releases.length
                ? slot.releases.map((release) => formatShortDate(release.release_date)).join(" / ")
                : "TBD";

              return (
                <article
                  className="grid gap-4 py-5 lg:grid-cols-[64px_170px_minmax(0,1fr)_180px_220px] lg:items-center"
                  key={slot.monthName}
                >
                  <div className="text-2xl font-semibold text-[#a4a9b0] sm:text-3xl">
                    {index + 1}.
                  </div>

                  <div>
                    <p className="field-label">{slot.monthName}</p>
                    <p className="mt-2 text-sm font-semibold text-[#d7b45e]">
                      {monthDateText}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Target {formatShortDate(slot.targetDateKey)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xl font-semibold leading-tight text-ink sm:text-2xl lg:text-3xl">
                      {releaseText}
                    </p>
                    {slot.releases.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slot.releases.map((release) => (
                          <Link
                            className="rounded-full border border-[#3a3f46] bg-[#15181c] px-3 py-1 text-xs font-semibold text-[#d5d9df] transition hover:border-[#c9a347]/60 hover:text-[#d7b45e]"
                            href={`/admin/releases/${release.id}`}
                            key={release.id}
                          >
                            {release.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="field-label">Progress</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#23262c]">
                        <div
                          className={`h-full rounded-full ${getReleaseProgressTone(slot.progress)}`}
                          style={{width: `${slot.progress}%`}}
                        />
                      </div>
                      <span className="text-sm font-semibold text-ink">{slot.progress}%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {slot.releases.length > 0 ? (
                      slot.releases.map((release) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-[#30343b] bg-[#101215] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ca2aa]"
                          key={release.id}
                        >
                          {release.progress_percentage === 100 ? (
                            <Check size={12} />
                          ) : (
                            <CircleDashed size={12} />
                          )}
                          {formatReleaseType(release.type)} {getCompletedStageCount(release)}/
                          {release.stage_steps.length}
                        </span>
                      ))
                    ) : (
                      <span className="pill">Open slot</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {blockedCount > 0 ? (
          <section className="panel px-4 py-5 sm:px-6">
            <p className="field-label">Blocked</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {blockedCount} scheduled release{blockedCount === 1 ? "" : "s"} still need
              attention before the year plan is clean.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}



