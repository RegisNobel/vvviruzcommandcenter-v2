"use server";

import {revalidatePath, revalidateTag} from "next/cache";

import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {
  archiveArtistIntake,
  archiveExpiredArtistIntakes,
  convertArtistIntakeToDraft,
  createArtistIntakeInvite,
  markArtistIntakeReviewed,
  reopenArtistIntake,
  rotateArtistIntakeInvite
} from "@/lib/repositories/artist-intakes";
import {
  createArtistRelease,
  createArtistPreviewVersion,
  promoteArtistHomepageItemToEditorial,
  publishArtistProfile,
  recordArtistProfileApproval,
  revokeArtistPreviewVersion,
  saveArtistProfile,
  setArtistReleaseHomepagePlacement,
  type ArtistReleaseHomepagePlacement,
  type PromoteArtistHomepageItemInput,
  type SaveArtistProfileInput
} from "@/lib/repositories/artist-profiles";
import {adminActionError} from "@/lib/server/admin-error-response";

function refreshArtists() {
  revalidatePath("/admin/artists");
  revalidateTag(PUBLIC_CACHE_TAGS.artists);
  revalidateTag(PUBLIC_CACHE_TAGS.releases);
}

export async function createArtistIntakeInviteAction(data: {
  artistName: string;
  inviteeEmail: string;
  expiresInDays?: number;
}) {
  try {
    await requireAuthenticatedAdminSession();
    const invite = await createArtistIntakeInvite(data);
    revalidatePath("/admin/artists/intake");
    return {ok: true as const, data: invite};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.create",
      fallbackMessage: "The artist intake invitation could not be created.",
      exposeMessage: true
    });
  }
}

export async function markArtistIntakeReviewedAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    await markArtistIntakeReviewed(id);
    revalidatePath("/admin/artists/intake");
    revalidatePath(`/admin/artists/intake/${id}`);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.review",
      fallbackMessage: "The intake could not be marked reviewed.",
      exposeMessage: true
    });
  }
}

export async function convertArtistIntakeToDraftAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    const artistProfileId = await convertArtistIntakeToDraft(id);
    refreshArtists();
    revalidatePath("/admin/artists/intake");
    revalidatePath(`/admin/artists/intake/${id}`);
    return {ok: true as const, data: {artistProfileId}};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.convert",
      fallbackMessage: "The reviewed intake could not be converted to a draft.",
      exposeMessage: true
    });
  }
}

export async function reopenArtistIntakeAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    await reopenArtistIntake(id);
    revalidatePath("/admin/artists/intake");
    revalidatePath(`/admin/artists/intake/${id}`);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.reopen",
      fallbackMessage: "The intake could not be reopened.",
      exposeMessage: true
    });
  }
}

export async function rotateArtistIntakeInviteAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    const invite = await rotateArtistIntakeInvite(id);
    revalidatePath("/admin/artists/intake");
    revalidatePath(`/admin/artists/intake/${id}`);
    return {ok: true as const, data: invite};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.rotate",
      fallbackMessage: "The intake invitation could not be regenerated.",
      exposeMessage: true
    });
  }
}

export async function archiveArtistIntakeAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    await archiveArtistIntake(id);
    revalidatePath("/admin/artists/intake");
    revalidatePath(`/admin/artists/intake/${id}`);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.archive",
      fallbackMessage: "The intake could not be archived.",
      exposeMessage: true
    });
  }
}

export async function archiveExpiredArtistIntakesAction() {
  try {
    await requireAuthenticatedAdminSession();
    const count = await archiveExpiredArtistIntakes();
    revalidatePath("/admin/artists/intake");
    return {ok: true as const, data: {count}};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.intake.cleanup",
      fallbackMessage: "Expired intake uploads could not be cleaned up.",
      exposeMessage: true
    });
  }
}

export async function createArtistReleaseAction(artistProfileId: string) {
  try {
    await requireAuthenticatedAdminSession();
    const releaseId = await createArtistRelease(artistProfileId);
    refreshArtists();
    return {ok: true as const, data: releaseId};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.release.create",
      fallbackMessage: "The artist release could not be created.",
      exposeMessage: true
    });
  }
}

export async function promoteArtistHomepageItemToEditorialAction(
  data: PromoteArtistHomepageItemInput
) {
  try {
    await requireAuthenticatedAdminSession();
    const releaseId = await promoteArtistHomepageItemToEditorial(data);
    refreshArtists();
    revalidatePath(`/admin/artists/${data.artistProfileId}`);
    return {ok: true as const, data: releaseId};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.release.promote",
      fallbackMessage: "The homepage release could not be promoted.",
      exposeMessage: true
    });
  }
}

export async function setArtistReleaseHomepagePlacementAction(data: {
  artistProfileId: string;
  releaseId: string;
  placement: ArtistReleaseHomepagePlacement;
}) {
  try {
    await requireAuthenticatedAdminSession();
    const placement = await setArtistReleaseHomepagePlacement(data);
    refreshArtists();
    revalidatePath(`/admin/artists/${data.artistProfileId}`);
    revalidatePath(
      `/admin/artists/${data.artistProfileId}/releases/${data.releaseId}`
    );
    return {ok: true as const, data: placement};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.release.placement",
      fallbackMessage: "The homepage placement could not be updated.",
      exposeMessage: true
    });
  }
}

export async function saveArtistProfileAction(data: SaveArtistProfileInput) {
  try {
    await requireAuthenticatedAdminSession();
    const id = await saveArtistProfile(data);
    refreshArtists();
    return {ok: true as const, data: id};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.save",
      fallbackMessage: "This artist profile could not be saved.",
      exposeMessage: true
    });
  }
}

export async function createArtistPreviewAction(artistProfileId: string) {
  try {
    await requireAuthenticatedAdminSession();
    const preview = await createArtistPreviewVersion(artistProfileId);
    refreshArtists();
    return {
      ok: true as const,
      data: {
        ...preview,
        path: `/preview/artists/${preview.token}`
      }
    };
  } catch (error) {
    return adminActionError(error, {
      context: "artists.preview",
      fallbackMessage: "A private preview could not be created.",
      exposeMessage: true
    });
  }
}

export async function approveArtistProfileAction(data: {
  artistProfileId: string;
  versionId: string;
  decidedByEmail: string;
  notes?: string;
}) {
  try {
    await requireAuthenticatedAdminSession();
    await recordArtistProfileApproval(data);
    refreshArtists();
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.approve",
      fallbackMessage: "Approval could not be recorded.",
      exposeMessage: true
    });
  }
}

export async function revokeArtistPreviewAction(data: {
  artistProfileId: string;
  versionId: string;
}) {
  try {
    await requireAuthenticatedAdminSession();
    await revokeArtistPreviewVersion(data);
    refreshArtists();
    revalidatePath(`/admin/artists/${data.artistProfileId}`);
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.preview.revoke",
      fallbackMessage: "The private preview could not be revoked.",
      exposeMessage: true
    });
  }
}

export async function publishArtistProfileAction(artistProfileId: string, versionId: string) {
  try {
    await requireAuthenticatedAdminSession();
    await publishArtistProfile(artistProfileId, versionId);
    refreshArtists();
    return {ok: true as const};
  } catch (error) {
    return adminActionError(error, {
      context: "artists.publish",
      fallbackMessage: "This profile could not be published.",
      exposeMessage: true
    });
  }
}
