export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft, ExternalLink} from "lucide-react";

import {getPublicBreakingBarzEntry} from "@/lib/repositories/breaking-barz";
import {readSiteSettings} from "@/lib/repositories/site-settings";

type Params = Promise<{slug: string}>;

const verificationLabels: Record<string, string> = {
  interpretation: "Interpretation",
  verified_breakdown: "Verified breakdown",
  artist_breakdown: "Artist breakdown"
};

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const [{slug}, settings] = await Promise.all([params, readSiteSettings()]);
  if (!settings.site_content.breaking_barz.is_enabled) return {robots: {index: false, follow: false}};
  const entry = await getPublicBreakingBarzEntry(slug);
  if (!entry) return {};
  const title = `${entry.songTitle}: lyric breakdown`;
  return {
    title,
    description: entry.version.summary,
    alternates: {canonical: `/breaking-barz/${entry.slug}`},
    openGraph: {type: "article", title, description: entry.version.summary, url: `/breaking-barz/${entry.slug}`}
  };
}

export default async function BreakingBarzEntryPage({params}: {params: Params}) {
  const [{slug}, settings] = await Promise.all([params, readSiteSettings()]);
  if (!settings.site_content.breaking_barz.is_enabled) notFound();
  const entry = await getPublicBreakingBarzEntry(slug);
  if (!entry) notFound();
  const destinations = [
    ["Spotify", entry.spotifyUrl],
    ["Apple Music", entry.appleMusicUrl],
    ["YouTube", entry.youtubeUrl]
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <main className="public-page-wrap">
      <article className="mx-auto max-w-4xl">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#e3c16e]" href="/breaking-barz">
          <ArrowLeft aria-hidden="true" size={16} /> Back to Breaking Barz
        </Link>
        <header className="public-panel mt-6 px-5 py-8 sm:px-9 sm:py-10">
          <div className="flex flex-wrap gap-2">
            {entry.categories.map((item) => <span className="pill" key={item.id}>{item.name}</span>)}
            <span className="pill">{verificationLabels[entry.version.verificationStatus]}</span>
          </div>
          <blockquote className="mt-7 whitespace-pre-line border-l-2 border-[#c9a347] pl-5 text-2xl font-semibold leading-10 text-[#f7f1e6] sm:text-3xl">
            {entry.version.lyricExcerpt}
          </blockquote>
          <h1 className="public-heading mt-8 text-3xl font-semibold sm:text-5xl">{entry.songTitle}</h1>
          <p className="mt-3 text-base text-[#a7b0ba]">{entry.artistNames.join(" · ")}</p>
          {destinations.length ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {destinations.map(([label, href]) => (
                <a className="public-action-secondary" href={href} key={label} rel="noreferrer" target="_blank">
                  {label} <ExternalLink aria-hidden="true" size={14} />
                </a>
              ))}
            </div>
          ) : null}
        </header>
        <section className="public-panel mt-6 px-5 py-8 sm:px-9">
          <p className="public-eyebrow">Summary</p>
          <p className="mt-4 text-lg leading-8 text-[#e8dcc3]">{entry.version.summary}</p>
          <div className="my-8 h-px bg-white/10" />
          <p className="public-eyebrow">Full breakdown</p>
          <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-[#a7b0ba]">{entry.version.breakdown}</div>
          {entry.version.sources.length ? (
            <div className="mt-9 border-t border-white/10 pt-6">
              <p className="public-eyebrow">Sources</p>
              <ul className="mt-4 space-y-2">
                {entry.version.sources.map((source) => (
                  <li key={`${source.label}-${source.url}`}>
                    <a className="inline-flex items-center gap-2 text-sm text-[#e3c16e]" href={source.url} rel="noreferrer" target="_blank">
                      {source.label} <ExternalLink aria-hidden="true" size={13} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </article>
    </main>
  );
}
