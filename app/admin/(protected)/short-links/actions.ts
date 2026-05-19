"use server";

import {
  createShortLink,
  softDeleteShortLink,
  updateShortLinkContext
} from "@/lib/repositories/short-links";
import {buildDestinationUrlWithUtm, type UtmFields} from "@/lib/short-link-url";

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
