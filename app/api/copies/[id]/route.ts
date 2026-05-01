export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  contentTypeOptions,
  hookTypeOptions,
  hydrateCopy,
  songSectionOptions,
  summarizeCopy,
  touchCopy
} from "@/lib/copy";
import {deleteCopy, readCopy, saveCopy} from "@/lib/server/copies";
import type {CopyRecord} from "@/lib/types";

const patchCopySchema = z.object({
  release_id: z.string().trim().min(1).nullable()
});

const updateCopySchema = z.object({
  id: z.string().trim().min(1),
  release_id: z.string().trim().min(1).nullable(),
  hook: z.string().default(""),
  caption: z.string().default(""),
  hook_type: z.enum(hookTypeOptions).optional(),
  type: z.string().optional(),
  content_type: z.enum(contentTypeOptions).default("amv-lyric-edit"),
  song_section: z.enum(songSectionOptions).default("hook"),
  creative_notes: z.string().default(""),
  created_on: z.string(),
  updated_on: z.string()
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
    const copy = await readCopy(id);

    return NextResponse.json({
      copy,
      summary: summarizeCopy(copy)
    });
  } catch {
    return NextResponse.json({message: "Copy not found."}, {status: 404});
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
    const parsed = updateCopySchema.safeParse((await request.json()) as Partial<CopyRecord>);

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid copy payload."},
        {status: 400}
      );
    }

    const copy = hydrateCopy(parsed.data);

    if (copy.id !== id) {
      return NextResponse.json({message: "Copy id mismatch."}, {status: 400});
    }

    const normalized = touchCopy(copy);

    await saveCopy(normalized);

    return NextResponse.json({
      copy: normalized,
      summary: summarizeCopy(normalized)
    });
  } catch {
    return NextResponse.json({message: "Copy update failed."}, {status: 500});
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
    const parsed = patchCopySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid copy patch."},
        {status: 400}
      );
    }

    const existing = await readCopy(id);
    const normalized = touchCopy(
      hydrateCopy({
        ...existing,
        release_id: parsed.data.release_id
      })
    );

    await saveCopy(normalized);

    return NextResponse.json({
      copy: normalized,
      summary: summarizeCopy(normalized)
    });
  } catch {
    return NextResponse.json({message: "Copy update failed."}, {status: 500});
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

    await deleteCopy(id);

    return NextResponse.json({success: true});
  } catch {
    return NextResponse.json({message: "Copy delete failed."}, {status: 500});
  }
}
