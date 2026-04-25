export const DEFAULT_SITE_LOGO_FILE = "logo.png";
export const DEFAULT_SITE_ARTIST_IMAGE_FILE = "artist_image.png";

export const DEFAULT_BRAND_PILLAR_ICON_FILES = [
  "music.png",
  "barbell.png",
  "levelup.png",
  "controller.png",
  "laptop.png"
] as const;

export function getSiteIconUrl(fileName: string) {
  return `/api/assets/site-icon/${encodeURIComponent(fileName)}`;
}
