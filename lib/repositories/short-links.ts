import {randomBytes} from "node:crypto";

import type {ShortLink} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {buildDestinationUrlWithUtm} from "@/lib/short-link-url";
import type {ShortLinkAdminFilter, ShortLinkRecord, ShortLinkStatus} from "@/lib/types";
import {createId} from "@/lib/utils";

const autoSlugLength = 7;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shortLinkStatuses = ["ACTIVE", "ARCHIVED", "PAUSED"] as const satisfies readonly ShortLinkStatus[];
const shortLinkInclude = {
  release: {
    select: {
      id: true,
      title: true
    }
  }
} as const;

type ShortLinkWithRelease = ShortLink & {
  release: {
    id: string;
    title: string;
  } | null;
};

function cleanOptionalString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeShortLinkStatus(value: string | null | undefined): ShortLinkStatus {
  return shortLinkStatuses.includes(value as ShortLinkStatus)
    ? (value as ShortLinkStatus)
    : "ACTIVE";
}

function toShortLinkRecord(link: ShortLinkWithRelease): ShortLinkRecord {
  return {
    id: link.id,
    slug: link.slug,
    destination_url: link.destinationUrl,
    release_id: link.releaseId ?? "",
    release_title: link.release?.title ?? "",
    status: normalizeShortLinkStatus(link.status),
    click_count: link.clickCount,
    campaign_label: link.campaignLabel,
    content_label: link.contentLabel,
    created_at: link.createdAt.toISOString(),
    updated_at: link.updatedAt.toISOString(),
    archived_at: link.archivedAt?.toISOString() ?? null,
    paused_at: link.pausedAt?.toISOString() ?? null,
    destination_updated_at: link.destinationUpdatedAt?.toISOString() ?? null,
    deleted_at: link.deletedAt?.toISOString() ?? null
  };
}

function normalizeDestinationUrl(value: string) {
  return buildDestinationUrlWithUtm(value);
}

function normalizeCustomSlug(value: string) {
  const slug = value.trim();

  if (!slug) {
    return "";
  }

  if (!slugPattern.test(slug)) {
    throw new Error("Slug can only use lowercase letters, numbers, and hyphens.");
  }

  return slug;
}

function createRandomSlug() {
  return randomBytes(6).toString("hex").slice(0, autoSlugLength);
}

async function createUniqueAutoSlug() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = createRandomSlug();
    const existing = await prisma.shortLink.findUnique({
      where: {
        slug
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return slug;
    }
  }

  throw new Error("Could not generate a unique short slug. Try again.");
}

async function ensureSlugIsAvailable(slug: string) {
  const existing = await prisma.shortLink.findUnique({
    where: {
      slug
    },
    select: {
      deletedAt: true
    }
  });

  if (!existing) {
    return;
  }

  if (existing.deletedAt) {
    throw new Error("That slug was used before and cannot be reused.");
  }

  throw new Error("That slug is already in use.");
}

async function normalizeReleaseId(value: string | null | undefined) {
  const releaseId = cleanOptionalString(value);

  if (!releaseId) {
    return null;
  }

  const release = await prisma.release.findUnique({
    select: {
      id: true
    },
    where: {
      id: releaseId
    }
  });

  if (!release) {
    throw new Error("Select a valid release or leave the release field empty.");
  }

  return release.id;
}

export async function readActiveShortLinks() {
  return readShortLinksForAdmin("ACTIVE");
}

export async function readShortLinksForAdmin(filter: ShortLinkAdminFilter = "ACTIVE") {
  const where = filter === "DELETED"
    ? {
        deletedAt: {
          not: null
        }
      }
    : {
        deletedAt: null,
        status: filter
      };

  const links = await prisma.shortLink.findMany({
    include: shortLinkInclude,
    orderBy: {
      createdAt: "desc"
    },
    where
  });

  return links.map(toShortLinkRecord);
}

export async function readShortLinksByReleaseId(releaseId: string) {
  const links = await prisma.shortLink.findMany({
    include: shortLinkInclude,
    orderBy: {
      clickCount: "desc"
    },
    where: {
      deletedAt: null,
      releaseId
    }
  });

  return links.map(toShortLinkRecord);
}

export async function readActiveShortLinksByReleaseId(releaseId: string) {
  const links = await prisma.shortLink.findMany({
    include: shortLinkInclude,
    orderBy: {
      clickCount: "desc"
    },
    where: {
      deletedAt: null,
      releaseId,
      status: "ACTIVE"
    }
  });

  return links.map(toShortLinkRecord);
}

