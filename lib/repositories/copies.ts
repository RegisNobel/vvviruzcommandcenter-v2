import type {CopyEntry as PrismaCopyEntry} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import {toDate} from "@/lib/db/serialization";
import {hydrateCopy, summarizeCopy} from "@/lib/copy";
import type {CopyRecord, CopySummary} from "@/lib/types";

function toCopyRecord(copy: PrismaCopyEntry): CopyRecord {
  return hydrateCopy({
    id: copy.id,
    release_id: copy.releaseId,
    hook: copy.hook,
    caption: copy.caption,
    hookType: copy.hookType || copy.type,
    contentType: copy.contentType,
    songSection: copy.songSection,
    creativeNotes: copy.creativeNotes,
    created_on: copy.createdOn.toISOString(),
    updated_on: copy.updatedOn.toISOString()
  });
}

async function resolveReleaseId(releaseId: string | null) {
  if (!releaseId) {
    return null;
  }

  const release = await prisma.release.findUnique({
    where: {
      id: releaseId
    },
    select: {
      id: true
    }
  });

  return release?.id ?? null;
}

export async function copyExists(copyId: string) {
  const copy = await prisma.copyEntry.findUnique({
    where: {
      id: copyId
    },
    select: {
      id: true
    }
  });

  return Boolean(copy);
}

export async function readCopySummaries(): Promise<CopySummary[]> {
  const copies = await prisma.copyEntry.findMany({
    orderBy: {
      updatedOn: "desc"
    }
  });

  return copies.map((copy: PrismaCopyEntry) => summarizeCopy(toCopyRecord(copy)));
}

export async function readCopiesByReleaseId(releaseId: string): Promise<CopySummary[]> {
  const copies = await prisma.copyEntry.findMany({
    where: {
      releaseId
    },
    orderBy: {
      updatedOn: "desc"
    }
  });

  return copies.map((copy: PrismaCopyEntry) => summarizeCopy(toCopyRecord(copy)));
}

export async function readCopy(copyId: string): Promise<CopyRecord> {
  const copy = await prisma.copyEntry.findUnique({
    where: {
      id: copyId
    }
  });

  if (!copy) {
    throw new Error("Copy not found.");
  }

  return toCopyRecord(copy);
}

export async function saveCopy(copy: CopyRecord) {
  const normalizedCopy = hydrateCopy(copy);
  const releaseId = await resolveReleaseId(normalizedCopy.release_id);

  await prisma.copyEntry.upsert({
    where: {
      id: normalizedCopy.id
    },
    create: {
      id: normalizedCopy.id,
      releaseId,
      hook: normalizedCopy.hook,
      caption: normalizedCopy.caption,
      type: normalizedCopy.hook_type,
      hookType: normalizedCopy.hook_type,
      contentType: normalizedCopy.content_type,
      songSection: normalizedCopy.song_section,
      creativeNotes: normalizedCopy.creative_notes,
      createdOn: toDate(normalizedCopy.created_on),
      updatedOn: toDate(normalizedCopy.updated_on)
    },
    update: {
      releaseId,
      hook: normalizedCopy.hook,
      caption: normalizedCopy.caption,
      type: normalizedCopy.hook_type,
      hookType: normalizedCopy.hook_type,
      contentType: normalizedCopy.content_type,
      songSection: normalizedCopy.song_section,
      creativeNotes: normalizedCopy.creative_notes,
      createdOn: toDate(normalizedCopy.created_on),
      updatedOn: toDate(normalizedCopy.updated_on)
    }
  });

  return normalizedCopy.id;
}

export async function deleteCopy(copyId: string) {
  await prisma.copyEntry.delete({
    where: {
      id: copyId
    }
  });
}
