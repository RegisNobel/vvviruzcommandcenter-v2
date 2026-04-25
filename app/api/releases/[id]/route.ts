export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {touchCopy} from "@/lib/copy";
import {readCopy, readCopiesByReleaseId, saveCopy} from "@/lib/server/copies";
import {deleteRelease, readRelease, saveRelease} from "@/lib/server/releases";
import {
  readProject,
  readProjectsByReleaseId,
  saveProject
} from "@/lib/server/storage";
import {
  getReleasePublishBlockers,
  hydrateRelease,
  summarizeRelease,
  touchRelease
} from "@/lib/releases";
import type {ReleaseRecord} from "@/lib/types";
import {touchProject} from "@/lib/video/project";

const patchReleaseSchema = z.object({
  pinned: z.boolean().optional()
});

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
    const release = hydrateRelease((await request.json()) as Partial<ReleaseRecord>);

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

    await saveRelease(normalized);

    return NextResponse.json({
      release: normalized,
      summary: summarizeRelease(normalized)
    });
  } catch {
    return NextResponse.json({message: "Release update failed."}, {status: 500});
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

    return NextResponse.json({
      release: normalized,
      summary: summarizeRelease(normalized)
    });
  } catch {
    return NextResponse.json({message: "Release update failed."}, {status: 500});
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
    const [linkedProjects, linkedCopies] = await Promise.all([
      readProjectsByReleaseId(id),
      readCopiesByReleaseId(id)
    ]);

    await Promise.all([
      ...linkedProjects.map(async (projectSummary) => {
        const project = await readProject(projectSummary.id);

        await saveProject(
          touchProject({
            ...project,
            release_id: null
          })
        );
      }),
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

    return NextResponse.json({success: true});
  } catch {
    return NextResponse.json({message: "Release delete failed."}, {status: 500});
  }
}
