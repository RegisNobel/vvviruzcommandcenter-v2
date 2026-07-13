import "server-only";

import type {PublicProjectRecord} from "@/lib/public-projects";
import {getPublicProjectPath, getPublicProjectSeriesId} from "@/lib/public-projects";
import {
  getPublicHttpUrl,
  getPublicSiteBaseUrl,
  getPublicSiteUrl
} from "@/lib/public-site-url";

type JsonObject = Record<string, unknown>;

function compactObject<T extends JsonObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined || entry === "") {
        return false;
      }

      return !Array.isArray(entry) || entry.length > 0;
    })
  ) as T;
}

export function buildPublicProjectJsonLd({
  artistName,
  project
}: {
  artistName: string;
  project: PublicProjectRecord;
}) {
  const baseUrl = getPublicSiteBaseUrl();
  const projectPath = getPublicProjectPath(project.slug);
  const projectUrl = getPublicSiteUrl(projectPath);
  const seriesId = getPublicProjectSeriesId(baseUrl, project.slug);
  const image = getPublicHttpUrl(project.representativeRelease.cover_art_path);
  const releaseItems = project.releases.map((release, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: compactObject({
      "@type": "MusicRecording",
      "@id": `${getPublicSiteUrl(`/music/${encodeURIComponent(release.slug)}`)}#music-recording`,
      name: release.title,
      url: getPublicSiteUrl(`/music/${encodeURIComponent(release.slug)}`)
    })
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      compactObject({
        "@type": "CollectionPage",
        "@id": `${projectUrl}#webpage`,
        url: projectUrl,
        name: `${project.name} by ${artistName}`,
        description: project.description,
        image,
        mainEntity: {"@id": seriesId},
        breadcrumb: {"@id": `${projectUrl}#breadcrumb`}
      }),
      compactObject({
        "@type": "CreativeWorkSeries",
        "@id": seriesId,
        name: project.name,
        url: projectUrl,
        description: project.description,
        image,
        creator: {
          "@type": "MusicGroup",
          name: artistName,
          url: baseUrl
        },
        hasPart: project.releases.map((release) => ({
          "@id": `${getPublicSiteUrl(`/music/${encodeURIComponent(release.slug)}`)}#music-recording`
        }))
      }),
      {
        "@type": "ItemList",
        "@id": `${projectUrl}#releases`,
        name: `${project.name} releases`,
        numberOfItems: releaseItems.length,
        itemListElement: releaseItems
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${projectUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: getPublicSiteUrl("/")
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Projects",
            item: getPublicSiteUrl("/projects")
          },
          {
            "@type": "ListItem",
            position: 3,
            name: project.name,
            item: projectUrl
          }
        ]
      }
    ]
  };
}
