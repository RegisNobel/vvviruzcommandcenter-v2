"use server";

import {revalidateTag} from "next/cache";
import {resolveOdesliLinks} from "@/lib/server/odesli";
import {saveAppearsOn, deleteAppearsOn as deleteRecord} from "@/lib/repositories/appears-on";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";

export async function resolveSpotifyUrlAction(url: string) {
  return resolveOdesliLinks(url);
}

export async function saveAppearsOnAction(data: any) {
  const id = await saveAppearsOn({
    id: data.id,
    title: data.title,
    artists: data.artists,
    cover_art_url: data.cover_art_url,
    spotify_url: data.spotify_url,
    apple_music_url: data.apple_music_url,
    youtube_music_url: data.youtube_music_url,
    youtube_url: data.youtube_url,
    is_published: data.is_published,
    sort_order: data.sort_order
  });

  revalidateTag(PUBLIC_CACHE_TAGS.releases);

  return id;
}

export async function deleteAppearsOnAction(id: string) {
  await deleteRecord(id);
  revalidateTag(PUBLIC_CACHE_TAGS.releases);
}
