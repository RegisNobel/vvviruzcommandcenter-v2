export const DEFAULT_SITE_LOGO_FILE = "logo.png";
export const DEFAULT_SITE_ARTIST_IMAGE_FILE = "artist_image_about.png";

export const DEFAULT_BRAND_PILLAR_ICON_FILES = [
  "music_pillar.png",
  "barbell_pillar.png",
  "levelup_pillar.png",
  "controller_pillar.png",
  "laptop_pillar.png"
] as const;

export function getSiteIconUrl(fileName: string) {
  return `/api/assets/site-icon/${encodeURIComponent(fileName)}`;
}
