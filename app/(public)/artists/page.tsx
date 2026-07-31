import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight} from "lucide-react";

import type {Metadata} from "next";

import {
  getArtistProfileDescription,
  getCountryFlagImageUrl
} from "@/lib/artist-profiles";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {listPublishedArtistProfiles} from "@/lib/repositories/artist-profiles";
import {getSiteSettings} from "@/lib/repositories/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.artist_directory;

  return {
    title: content.metadata_title,
    description: content.metadata_description,
    alternates: {canonical: getPublicSiteUrl("/artists")}
  };
}

export default async function ArtistDirectoryPage() {
  const [profiles, siteSettings] = await Promise.all([
    listPublishedArtistProfiles(),
    getSiteSettings()
  ]);
  const content = siteSettings.site_content.artist_directory;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: content.heading,
    numberOfItems: profiles.length,
    itemListElement: profiles.map((profile, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: getPublicSiteUrl(`/artists/${profile.slug}`),
      item: {
        "@type": "MusicGroup",
        name: profile.displayName,
        image: profile.profileImage.url || undefined
      }
    }))
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c")
        }}
        type="application/ld+json"
      />
      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-8">
          <section className="public-panel overflow-hidden px-5 py-9 sm:px-9 sm:py-11">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d8b95f]">
              {content.eyebrow}
            </p>
            <h1 className="public-heading mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
              {content.heading}
            </h1>
            <p className="public-copy mt-5 max-w-3xl text-sm leading-7 sm:text-base">
              {content.description}
            </p>
          </section>

          {profiles.length ? (
            <section
              aria-label="Published artist profiles"
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {profiles.map((profile) => {
                const href = `/artists/${encodeURIComponent(profile.slug)}`;
                const flagUrl = getCountryFlagImageUrl(
                  profile.locationCountryCode
                );

                return (
                  <Link
                    className="public-panel group overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-[rgba(227,193,110,0.48)]"
                    href={href}
                    key={profile.artistProfileId}
                  >
                    <div className="relative aspect-[5/4] overflow-hidden border-b border-white/10 bg-black/30">
                      {profile.profileImage.url ? (
                        <Image
                          alt={
                            profile.profileImage.alt ||
                            `${profile.displayName} portrait`
                          }
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          src={profile.profileImage.url}
                          unoptimized
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-5xl font-semibold uppercase tracking-[0.12em] text-white/70">
                          {profile.displayName.slice(0, 2)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      {profile.location ? (
                        <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 border border-white/20 bg-black/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                          {flagUrl ? (
                            <Image
                              alt=""
                              aria-hidden="true"
                              height={15}
                              src={flagUrl}
                              unoptimized
                              width={20}
                            />
                          ) : null}
                          <span>{profile.location}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8b95f]">
                            {content.card_eyebrow}
                          </p>
                          <h2 className="mt-2 text-2xl font-semibold text-[#fff8ec]">
                            {profile.displayName}
                          </h2>
                        </div>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="mt-1 shrink-0 text-[#d8b95f] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          size={20}
                        />
                      </div>

                      {profile.genres.length ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.genres.slice(0, 4).map((genre) => (
                            <span
                              className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cbd1d8]"
                              key={genre}
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <p className="line-clamp-3 text-sm leading-6 text-[#aeb6c0]">
                        {getArtistProfileDescription(profile, 190)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </section>
          ) : (
            <section className="public-panel-quiet px-6 py-12 text-center sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b95f]">
                {content.empty_eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#fff8ec]">
                {content.empty_heading}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#aeb6c0]">
                {content.empty_description}
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
