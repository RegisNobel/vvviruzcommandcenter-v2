import type {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import type {PublicReleaseCategory, ReleaseCategoryRecord} from "@/lib/types";
import {createId} from "@/lib/utils";

type CategoryWithAssignments = Prisma.ReleaseCategoryGetPayload<{
  include: {
    releases: {
      select: {
        releaseId: true;
        sortOrder: true;
        release: {
          select: {
            isPublished: true;
          };
        };
      };
      orderBy: [{sortOrder: "asc"}];
    };
  };
}>;

export type ReleaseCategoryInput = {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
  release_ids?: string[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toCategoryRecord(category: CategoryWithAssignments): ReleaseCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sort_order: category.sortOrder,
    release_ids: category.releases.map((assignment) => assignment.releaseId),
    created_at: category.createdAt.toISOString(),
    updated_at: category.updatedAt.toISOString()
  };
}

function toPublicCategory(category: CategoryWithAssignments): PublicReleaseCategory | null {
  const publishedReleaseCount = category.releases.filter(
    (assignment) => assignment.release.isPublished
  ).length;

  if (publishedReleaseCount === 0) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    release_count: publishedReleaseCount
  };
}

function normalizeCategoryInput(input: ReleaseCategoryInput, index: number) {
  const name = input.name.trim();

  if (!name) {
    throw new Error(`Category ${index + 1} needs a name.`);
  }

  const slug = slugify(input.slug || name);

  if (!slug) {
    throw new Error(`Category ${index + 1} needs a valid slug.`);
  }

  return {
    id: input.id?.trim() || createId(),
    name,
    slug,
    description: input.description?.trim() || "",
    sortOrder: Number.isFinite(input.sort_order) ? Number(input.sort_order) : index,
    releaseIds: Array.from(
      new Set(input.release_ids?.map((releaseId) => releaseId.trim()).filter(Boolean) ?? [])
    )
  };
}

export async function listReleaseCategories(): Promise<ReleaseCategoryRecord[]> {
  const categories = await prisma.releaseCategory.findMany({
    include: {
      releases: {
        select: {
          releaseId: true,
          sortOrder: true,
          release: {
            select: {
              isPublished: true
            }
          }
        },
        orderBy: [{sortOrder: "asc"}]
      }
    },
    orderBy: [{sortOrder: "asc"}, {name: "asc"}]
  });

  return categories.map(toCategoryRecord);
}

export async function listPublicReleaseCategories(): Promise<PublicReleaseCategory[]> {
  const categories = await prisma.releaseCategory.findMany({
    include: {
      releases: {
        select: {
          releaseId: true,
          sortOrder: true,
          release: {
            select: {
              isPublished: true
            }
          }
        },
        orderBy: [{sortOrder: "asc"}]
      }
    },
    orderBy: [{sortOrder: "asc"}, {name: "asc"}]
  });

  return categories
    .map(toPublicCategory)
    .filter((category): category is PublicReleaseCategory => Boolean(category));
}

export async function replaceReleaseCategories(inputs: ReleaseCategoryInput[]) {
  const normalizedCategories = inputs.map(normalizeCategoryInput);
  const categoryIds = normalizedCategories.map((category) => category.id);
  const slugs = new Set<string>();
  const now = new Date();

  for (const category of normalizedCategories) {
    if (slugs.has(category.slug)) {
      throw new Error(`Duplicate category slug: ${category.slug}`);
    }

    slugs.add(category.slug);
  }

  await prisma.$transaction(async (tx) => {
    await tx.releaseCategory.deleteMany({
      where: {
        id: {
          notIn: categoryIds
        }
      }
    });

    for (const category of normalizedCategories) {
      await tx.releaseCategory.upsert({
        where: {
          id: category.id
        },
        create: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          createdAt: now,
          updatedAt: now
        },
        update: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          updatedAt: now
        }
      });

      await tx.releaseCategoryAssignment.deleteMany({
        where: {
          categoryId: category.id
        }
      });

      for (const [releaseIndex, releaseId] of category.releaseIds.entries()) {
        await tx.releaseCategoryAssignment.create({
          data: {
            id: createId(),
            categoryId: category.id,
            releaseId,
            sortOrder: releaseIndex,
            createdAt: now,
            updatedAt: now
          }
        });
      }
    }
  });

  return listReleaseCategories();
}
