export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {
  listReleaseAnnotations,
  saveReleaseAnnotation
} from "@/lib/repositories/fan-content";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const annotationSchema = z.object({
  id: z.string().optional(),
  type: z.string().max(80),
  title: z.string().max(80),
  summary: z.string().max(300),
  explanation: z.string().max(8000),
  confidence: z.string().max(80),
  sectionKey: z.string().max(120),
  sectionOccurrence: z.number().int().min(0),
  startLineIndex: z.number().int().min(0),
  endLineIndex: z.number().int().min(0),
  action: z.enum(["draft", "publish", "archive"]),
  sources: z.array(z.object({label: z.string().max(120), url: z.string().max(2000)})).max(8)
});

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  try {
    const {id} = await params;
    return NextResponse.json({annotations: await listReleaseAnnotations(id)});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "release.annotations.list",
      fallbackMessage: "Breaking Barz annotations could not be loaded.",
      exposeMessage: true
    });
  }
}

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;
  const parsed = annotationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {message: parsed.error.issues[0]?.message ?? "Invalid annotation."},
      {status: 400}
    );
  }
  try {
    const {id} = await params;
    await saveReleaseAnnotation({...parsed.data, releaseId: id});
    revalidateTag(PUBLIC_CACHE_TAGS.releases);
    return NextResponse.json({annotations: await listReleaseAnnotations(id)});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "release.annotations.save",
      fallbackMessage: "The annotation could not be saved.",
      exposeMessage: true
    });
  }
}
