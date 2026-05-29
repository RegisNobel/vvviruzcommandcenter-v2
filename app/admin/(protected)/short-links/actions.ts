"use server";

import {
  createShortLink,
  softDeleteShortLink,
  updateShortLinkContext,
  updateShortLinkDestination,
  updateShortLinkStatus
} from "@/lib/repositories/short-links";
import {buildDestinationUrlWithUtm, type UtmFields} from "@/lib/short-link-url";
import type {ShortLinkStatus} from "@/lib/types";

export async function createShortLinkAction(input: {
  customSlug?: string;
  destinationUrl: string;
  releaseId?: string | null;
  campaignLabel?: string | null;
  contentLabel?: string | null;
  utmFields?: UtmFields;
}) {
  try {
    const destinationUrl = buildDestinationUrlWithUtm(input.destinationUrl, input.utmFields);
    const link = await createShortLink({
      campaignLabel: input.campaignLabel,
      contentLabel: input.contentLabel,
      customSlug: input.customSlug,
      destinationUrl,
      releaseId: input.releaseId
    });

    return {
      link,
      message: "Short link created.",
      ok: true
    };
  } catch (error) {
    return {
      link: null,
      message: error instanceof Error ? error.message : "Short link creation failed.",
      ok: false
    };
  }
}

export async function updateShortLinkContextAction(input: {
  id: string;
  releaseId?: string | null;
  campaignLabel?: string | null;
  contentLabel?: string | null;
}) {
  try {
    const link = await updateShortLinkContext(input);

    return {
      link,
      message: "Short link context saved.",
      ok: true
    };
  } catch (error) {
    return {
      link: null,
      message: error instanceof Error ? error.message : "Short link context save failed.",
      ok: false
    };
  }
}

export async function updateShortLinkDestinationAction(input: {
  id: string;
  destinationUrl: string;
}) {
  try {
    const link = await updateShortLinkDestination(input);

    return {
      link,
      message: "Short link destination updated. Future clicks use the new destination.",
      ok: true
    };
  } catch (error) {
    return {
      link: null,
      message: error instanceof Error ? error.message : "Short link destination update failed.",
      ok: false
    };
  }
}

export async function updateShortLinkStatusAction(input: {
  id: string;
  status: ShortLinkStatus;
}) {
  try {
    const link = await updateShortLinkStatus(input);

    return {
      link,
      message: "Short link status updated.",
      ok: true
    };
  } catch (error) {
    return {
      link: null,
      message: error instanceof Error ? error.message : "Short link status update failed.",
      ok: false
    };
  }
}

export async function deleteShortLinkAction(id: string) {
  try {
    await softDeleteShortLink(id);

    return {
      message: "Short link deleted.",
      ok: true
    };
  } catch {
    return {
      message: "Short link deletion failed.",
      ok: false
    };
  }
}
