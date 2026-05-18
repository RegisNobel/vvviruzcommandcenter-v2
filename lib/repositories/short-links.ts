import {randomBytes} from "node:crypto";

import type {ShortLink} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import type {ShortLinkRecord} from "@/lib/types";
import {createId} from "@/lib/utils";

const autoSlugLength = 7;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toShortLinkRecord(link: ShortLink): ShortLinkRecord {
  return {
    id: link.id,
    slug: link.slug,
    destination_url: link.destinationUrl,
    click_count: link.clickCount,
    created_at: link.createdAt.toISOString(),
    updated_at: link.updatedAt.toISOString(),
    deleted_at: link.deletedAt?.toISOString() ?? null
  };
}

function normalizeDestinationUrl(value: string) {
  const trimmedValue = value.trim();

  try {
    const url = new URL(trimmedValue);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://.");
    }

    return url.toString();
  } catch {
    throw new Error("Enter a valid destination URL starting with http:// or https://.");
  }
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

export async function readActiveShortLinks() {
  const links = await prisma.shortLink.findMany({
    orderBy: {
      createdAt: "desc"
    },
    where: {
      deletedAt: null
    }
  });

  return links.map(toShortLinkRecord);
}

export async function createShortLink({
  customSlug,
  destinationUrl
}: {
  customSlug?: string;
  destinationUrl: string;
}) {
  const normalizedDestinationUrl = normalizeDestinationUrl(destinationUrl);
  const normalizedCustomSlug = normalizeCustomSlug(customSlug ?? "");
  const slug = normalizedCustomSlug || (await createUniqueAutoSlug());

  if (normalizedCustomSlug) {
    await ensureSlugIsAvailable(slug);
  }

  const now = new Date();
  const link = await prisma.shortLink.create({
    data: {
      id: createId(),
      slug,
      destinationUrl: normalizedDestinationUrl,
      clickCount: 0,
      createdAt: now,
      updatedAt: now
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

export async function resolveActiveShortLinkDestination(slug: string) {
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

  return link.destinationUrl;
}
