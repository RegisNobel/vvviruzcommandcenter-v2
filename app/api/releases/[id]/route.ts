export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {touchCopy} from "@/lib/copy";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {isPlainPublicMetadata} from "@/lib/release-metadata";
import {normalizeLyrics} from "@/lib/lyrics";
import {readCopy, readCopiesByReleaseId, saveCopy} from "@/lib/server/copies";
import {deleteRelease, readRelease, saveRelease} from "@/lib/server/releases";
import {submitIndexNowUrls} from "@/lib/server/indexnow";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {
  getReleasePublishBlockers,
  hydrateRelease,
  summarizeRelease,
  touchRelease
} from "@/lib/releases";
import type {ReleaseRecord} from "@/lib/types";

const patchReleaseSchema = z.object({
  pinned: z.boolean().optional()
});

const discoveryMetadataFields: Array<{
  key: keyof Pick<
    ReleaseRecord,
    | "seo_title"
    | "meta_description"
    | "cover_art_alt_text"
    | "social_share_title"
    | "social_share_description"
  >;
  label: string;
}> = [
  {key: "seo_title", label: "SEO Title"},
  {key: "meta_description", label: "Meta Description"},
  {key: "cover_art_alt_text", label: "Cover Art Alt Text"},
  {key: "social_share_title", label: "Social Share Title"},
  {key: "social_share_description", label: "Social Share Description"}
];

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const release = await readRelease(id);

    return NextResponse.json({
      release,
      summary: summarizeRelease(release)
    });
  } catch {
    return NextResponse.json({message: "Release not found."}, {status: 404});
  }
}

export async function PUT(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const hydratedRelease = hydrateRelease(
      (await request.json()) as Partial<ReleaseRecord>
    );
    const release = {
      ...hydratedRelease,
      lyrics: normalizeLyrics(hydratedRelease.lyrics)
    };

    const malformedDiscoveryField = discoveryMetadataFields.find(
      ({key}) => !isPlainPublicMetadata(release[key])
    );

    if (malformedDiscoveryField) {
      return NextResponse.json(
        {
          message: `${malformedDiscoveryField.label} must be plain text. Remove HTML tags before saving.`
        },
        {status: 400}
      );
    }

    if (release.id !== id) {
      return NextResponse.json({message: "Release id mismatch."}, {status: 400});
    }

    const publishBlockers = getReleasePublishBlockers(release);

    if (release.is_published && publishBlockers.length > 0) {
      return NextResponse.json(
        {
          message: `Release is not ready to publish publicly. ${publishBlockers.join(", ")}.`,
          publishBlockers
        },
        {status: 400}
      );
    }

    const normalized = touchRelease(release);

    const saveResult = await saveRelease(normalized);

    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    revalidateTag(PUBLIC_CACHE_TAGS.releaseCategories);

    if (normalized.is_published) {
      await submitIndexNowUrls([
        `/music/${encodeURIComponent(normalized.slug)}`,
        "/music",
        "/sitemap.xml"
      ]);
    }

    return NextResponse.json({
      release: normalized,
      summary: summarizeRelease(normalized),
      annotationRevalidation: saveResult.annotationRevalidation
    });
  } catch (error) {
    return adminErrorResponse(error, {
      context: "release.update",
      fallbackMessage: "The release could not be saved. Your previous changes are still intact."
    });
  }
}

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const parsed = patchReleaseSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid release update."},
        {status: 400}
      );
    }

    const existingRelease = await readRelease(id);
    const normalized = touchRelease({
      ...existingRelease,
      ...(parsed.data.pinned === undefined ? {} : {pinned: parsed.data.pinned})
    });

    await saveRelease(normalized);

    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    revalidateTag(PUBLIC_CACHE_TAGS.releaseCategories);

    return NextResponse.json({
      release: normalized,
      summary: summarizeRelease(normalized)
    });
  } catch (error) {
    return adminErrorResponse(error, {
      context: "release.patch",
      fallbackMessage: "The release setting could not be updated."
    });
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const linkedCopies = await readCopiesByReleaseId(id);

    await Promise.all([
      ...linkedCopies.map(async (copySummary) => {
        const copy = await readCopy(copySummary.id);

        await saveCopy(
          touchCopy({
            ...copy,
            release_id: null
          })
        );
      })
    ]);

    await deleteRelease(id);

    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    revalidateTag(PUBLIC_CACHE_TAGS.releaseCategories);

    return NextResponse.json({success: true});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "release.delete",
      fallbackMessage: "The release could not be deleted. No release data was removed."
    });
  }
}
