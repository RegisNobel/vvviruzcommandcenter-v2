import {prisma} from "@/lib/db/prisma";
import {createId} from "@/lib/utils";
import type {LinkHubRecord} from "@/lib/types";

export async function readLinkHubs(): Promise<LinkHubRecord[]> {
  let hubs = await prisma.linkHub.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        path: "asc"
      }
    ],
    include: {
      release: {
        select: {
          title: true
        }
      }
    }
  });

  const hasLinks = hubs.some((h) => h.path === "links");

  if (!hasLinks) {
    const now = new Date();
    const defaultHub = await prisma.linkHub.create({
      data: {
        id: createId(),
        path: "links",
        releaseId: null,
        isEnabled: true,
        showInPublicNav: true,
        label: "Links",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      include: {
        release: {
          select: {
            title: true
          }
        }
      }
    });

    hubs = [defaultHub, ...hubs].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return hubs.map((h) => ({
    id: h.id,
    path: h.path,
    releaseId: h.releaseId,
    isEnabled: h.isEnabled,
    showInPublicNav: h.showInPublicNav,
    label: h.label,
    sortOrder: h.sortOrder,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    release_title: h.release?.title ?? undefined
  }));
}

export async function readLinkHubByPath(path: string): Promise<LinkHubRecord | null> {
  const h = await prisma.linkHub.findUnique({
    where: { path },
    include: {
      release: {
        select: {
          title: true
        }
      }
    }
  });

  if (!h) {
    if (path === "links") {
      // Seed on the fly and return if reading links and it was not seeded yet
      await readLinkHubs();
      return readLinkHubByPath("links");
    }
    return null;
  }

  return {
    id: h.id,
    path: h.path,
    releaseId: h.releaseId,
    isEnabled: h.isEnabled,
    showInPublicNav: h.showInPublicNav,
    label: h.label,
    sortOrder: h.sortOrder,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    release_title: h.release?.title ?? undefined
  };
}

export async function deleteLinkHub(id: string): Promise<void> {
  const hub = await prisma.linkHub.findUnique({
    where: { id }
  });

  if (hub?.path === "links") {
    throw new Error("The primary /links hub is protected and cannot be deleted.");
  }

  await prisma.linkHub.delete({
    where: { id }
  });
}
