import Image from "next/image";

import {
  getArtistCatalogReleaseHref,
  type ArtistProfileSnapshot
} from "@/lib/artist-profiles";

function externalLinkProps(href: string) {
  return /^https?:\/\//i.test(href)
    ? {rel: "noreferrer", target: "_blank" as const}
    : {};
}

export function PublicArtistCatalog({
  profile,
  previewToken
}: {
  profile: ArtistProfileSnapshot;
  previewToken?: string;
}) {
  const releasesById = new Map(
    profile.releaseLibrary.map((release) => [release.id, release])
  );
  const releases = profile.expansion.catalogReleaseIds.flatMap((releaseId) => {
    const release = releasesById.get(releaseId);
    return release ? [release] : [];
  });
  const profileHref = previewToken
    ? `/preview/artists/${encodeURIComponent(previewToken)}`
    : `/artists/${encodeURIComponent(profile.slug)}`;

  return (
    <main className={`artist-profile artist-theme-${profile.themeFamily}`}>
      <section className="artist-profile-catalog">
        <a className="artist-profile-catalog__back" href={profileHref}>
          ← {profile.displayName}
        </a>
        <div className="artist-profile-catalog__heading">
          <p className="artist-profile-section-label">Artist catalog</p>
          <h1>{profile.expansion.catalogTitle}</h1>
          {profile.expansion.catalogIntro ? (
            <p>{profile.expansion.catalogIntro}</p>
          ) : null}
        </div>

        <div className="artist-profile-release-grid">
          {releases.map((release) => {
            const href = getArtistCatalogReleaseHref(
              profile,
              release,
              previewToken
            );
            return (
              <a
                className="artist-profile-release-card"
                href={href}
                key={release.id}
                {...externalLinkProps(href)}
              >
                <div className="artist-profile-release-card__art">
                  {release.coverArtUrl ? (
                    <Image
                      alt={
                        release.coverArtAlt ||
                        `${release.title} cover artwork`
                      }
                      className="object-cover"
                      fill
                      sizes="(max-width: 760px) 100vw, 33vw"
                      src={release.coverArtUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="artist-profile-release-card__fallback">
                      <span>{release.type}</span>
                      <strong>{release.title}</strong>
                    </div>
                  )}
                </div>
                <div>
                  <p className="artist-profile-section-label">
                    {release.editorialEnabled
                      ? "Editorial release"
                      : release.type}
                  </p>
                  <h2>{release.title}</h2>
                  <p>
                    {release.releaseDate || release.description || "Listen now"}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
