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
import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {adminActionError} from "@/lib/server/admin-error-response";

export async function createShortLinkAction(input: {
  customSlug?: string;
  destinationUrl: string;
  releaseId?: string | null;
  campaignLabel?: string | null;
  contentLabel?: string | null;
  utmFields?: UtmFields;
}) {
  try {
    await requireAuthenticatedAdminSession();
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
      ...adminActionError(error, {
        context: "short-link.create",
        fallbackMessage: "The short link could not be created.",
        exposeMessage: true
      }),
      link: null
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
    await requireAuthenticatedAdminSession();
    const link = await updateShortLinkContext(input);

    return {
      link,
      message: "Short link context saved.",
      ok: true
    };
  } catch (error) {
    return {
      ...adminActionError(error, {
        context: "short-link.context",
        fallbackMessage: "The short link campaign context could not be saved.",
        exposeMessage: true
      }),
      link: null
    };
  }
}

export async function updateShortLinkDestinationAction(input: {
  id: string;
  destinationUrl: string;
}) {
  try {
    await requireAuthenticatedAdminSession();
    const link = await updateShortLinkDestination(input);

    return {
      link,
      message: "Short link destination updated. Future clicks use the new destination.",
      ok: true
    };
  } catch (error) {
    return {
      ...adminActionError(error, {
        context: "short-link.destination",
        fallbackMessage: "The short link destination could not be updated.",
        exposeMessage: true
      }),
      link: null
    };
  }
}

export async function updateShortLinkStatusAction(input: {
  id: string;
  status: ShortLinkStatus;
}) {
  try {
    await requireAuthenticatedAdminSession();
    const link = await updateShortLinkStatus(input);

    return {
      link,
      message: "Short link status updated.",
      ok: true
    };
  } catch (error) {
    return {
      ...adminActionError(error, {
        context: "short-link.status",
        fallbackMessage: "The short link status could not be updated.",
        exposeMessage: true
      }),
      link: null
    };
  }
}

export async function deleteShortLinkAction(id: string) {
  try {
    await requireAuthenticatedAdminSession();
    await softDeleteShortLink(id);

    return {
      message: "Short link deleted.",
      ok: true
    };
  } catch (error) {
    return adminActionError(error, {
      context: "short-link.delete",
      fallbackMessage: "The short link could not be deleted."
    });
  }
}
