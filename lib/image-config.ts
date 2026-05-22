/**
 * Standard image width constants to avoid generating random resized variants.
 * Consistent sizes optimize next/image caching and CDN usage.
 */
export const IMAGE_SIZES = {
  icon: 48,
  avatar: 96,
  coverThumbnail: 160,
  coverCard: 400,
  coverDetail: 800,
  hero: 1200,
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;
