export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {
  listReleaseCategories,
  replaceReleaseCategories
} from "@/lib/repositories/release-categories";

const categorySchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Category name is required."),
  slug: z.string().trim().optional(),
  description: z.string().default(""),
  sort_order: z.number().int().min(0).optional(),
  release_ids: z.array(z.string().trim()).default([])
});

const replaceCategoriesSchema = z.object({
  categories: z.array(categorySchema).default([])
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const categories = await listReleaseCategories();

  return NextResponse.json({categories});
}

export async function PUT(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const parsed = replaceCategoriesSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {message: parsed.error.issues[0]?.message ?? "Invalid category payload."},
      {status: 400}
    );
  }

  try {
    const categories = await replaceReleaseCategories(parsed.data.categories);

    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    revalidateTag(PUBLIC_CACHE_TAGS.releaseCategories);

    return NextResponse.json({
      categories,
      message: "Music categories saved."
    });
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to save categories."},
      {status: 400}
    );
  }
}
