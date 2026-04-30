import path from "node:path";

import {unstable_cache} from "next/cache";

import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import type {SiteSettingsRecord} from "@/lib/types";

import {readSiteSettings, writeSiteSettings} from "@/lib/repositories/site-settings";
import {sanitizeAssetId} from "@/lib/server/storage";

export type ExclusiveOfferSettings = SiteSettingsRecord["site_content"]["exclusive"];

function normalizeAssetPath(value: string) {
  return value.trim();
}

export async function readExclusiveOfferSettings() {
  const siteSettings = await readSiteSettings();

  return {
    siteSettings,
    exclusive: siteSettings.site_content.exclusive
  };
}

export async function writeExclusiveOfferSettings(
  nextExclusive: Partial<ExclusiveOfferSettings>
) {
  const siteSettings = await readSiteSettings();
  const nextSettings: SiteSettingsRecord = {
    ...siteSettings,
    site_content: {
      ...siteSettings.site_content,
      exclusive: {
        ...siteSettings.site_content.exclusive,
        ...nextExclusive,
        exclusive_track_file_path:
          nextExclusive.exclusive_track_file_path !== undefined
            ? normalizeAssetPath(nextExclusive.exclusive_track_file_path)
            : siteSettings.site_content.exclusive.exclusive_track_file_path,
        exclusive_track_art_path:
          nextExclusive.exclusive_track_art_path !== undefined
            ? normalizeAssetPath(nextExclusive.exclusive_track_art_path)
            : siteSettings.site_content.exclusive.exclusive_track_art_path
      }
    },
    updated_on: new Date().toISOString()
  };

  return writeSiteSettings(nextSettings);
}

const getCachedPublicExclusiveOffer = unstable_cache(
  async () => {
  const siteSettings = await readSiteSettings();
  const offer = siteSettings.site_content.exclusive;
  const hasTrackFile = Boolean(offer.exclusive_track_file_path.trim());
  const hasTrackTitle = Boolean(offer.exclusive_track_title.trim());
  const isAvailable = offer.exclusive_track_enabled && hasTrackFile && hasTrackTitle;

  return {
    siteSettings,
    offer,
    isAvailable
  };
  },
  ["public-exclusive-offer"],
  {
    tags: [PUBLIC_CACHE_TAGS.siteSettings, PUBLIC_CACHE_TAGS.exclusiveOffer]
  }
);

export async function readPublicExclusiveOffer() {
  return getCachedPublicExclusiveOffer();
}

export async function canPubliclyReadExclusiveArtAsset(fileName: string) {
  const {offer, isAvailable} = await readPublicExclusiveOffer();

  if (!isAvailable || !offer.exclusive_track_art_path.trim()) {
    return false;
  }

  const artAssetName = sanitizeAssetId(
    path.basename(offer.exclusive_track_art_path.trim())
  );

  return artAssetName === sanitizeAssetId(fileName);
}
