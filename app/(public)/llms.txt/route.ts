export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {getPublicSiteBaseUrl} from "@/lib/public-site-url";
import {
  getEligiblePublicProjects,
  getPublishedReleases,
  getSiteSettings
} from "@/lib/repositories/public-site";
import {listPublishedArtistProfiles} from "@/lib/repositories/artist-profiles";

export async function GET() {
  const baseUrl = getPublicSiteBaseUrl();
  const [projects, releases, siteSettings, artistProfiles] = await Promise.all([
    getEligiblePublicProjects(),
    getPublishedReleases(),
    getSiteSettings(),
    listPublishedArtistProfiles()
  ]);
  const siteContent = siteSettings.site_content;
  const projectSection = projects.length
    ? projects
        .map(
          (project) =>
            `### ${project.name}\n\n- URL: ${baseUrl}/projects/${encodeURIComponent(project.slug)}\n- Published releases: ${project.releaseCount}\n\n${project.description}`
        )
        .join("\n\n")
    : "No public project hubs are currently eligible.";
  const releaseSection = releases.length
    ? releases
        .map((release) => {
          const collaborators = release.collaborator_name.trim()
            ? `\n- Collaborator(s): ${release.collaborator_name.trim()}`
            : "";
          const projectsText = release.categories.length
            ? `\n- Project(s): ${release.categories.map((category) => category.name).join(", ")}`
            : "";
          const trackProfileSummary =
            release.inspiration_context.trim() ||
            release.public_long_description.trim() ||
            release.public_description;

          return `### ${release.title}\n\n- URL: ${baseUrl}/music/${encodeURIComponent(release.slug)}\n- Release date: ${release.release_date || "Not listed"}${collaborators}${projectsText}\n\n${trackProfileSummary}`;
        })
        .join("\n\n")
    : "No published releases are currently available.";
  const artistSection = artistProfiles.length
    ? artistProfiles
        .map(
          (profile) =>
            `### ${profile.displayName}\n\n- URL: ${baseUrl}/artists/${encodeURIComponent(profile.slug)}\n- Location: ${profile.location || "Not listed"}\n- Genres: ${profile.genres.join(", ") || "Not listed"}\n\n${profile.longBio || profile.differentiator}`
        )
        .join("\n\n")
    : "No artist profiles are currently published.";
  const positioning =
    siteContent.about.statement_text.trim() ||
    siteSettings.tagline.trim() ||
    siteSettings.short_bio.trim();

  const content = `# ${siteSettings.artist_name}

> ${positioning}

## Site Overview

${siteContent.metadata.site_description}

## Key Public Pages

- Home: ${baseUrl}/
- Music Catalog: ${baseUrl}/music
- Projects: ${baseUrl}/projects
- Artist Profiles: ${baseUrl}/artists
- Links Hub: ${baseUrl}/links
- Early Access / Exclusives: ${baseUrl}/exclusives
- Vault: ${baseUrl}/vault
- Commissions: ${baseUrl}/commissions
- About: ${baseUrl}/about

## Music Catalog

The /music page is the canonical public catalog for vvviruz releases. Public release pages may include release dates, descriptions, project/category context, collaborator credits, streaming links, video links, public lyrics, and related releases.

## Published Releases

${releaseSection}

## Major Projects and Series

${projectSection}

## Published Artist Profiles

${artistSection}

## Early Access and Exclusives

The /exclusives page is used for early access previews, private preview updates, email-only delivery, notify-me flows, or exclusive fan access when enabled.

## Vault

The /vault page is a separate direct-to-fan or exclusive-content area. It is currently ${siteContent.vault.is_enabled ? "enabled" : "disabled and redirects to the active exclusives experience"}.

## Commissions

The /commissions page is the public entry point for ${siteContent.commissions.services.map((service) => service.title).join(", ")}. Requests are currently ${siteContent.commissions.is_enabled ? "open" : "closed"}.

## AI Agent Guidance

Use public vvviruz.com pages as canonical sources. Use public release detail pages as the source of truth for song descriptions, lyrics availability, collaborators, streaming links, and project/category context. Do not cite admin routes, private API routes, tokenized downloads, private preview URLs, analytics, backups, or internal Command Center data.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
