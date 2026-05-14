export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {getCommissionRequest, updateCommissionRequest} from "@/lib/repositories/commissions";

const updateSchema = z.object({
  status: z.string().optional(),
  quotedPrice: z.string().optional(),
  paypalLink: z.string().optional(),
  adminNotes: z.string().optional(),
  deliveryLink: z.string().optional()
});

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const {id} = await params;
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const commission = await getCommissionRequest(id);

    if (!commission) {
      return NextResponse.json({message: "Commission request not found."}, {status: 404});
    }

    return NextResponse.json({commission});
  } catch (error) {
    console.error("Failed to fetch commission request:", error);
    return NextResponse.json(
      {message: "Failed to fetch commission request."},
      {status: 500}
    );
  }
}

export async function PUT(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const {id} = await params;
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const rawPayload = await request.json();
    const payload = updateSchema.parse(rawPayload);

    const commission = await updateCommissionRequest(id, payload);

    return NextResponse.json({commission});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid update data."},
        {status: 400}
      );
    }

    console.error("Failed to update commission request:", error);
    return NextResponse.json(
      {message: "Failed to update commission request."},
      {status: 500}
    );
  }
}
