import type {MetadataRoute} from "next";

import {getPublicProjectPath} from "@/lib/public-projects";
import {getPublicSiteUrl} from "@/lib/public-site-url";
import {
  getEligiblePublicProjects,
  getPublishedReleaseSlugs,
  getSiteSettings
} from "@/lib/repositories/public-site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, releases, siteSettings] = await Promise.all([
    getEligiblePublicProjects(),
    getPublishedReleaseSlugs(),
    getSiteSettings()
  ]);
  const stablePaths = new Set(["/", "/music", "/projects", "/about", "/links", "/exclusives"]);

  for (const hub of siteSettings.nav_hubs ?? []) {
    const path = hub.path.trim().replace(/^\/+|\/+$/g, "");

    if (path) {
      stablePaths.add(`/${path}`);
    }
  }

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
    }))
  ];
}
