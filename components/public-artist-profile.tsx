import Image from "next/image";

import {ArtistAnalytics} from "@/components/artist-analytics";
import {
  getCountryFlagImageUrl,
  getArtistFeaturedItemHref,
  type ArtistProfileSnapshot
} from "@/lib/artist-profiles";

function externalLinkProps(href: string) {
  return /^https?:\/\//i.test(href)
    ? {rel: "noreferrer", target: "_blank" as const}
    : {};
}

export function PublicArtistProfile({
  profile,
  preview
}: {
  profile: ArtistProfileSnapshot;
  preview?: {version: number; approvalStatus: string; token?: string};
}) {
  const startHere = profile.featuredItems.find((item) => item.isStartHere);
  const remainingItems = profile.featuredItems.filter((item) => item !== startHere);
  const startHereHref = startHere
    ? getArtistFeaturedItemHref(profile, startHere, preview?.token)
    : "";
  const catalogHref = preview?.token
    ? `/preview/artists/${encodeURIComponent(preview.token)}/releases`
    : `/artists/${encodeURIComponent(profile.slug)}/releases`;
  const locationFlagUrl = getCountryFlagImageUrl(profile.locationCountryCode);

  return (
    <main className={`artist-profile artist-theme-${profile.themeFamily}`}>
      {!preview ? (
        <ArtistAnalytics
          artistProfileId={profile.artistProfileId}
          viewEventType="artist_profile_view"
        />
      ) : null}
      {preview ? (
        <div className="artist-preview-banner">
          <span>Private collaborator preview</span>
          <span>Version {preview.version} · {preview.approvalStatus.replaceAll("_", " ")}</span>
        </div>
      ) : null}

      <section className="artist-profile-hero">
        <div className="artist-profile-hero__signal" aria-hidden="true">
          {`${profile.pageCopy.signalLabel.toUpperCase()} // ${profile.slug.toUpperCase()}`}
        </div>
        {profile.location ? (
          <div className="artist-profile-location-badge">
            {locationFlagUrl ? (
              <Image
                alt=""
                aria-hidden="true"
                className="artist-profile-location-badge__flag"
                height={18}
                src={locationFlagUrl}
                unoptimized
                width={24}
              />
            ) : null}
            <span>{profile.location}</span>
          </div>
        ) : null}
        <div className="artist-profile-portrait">
          {profile.profileImage.url ? (
            <Image
              alt={profile.profileImage.alt || `${profile.displayName} portrait`}
              className="object-cover"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 42vw"
              src={profile.profileImage.url}
              unoptimized
            />
          ) : (
            <div className="artist-profile-portrait__fallback">
              {profile.displayName.slice(0, 2)}
            </div>
          )}
          <div className="artist-profile-portrait__scan" />
        </div>
        <div className="artist-profile-hero__copy">
          <div className="artist-profile-kicker">
            <span>{profile.pageCopy.heroEyebrow}</span>
          </div>
          <h1>{profile.displayName}</h1>
          <div className="artist-profile-actions">
            {profile.primaryCta.url ? (
              <a className="artist-profile-button artist-profile-button--primary" data-artist-event="artist_platform_click" data-artist-label={profile.primaryCta.label} href={profile.primaryCta.url} {...externalLinkProps(profile.primaryCta.url)}>
                {profile.primaryCta.label}
              </a>
            ) : null}
            {profile.secondaryCta.url ? (
              <a className="artist-profile-button" data-artist-event="artist_platform_click" data-artist-label={profile.secondaryCta.label} href={profile.secondaryCta.url} {...externalLinkProps(profile.secondaryCta.url)}>
                {profile.secondaryCta.label}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="artist-profile-body">
        <div className="artist-profile-story">
          <p className="artist-profile-section-label">{profile.pageCopy.storyLabel}</p>
          <h2>{profile.pageCopy.storyHeading}</h2>
          <p>{profile.longBio}</p>
        </div>
        <aside className="artist-profile-data-card">
          <p className="artist-profile-section-label">{profile.pageCopy.fingerprintLabel}</p>
          <p>{profile.differentiator}</p>
          <div className="artist-profile-genres">
            {profile.genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        </aside>
      </section>

      {startHere ? (
        <section className="artist-profile-feature">
          <div className="artist-profile-feature__art">
            <Image alt={startHere.coverArtAlt || `${startHere.title} cover artwork`} className="object-cover" fill sizes="(max-width: 760px) 100vw, 44vw" src={startHere.coverArtUrl} unoptimized />
          </div>
          <div className="artist-profile-feature__copy">
            <p className="artist-profile-section-label">Start here</p>
            <h2>{startHere.title}</h2>
            <p className="artist-profile-feature__subtitle">{startHere.subtitle}</p>
            <p>{startHere.description}</p>
            <a
              className="artist-profile-button artist-profile-button--primary"
              data-artist-event="artist_feature_open"
              data-artist-label={startHere.title}
              data-release-id={startHere.editorialRelease?.id || ""}
              href={startHereHref}
              {...externalLinkProps(startHereHref)}
            >
              {profile.pageCopy.featuredButtonLabel}
            </a>
          </div>
        </section>
      ) : null}

      {remainingItems.length ? (
        <section className="artist-profile-releases">
          <div className="artist-profile-releases__heading">
            <p className="artist-profile-section-label">{profile.pageCopy.selectedLabel}</p>
            <h2>{profile.pageCopy.selectedHeading}</h2>
          </div>
          <div className="artist-profile-release-grid">
            {remainingItems.map((item) => {
              const href = getArtistFeaturedItemHref(profile, item, preview?.token);
              return (
              <a className="artist-profile-release-card" data-artist-event="artist_feature_open" data-artist-label={item.title} data-release-id={item.editorialRelease?.id || ""} href={href} key={`${item.itemType}-${item.title}`} {...externalLinkProps(href)}>
                <div className="artist-profile-release-card__art">
                  {item.coverArtUrl ? (
                    <Image alt={item.coverArtAlt || `${item.title} cover artwork`} className="object-cover" fill sizes="(max-width: 760px) 100vw, 33vw" src={item.coverArtUrl} unoptimized />
                  ) : (
                    <div className="artist-profile-release-card__fallback">
                      <span>{item.eyebrow || item.itemType}</span>
                      <strong>{item.title}</strong>
                    </div>
                  )}
                </div>
                <div>
                  <p className="artist-profile-section-label">{item.eyebrow || item.itemType}</p>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </div>
              </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {profile.expansion.catalogEnabled &&
      profile.expansion.catalogReleaseIds.length ? (
        <div className="artist-profile-section-action">
          <a className="artist-profile-button" href={catalogHref}>
            {profile.expansion.catalogCtaLabel}
          </a>
        </div>
      ) : null}

      {profile.expansion.featuredStoriesEnabled && profile.featuredStories.length ? (
        <section className="artist-profile-releases artist-profile-featured-stories">
          <div className="artist-profile-releases__heading">
            <p className="artist-profile-section-label">
              {profile.expansion.featuredStoriesLabel}
            </p>
            <h2>{profile.expansion.featuredStoriesHeading}</h2>
          </div>
          <div className="artist-profile-release-grid">
            {profile.featuredStories.map((item) => {
              const href = getArtistFeaturedItemHref(profile, item, preview?.token);
              return (
                <a
                  className="artist-profile-release-card"
                  data-artist-event="artist_feature_open"
                  data-artist-label={item.title}
                  data-release-id={item.editorialRelease?.id || ""}
                  href={href}
                  key={`story-${item.releaseId || item.title}`}
                  {...externalLinkProps(href)}
                >
                  <div className="artist-profile-release-card__art">
                    {item.coverArtUrl ? (
                      <Image
                        alt={item.coverArtAlt || `${item.title} artwork`}
                        className="object-cover"
                        fill
                        sizes="(max-width: 760px) 100vw, 33vw"
                        src={item.coverArtUrl}
                        unoptimized
                      />
                    ) : (
                      <div className="artist-profile-release-card__fallback">
                        <span>{item.eyebrow || "Editorial"}</span>
                        <strong>{item.title}</strong>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="artist-profile-section-label">
                      {item.eyebrow || "Editorial"}
                    </p>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle || item.description}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="artist-profile-platforms">
        <p className="artist-profile-section-label">{profile.pageCopy.platformLabel}</p>
        <div>
          {profile.links.map((link) => (
            <a data-artist-event="artist_platform_click" data-artist-label={link.label} href={link.url} key={link.platform} {...externalLinkProps(link.url)}>
              <span>{link.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