export async function createShortLink({
  customSlug,
  destinationUrl,
  releaseId,
  campaignLabel,
  contentLabel
}: {
  customSlug?: string;
  destinationUrl: string;
  releaseId?: string | null;
  campaignLabel?: string | null;
  contentLabel?: string | null;
}) {
  const normalizedDestinationUrl = normalizeDestinationUrl(destinationUrl);
  const normalizedCustomSlug = normalizeCustomSlug(customSlug ?? "");
  const slug = normalizedCustomSlug || (await createUniqueAutoSlug());
  const normalizedReleaseId = await normalizeReleaseId(releaseId);

  if (normalizedCustomSlug) {
    await ensureSlugIsAvailable(slug);
  }

  const now = new Date();
  const link = await prisma.shortLink.create({
    data: {
      id: createId(),
      slug,
      destinationUrl: normalizedDestinationUrl,
      releaseId: normalizedReleaseId,
      campaignLabel: cleanOptionalString(campaignLabel),
      contentLabel: cleanOptionalString(contentLabel),
      status: "ACTIVE",
      clickCount: 0,
      createdAt: now,
      updatedAt: now
    },
    include: shortLinkInclude
  });

  return toShortLinkRecord(link);
}

export async function updateShortLinkContext({
  id,
  releaseId,
  campaignLabel,
  contentLabel
}: {
  id: string;
  releaseId?: string | null;
  campaignLabel?: string | null;
  contentLabel?: string | null;
}) {
  const normalizedReleaseId = await normalizeReleaseId(releaseId);
  const existing = await prisma.shortLink.findFirst({
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      id
    }
  });

  if (!existing) {
    throw new Error("Short link not found.");
  }

  const link = await prisma.shortLink.update({
    data: {
      releaseId: normalizedReleaseId,
      campaignLabel: cleanOptionalString(campaignLabel),
      contentLabel: cleanOptionalString(contentLabel),
      updatedAt: new Date()
    },
    include: shortLinkInclude,
    where: {
      id: existing.id
    }
  });

  return toShortLinkRecord(link);
}

export async function updateShortLinkDestination({
  id,
  destinationUrl
}: {
  id: string;
  destinationUrl: string;
}) {
  const normalizedDestinationUrl = normalizeDestinationUrl(destinationUrl);
  const existing = await prisma.shortLink.findFirst({
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      id
    }
  });

  if (!existing) {
    throw new Error("Short link not found.");
  }

  const now = new Date();
  const link = await prisma.shortLink.update({
    data: {
      destinationUrl: normalizedDestinationUrl,
      destinationUpdatedAt: now,
      updatedAt: now
    },
    include: shortLinkInclude,
    where: {
      id: existing.id
    }
  });

  return toShortLinkRecord(link);
}

export async function updateShortLinkStatus({
  id,
  status
}: {
  id: string;
  status: ShortLinkStatus;
}) {
  if (!shortLinkStatuses.includes(status)) {
    throw new Error("Select a valid lifecycle status.");
  }

  const existing = await prisma.shortLink.findFirst({
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      id
    }
  });

  if (!existing) {
    throw new Error("Short link not found.");
  }

  const now = new Date();
  const link = await prisma.shortLink.update({
    data: {
      archivedAt: status === "ARCHIVED" ? now : null,
      pausedAt: status === "PAUSED" ? now : null,
      status,
      updatedAt: now
    },
    include: shortLinkInclude,
    where: {
      id: existing.id
    }
  });

  return toShortLinkRecord(link);
}

export async function softDeleteShortLink(id: string) {
  const now = new Date();

  await prisma.shortLink.update({
    data: {
      deletedAt: now,
      updatedAt: now
    },
    where: {
      id
    }
  });
}

export async function resolveShortLinkRedirect(slug: string) {
  if (!slugPattern.test(slug)) {
    return null;
  }

  const link = await prisma.shortLink.findFirst({
    where: {
      deletedAt: null,
      slug
    }
  });

  if (!link) {
    return null;
  }

  const status = normalizeShortLinkStatus(link.status);

  if (status === "PAUSED") {
    return {
      destinationUrl: null,
      status
    };
  }

  await prisma.shortLink.update({
    data: {
      clickCount: {
        increment: 1
      },
      updatedAt: new Date()
    },
    where: {
      id: link.id
    }
  });

  return {
    destinationUrl: link.destinationUrl,
    status
  };
}

export async function resolveActiveShortLinkDestination(slug: string) {
  const redirect = await resolveShortLinkRedirect(slug);

  return redirect?.destinationUrl ?? null;
}
