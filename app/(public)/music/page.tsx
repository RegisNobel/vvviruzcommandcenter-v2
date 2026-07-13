export const dynamic = "force-dynamic";

import Link from "next/link";
import {ArrowUpRight} from "lucide-react";

import type {Metadata} from "next";

import {
  getEligiblePublicProjectSlugs,
  getEligiblePublicProjects,
  getPublicReleaseCategories,
  getPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {getPublicAppearsOn} from "@/lib/repositories/appears-on";
import type {ReleaseType} from "@/lib/types";

import {PublicMusicLibrary} from "@/components/public-music-library";
import {PublicAppearsOnLibrary} from "@/components/public-appears-on-library";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{category?: string; type?: string; view?: string}>;
}): Promise<Metadata> {
  const {category, type, view} = await searchParams;
  const [siteSettings, eligibleProjectSlugs] = await Promise.all([
    getSiteSettings(),
    getEligiblePublicProjectSlugs()
  ]);
  const normalizedCategory = category?.trim().toLowerCase() || "";
  const isFiltered = Boolean(normalizedCategory || type?.trim() || view?.trim());
  const canonical = eligibleProjectSlugs.some((slug) => slug === normalizedCategory)
    ? `/projects/${encodeURIComponent(normalizedCategory)}`
    : "/music";

  return {
    title: siteSettings.site_content.metadata.music_page_title,
    description: siteSettings.site_content.metadata.music_page_description,
    alternates: {canonical},
    robots: isFiltered ? {index: false, follow: true} : {index: true, follow: true}
  };
}

function normalizeReleaseType(value: string | undefined): ReleaseType | "all" {
  if (value === "nerdcore" || value === "mainstream") {
    return value;
  }

  return "all";
}

export default async function PublicMusicPage({
  searchParams
}: {
  searchParams: Promise<{category?: string; type?: string; view?: string}>;
}) {
  const {category, type, view} = await searchParams;
  const isAppearsOn = view === "appears-on";
  
  const activeCategory = category?.trim() || "";
  const activeType = activeCategory ? "all" : normalizeReleaseType(type);
  const [siteSettings, releases, appearsOnRecords, categories, eligibleProjects] = await Promise.all([
    getSiteSettings(),
    getPublishedReleases({
      ...(activeCategory ? {categorySlug: activeCategory} : {}),
      type: activeType,
      ...(activeType === "all" ? {} : {type: activeType})
    }),
    isAppearsOn ? getPublicAppearsOn() : Promise.resolve([]),
    activeCategory ? getPublicReleaseCategories() : Promise.resolve([]),
    activeCategory ? getEligiblePublicProjects() : Promise.resolve([])
  ]);
  const content = siteSettings.site_content.music;
  const platformLabels = {
    spotify: siteSettings.site_content.platforms.spotify_label,
    apple_music: siteSettings.site_content.platforms.apple_music_label,
    youtube: siteSettings.site_content.platforms.youtube_label
  };
  const filterOptions: Array<{
    href: string;
    label: string;
    value: string;
  }> = [
    {href: "/music", label: content.all_releases_label, value: "all"},
    {href: "/music?type=nerdcore", label: content.nerdcore_label, value: "nerdcore"},
    {
      href: "/music?type=mainstream",
      label: content.mainstream_label,
      value: "mainstream"
    }
  ];
  const activeFilterValue = activeCategory ? `category:${activeCategory}` : activeType;
  const activeCategoryRecord = categories.find((item) => item.slug === activeCategory);
  const activeProject = eligibleProjects.find((item) => item.slug === activeCategory);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-10">
        <section className="public-panel overflow-hidden px-5 py-9 sm:px-9 sm:py-11">
          <p className="public-eyebrow">
            {content.page_eyebrow}
          </p>
          <h1 className="public-heading mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
            {content.page_heading}
          </h1>
          <p className="public-copy mt-5 max-w-3xl text-sm leading-7 sm:text-base">
            {content.page_description}
          </p>

          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-full border border-white/10 bg-black/20 p-1">
              <Link 
                href="/music" 
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${!isAppearsOn ? "bg-[var(--brand-primary)] text-[var(--text-inverse)]" : "text-[#9da7b1] hover:text-[#fff8ec]"}`}>
                Releases
              </Link>
              <Link 
                href="/music?view=appears-on" 
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${isAppearsOn ? "bg-[var(--brand-primary)] text-[var(--text-inverse)]" : "text-[#9da7b1] hover:text-[#fff8ec]"}`}>
                Appears On
              </Link>
            </div>

            {!isAppearsOn && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => {
                    const isActive = activeFilterValue === option.value;

                    return (
                      <Link
                        className={`public-filter-chip shrink-0 snap-start sm:shrink ${
                          isActive
                            ? "public-filter-chip-active"
                            : ""
                        }`}
                        href={option.href}
                        key={option.value}
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </div>
                <Link
                  className="inline-flex min-h-9 items-center gap-2 border-l border-white/10 pl-3 text-sm font-semibold text-[#e3c16e] transition hover:text-[#fff2c8]"
                  href="/projects"
                >
                  Browse Projects
                  <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </div>
            )}
          </div>

          {!isAppearsOn && activeCategory ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#aeb6c0]">
              <span>
                Showing: <strong className="text-[#fff8ec]">{activeCategoryRecord?.name || activeCategory}</strong>
              </span>
              {activeProject ? (
                <Link
                  className="font-semibold text-[#e3c16e] transition hover:text-[#fff2c8]"
                  href={`/projects/${encodeURIComponent(activeProject.slug)}`}
                >
                  Open project hub
                </Link>
              ) : null}
              <Link className="font-semibold text-[#cbd1d8] transition hover:text-white" href="/music">
                Clear filter
              </Link>
            </div>
          ) : null}
        </section>

        {isAppearsOn ? (
          <PublicAppearsOnLibrary 
            records={appearsOnRecords} 
            emptyText="No collaborations or features published yet." 
          />
        ) : (
          <PublicMusicLibrary
            emptyText={content.empty_state_text}
            fallbackText={siteSettings.artist_name}
            platformLabels={platformLabels}
            releases={releases}
          />
        )}
      </div>
    </main>
  );
}
