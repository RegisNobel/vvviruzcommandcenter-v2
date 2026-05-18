"use server";

import {createShortLink, softDeleteShortLink} from "@/lib/repositories/short-links";

export async function createShortLinkAction(input: {
  customSlug?: string;
  destinationUrl: string;
}) {
  try {
    const link = await createShortLink(input);

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
