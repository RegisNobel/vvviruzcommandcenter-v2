export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {setAdCreativeCopyLink} from "@/lib/repositories/ads";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const copyLinkSchema = z.object({
  copy_entry_id: z.string().trim().min(1).nullable()
});

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
    const parsed = copyLinkSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {message: parsed.error.issues[0]?.message ?? "Invalid copy link payload."},
        {status: 400}
      );
    }

    await setAdCreativeCopyLink(id, parsed.data.copy_entry_id);

    return NextResponse.json({success: true});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "ad-lab.copy-link.update",
      fallbackMessage: "The Copy Lab link could not be updated."
    });
  }
}
