"use server";

import {revalidateTag} from "next/cache";
import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {resolveOdesliLinks} from "@/lib/server/odesli";
import {
  deleteAppearsOn as deleteRecord,
  saveAppearsOn,
  setAppearsOnArchived
} from "@/lib/repositories/appears-on";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {adminActionError} from "@/lib/server/admin-error-response";

export async function resolveSpotifyUrlAction(url: string) {
  try {
    await requireAuthenticatedAdminSession();
    return {data: await resolveOdesliLinks(url), ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "appears-on.spotify-resolve",
      fallbackMessage: "Spotify could not be resolved right now. Check the URL and try again.",
      exposeMessage: true
    });
  }
}

export async function saveAppearsOnAction(data: any) {
  try {
    await requireAuthenticatedAdminSession();
    const id = await saveAppearsOn({
      id: data.id,
      title: data.title,
      artists: data.artists,
      cover_art_url: data.cover_art_url,
      spotify_url: data.spotify_url,
      apple_music_url: data.apple_music_url,
      youtube_music_url: data.youtube_music_url,
      youtube_url: data.youtube_url,
      release_date: data.release_date || null,
      is_published: data.is_published,
      archived_at: data.archived_at || null,
      sort_order: data.sort_order
    });

    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    return {data: id, ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "appears-on.save",
      fallbackMessage: "This appearance could not be saved.",
      exposeMessage: true
    });
  }
}

export async function setAppearsOnArchivedAction(id: string, archived: boolean) {
  try {
    await requireAuthenticatedAdminSession();
    await setAppearsOnArchived(id, archived);
    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "appears-on.archive",
      fallbackMessage: `This appearance could not be ${archived ? "archived" : "restored"}.`,
      exposeMessage: true
    });
  }
}

export async function deleteAppearsOnAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    await deleteRecord(id);
    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "appears-on.delete",
      fallbackMessage: "This appearance could not be deleted."
    });
  }
}
