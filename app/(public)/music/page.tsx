export const dynamic = "force-dynamic";

import Link from "next/link";

import type {Metadata} from "next";

import {
  getPublicReleaseCategories,
  getPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import type {ReleaseType} from "@/lib/types";

import {PublicMusicLibrary} from "@/components/public-music-library";

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
  searchParams: Promise<{category?: string; type?: string}>;
}) {
  const {category, type} = await searchParams;
  const activeCategory = category?.trim() || "";
  const activeType = activeCategory ? "all" : normalizeReleaseType(type);
  const [siteSettings, categories, releases] = await Promise.all([
    getSiteSettings(),
    getPublicReleaseCategories(),
    getPublishedReleases({
      ...(activeCategory ? {categorySlug: activeCategory} : {}),
      type: activeType,
      ...(activeType === "all" ? {} : {type: activeType})
    })
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
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="rounded-[34px] border border-white/10 bg-[#0f1217]/92 px-4 py-8 sm:px-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8d949d]">
            {content.page_eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-5xl">
            {content.page_heading}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#98a0a8] sm:text-base">
            {content.page_description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {filterOptions.map((option) => {
              const isActive = activeFilterValue === option.value;

              return (
                <Link
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-[#c9a347]/50 bg-[#c9a347]/12 text-[#f3eddf]"
                      : "border-white/10 bg-white/[0.03] text-[#d8dfe6] hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10 hover:text-[#f6f0e4]"
                  }`}
                  href={option.href}
                  key={option.value}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </section>

        <PublicMusicLibrary
          emptyText={content.empty_state_text}
          fallbackText={siteSettings.artist_name}
          platformLabels={platformLabels}
          releases={releases}
        />
      </div>
    </main>
  );
}
