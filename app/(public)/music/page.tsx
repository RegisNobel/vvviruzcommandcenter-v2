export const dynamic = "force-dynamic";

import Link from "next/link";

import type {Metadata} from "next";

import {
  getPublicReleaseCategories,
  getPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {getPublicAppearsOn} from "@/lib/repositories/appears-on";
import type {ReleaseType} from "@/lib/types";

import {PublicMusicLibrary} from "@/components/public-music-library";
import {PublicAppearsOnLibrary} from "@/components/public-appears-on-library";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();

  return {
    title: siteSettings.site_content.metadata.music_page_title,
    description: siteSettings.site_content.metadata.music_page_description
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
  const [siteSettings, categories, releases, appearsOnRecords] = await Promise.all([
    getSiteSettings(),
    getPublicReleaseCategories(),
    getPublishedReleases({
      ...(activeCategory ? {categorySlug: activeCategory} : {}),
      type: activeType,
      ...(activeType === "all" ? {} : {type: activeType})
    }),
    isAppearsOn ? getPublicAppearsOn() : Promise.resolve([])
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
    },
    ...categories.map((releaseCategory) => ({
      href: `/music?category=${encodeURIComponent(releaseCategory.slug)}`,
      label: releaseCategory.name,
      value: `category:${releaseCategory.slug}`
    }))
  ];
  const activeFilterValue = activeCategory ? `category:${activeCategory}` : activeType;

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
              <div className="relative -mr-5 sm:mr-0">
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pr-0">
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
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#111419] to-transparent sm:hidden"
                />
              </div>
            )}
          </div>
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
