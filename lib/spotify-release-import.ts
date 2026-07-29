import {
  getSuggestedReleaseSlug
} from "@/lib/releases";
import {hasReleaseCoverArt} from "@/lib/release-planning";
import type {ReleaseRecord} from "@/lib/types";

export type SpotifyReleaseMetadata = {
  title: string;
  artworkUrl: string;
  spotifyUrl: string;
  resourceType: "track" | "album";
  resourceId: string;
};

export function applySpotifyReleaseMetadata(
  release: ReleaseRecord,
  metadata: SpotifyReleaseMetadata,
  options: {isSlugLocked: boolean}
) {
  const shouldReplaceTitle =
    !release.title.trim() ||
    /^untitled(?: .+)? release$/i.test(release.title.trim());
  const shouldImportArtwork =
    Boolean(metadata.artworkUrl) && !hasReleaseCoverArt(release);
  const shouldImportAltText =
    Boolean(metadata.artworkUrl) && !release.cover_art_alt_text.trim();
  const shouldImportSeoTitle = !release.seo_title.trim();
  const shouldImportSocialTitle = !release.social_share_title.trim();
  const importedFields = ["Spotify link"];

  if (shouldReplaceTitle) importedFields.push("title");
  if (shouldImportArtwork) importedFields.push("artwork");
  if (shouldImportAltText) importedFields.push("artwork alt text");
  if (shouldImportSeoTitle) importedFields.push("SEO title");
  if (shouldImportSocialTitle) importedFields.push("social share title");

  return {
    importedFields,
    release: {
      ...release,
      title: shouldReplaceTitle ? metadata.title : release.title,
      slug:
        shouldReplaceTitle && options.isSlugLocked
          ? getSuggestedReleaseSlug(metadata.title)
          : release.slug,
      streaming_links: {
        ...release.streaming_links,
        spotify: metadata.spotifyUrl
      },
      cover_art: shouldImportArtwork
        ? {
            id: `spotify-${metadata.resourceType}-${metadata.resourceId}`,
            fileName: `${getSuggestedReleaseSlug(metadata.title)}-spotify-artwork.jpg`,
            url: metadata.artworkUrl,
            mimeType: "image/jpeg"
          }
        : release.cover_art,
      cover_art_path: shouldImportArtwork
        ? metadata.artworkUrl
        : release.cover_art_path,
      cover_art_alt_text: shouldImportAltText
        ? `${metadata.title} cover artwork`
        : release.cover_art_alt_text,
      seo_title: shouldImportSeoTitle ? metadata.title : release.seo_title,
      social_share_title: shouldImportSocialTitle
        ? metadata.title
        : release.social_share_title
    } satisfies ReleaseRecord
  };
}
