import type {MetadataRoute} from "next";

import {getPublicProjectPath} from "@/lib/public-projects";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {
  getEligiblePublicProjects,
  getPublishedReleaseSlugs,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {
  getPublishedArtistCatalogPaths,
  getPublishedArtistEditorialReleasePaths,
  getPublishedArtistSlugs
} from "@/lib/repositories/artist-profiles";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, releases, artists, artistReleases, artistCatalogs, siteSettings] =
    await Promise.all([
      getEligiblePublicProjects(),
      getPublishedReleaseSlugs(),
      getPublishedArtistSlugs(),
      getPublishedArtistEditorialReleasePaths(),
      getPublishedArtistCatalogPaths(),
      getSiteSettings()
    ]);
  const stablePaths = new Set(["/", "/music", "/projects", "/about", "/exclusives"]);

  if (siteSettings.site_content.commissions?.is_enabled) {
    stablePaths.add("/commissions");
  }

  if (siteSettings.site_content.vault?.is_enabled) {
    stablePaths.add("/vault");
  }

  return [
    ...Array.from(stablePaths).map((path) => ({url: getPublicSiteUrl(path)})),
    ...projects.map((project) => ({
      url: getPublicSiteUrl(getPublicProjectPath(project.slug)),
      lastModified: project.updatedAt
    })),
    ...releases.map((release) => ({
      url: getPublicSiteUrl(`/music/${encodeURIComponent(release.slug)}`),
      lastModified: release.updatedOn
    })),
    ...artists.map((artist) => ({
      url: getPublicSiteUrl(
        `/artists/${encodeURIComponent(artist.publishedSlug)}`
      ),
      lastModified: artist.updatedAt
    })),
    ...artistCatalogs.map((artist) => ({
      url: getPublicSiteUrl(
        `/artists/${encodeURIComponent(artist.artistSlug)}/releases`
      ),
      lastModified: artist.updatedAt
    })),
    ...artistReleases.map((release) => ({
      url: getPublicSiteUrl(
        `/artists/${encodeURIComponent(release.artistSlug)}/music/${encodeURIComponent(release.releaseSlug)}`
      ),
      lastModified: release.updatedAt
    }))
  ];
}
