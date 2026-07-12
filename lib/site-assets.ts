export const DEFAULT_SITE_LOGO_FILE = "logo.png";
export const DEFAULT_SITE_ARTIST_IMAGE_FILE = "artist_image_about.png";

export const DEFAULT_BRAND_PILLAR_ICON_FILES = [
  "music_pillar_v2.webp",
  "fitness_pillar_v2.webp",
  "change_pillar_v2.webp",
  "nerdcore_pillar_v2.webp",
  "tech_pillar_v2.webp"
] as const;

const LEGACY_BRAND_PILLAR_FILES: Record<string, string> = {
  "music.png": DEFAULT_BRAND_PILLAR_ICON_FILES[0],
  "music_pillar.png": DEFAULT_BRAND_PILLAR_ICON_FILES[0],
  "barbell.png": DEFAULT_BRAND_PILLAR_ICON_FILES[1],
  "barbell_pillar.png": DEFAULT_BRAND_PILLAR_ICON_FILES[1],
  "levelup.png": DEFAULT_BRAND_PILLAR_ICON_FILES[2],
  "levelup_pillar.png": DEFAULT_BRAND_PILLAR_ICON_FILES[2],
  "controller.png": DEFAULT_BRAND_PILLAR_ICON_FILES[3],
  "controller_pillar.png": DEFAULT_BRAND_PILLAR_ICON_FILES[3],
  "laptop.png": DEFAULT_BRAND_PILLAR_ICON_FILES[4],
  "laptop_pillar.png": DEFAULT_BRAND_PILLAR_ICON_FILES[4]
};

export function resolveBrandPillarImageFile(fileName: string, index: number) {
  const normalized = fileName.trim();
  return LEGACY_BRAND_PILLAR_FILES[normalized] ||
    normalized ||
    DEFAULT_BRAND_PILLAR_ICON_FILES[index] ||
    DEFAULT_BRAND_PILLAR_ICON_FILES[0];
}

export function getSiteIconUrl(fileName: string) {
  return `/api/assets/site-icon/${encodeURIComponent(fileName)}`;
}
