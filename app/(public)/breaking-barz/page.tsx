export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowUpRight, ChevronLeft, ChevronRight, Music2} from "lucide-react";

import {
  listBreakingBarzFilterOptions,
  listPublicBreakingBarz
} from "@/lib/repositories/breaking-barz";
import {readSiteSettings} from "@/lib/repositories/site-settings";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function feedHref(input: {page?: number; artist?: string; song?: string; category?: string}) {
  const query = new URLSearchParams();
  if (input.artist) query.set("artist", input.artist);
  if (input.song) query.set("song", input.song);
  if (input.category) query.set("category", input.category);
  if ((input.page || 1) > 1) query.set("page", String(input.page));
  const value = query.toString();
  return value ? `/breaking-barz?${value}` : "/breaking-barz";
}

export async function generateMetadata({searchParams}: {searchParams: SearchParams}): Promise<Metadata> {
  const [settings, params] = await Promise.all([readSiteSettings(), searchParams]);
  const feature = settings.site_content.breaking_barz;
  const isFiltered = ["artist", "song", "category", "page"].some((key) => Boolean(first(params[key])));
  return {
    title: feature.metadata_title,
    description: feature.metadata_description,
    alternates: {canonical: "/breaking-barz"},
    robots: feature.is_enabled && !isFiltered ? {index: true, follow: true} : {index: false, follow: true},
    openGraph: {
      type: "website",
      title: feature.metadata_title,
      description: feature.metadata_description,
      url: "/breaking-barz"
    }
  };
}

export default async function BreakingBarzPage({searchParams}: {searchParams: SearchParams}) {
  const [settings, params] = await Promise.all([readSiteSettings(), searchParams]);
  const feature = settings.site_content.breaking_barz;
  if (!feature.is_enabled) notFound();

  const artist = first(params.artist).trim();
  const song = first(params.song).trim();
  const category = first(params.category).trim();
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const [feed, options] = await Promise.all([
    listPublicBreakingBarz({page, artist, song, category}),
    listBreakingBarzFilterOptions()
  ]);

  return (
    <main className="public-page-wrap">
      <div className="space-y-8">
        <section className="public-panel overflow-hidden px-5 py-9 sm:px-9 sm:py-11">
          <p className="public-eyebrow">{feature.eyebrow}</p>
          <h1 className="public-heading mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
            {feature.heading}
          </h1>
          <p className="public-copy mt-5 max-w-3xl text-sm leading-7 sm:text-base">
            {feature.description}
          </p>
          {feature.submissions_enabled ? (
            <Link className="public-action-primary mt-7" href="/breaking-barz/suggest">
              {feature.suggestion_cta_label}
            </Link>
          ) : null}
        </section>

        <form className="public-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="space-y-2">
            <span className="public-eyebrow">Artist</span>
            <select className="field-input" defaultValue={artist} name="artist">
              <option value="">All artists</option>
              {options.artists.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="public-eyebrow">Song</span>
            <select className="field-input" defaultValue={song} name="song">
              <option value="">All songs</option>
              {options.songs.map((title) => <option key={title} value={title}>{title}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="public-eyebrow">Type</span>
            <select className="field-input" defaultValue={category} name="category">
              <option value="">All types</option>
              {options.categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="public-action-primary" type="submit">Filter</button>
            {(artist || song || category) ? <Link className="public-action-secondary" href="/breaking-barz">Clear</Link> : null}
          </div>
        </form>

        {feed.entries.length ? (
          <section aria-label="Breaking Barz entries" className="grid gap-5 md:grid-cols-2">
            {feed.entries.map((entry) => (
              <article className="public-panel flex min-h-full flex-col p-5 sm:p-6" key={entry.id}>
                <div className="flex flex-wrap gap-2">
                  {entry.categories.map((item) => (
                    <Link className="pill" href={feedHref({category: item.slug})} key={item.id}>{item.name}</Link>
                  ))}
                </div>
                <blockquote className="mt-5 whitespace-pre-line border-l-2 border-[#c9a347] pl-4 text-lg font-semibold leading-8 text-[#f7f1e6]">
                  {entry.version.lyricExcerpt}
                </blockquote>
                <p className="mt-5 text-sm leading-7 text-[#a7b0ba]">{entry.version.summary}</p>
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="font-semibold text-[#f7f1e6]">{entry.songTitle}</p>
                  <p className="mt-1 text-sm text-[#8f98a5]">{entry.artistNames.join(" · ")}</p>
                </div>
                <Link className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#e3c16e]" href={`/breaking-barz/${encodeURIComponent(entry.slug)}`}>
                  Read the full breakdown <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className="public-panel px-5 py-12 text-center sm:px-8">
            <Music2 className="mx-auto text-[#8f98a5]" size={30} />
            <h2 className="public-heading mt-4 text-2xl font-semibold">No breakdowns found</h2>
            <p className="public-copy mt-3 text-sm">Try clearing a filter or check back after more entries are published.</p>
          </section>
        )}

        {(page > 1 || feed.hasMore) ? (
          <nav aria-label="Breaking Barz pages" className="flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link className="public-action-secondary" href={feedHref({page: page - 1, artist, song, category})}>
                <ChevronLeft aria-hidden="true" size={16} /> Previous
              </Link>
            ) : <span />}
            <span className="text-sm text-[#8f98a5]">Page {page}</span>
            {feed.hasMore ? (
              <Link className="public-action-secondary" href={feedHref({page: page + 1, artist, song, category})}>
                Next <ChevronRight aria-hidden="true" size={16} />
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
