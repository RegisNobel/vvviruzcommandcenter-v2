export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {listCommissionRequests} from "@/lib/repositories/commissions";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const requests = await listCommissionRequests();
    return NextResponse.json({requests});
  } catch (error) {
    console.error("Failed to list commission requests:", error);
    return NextResponse.json(
      {message: "Failed to load commission requests."},
      {status: 500}
    );
  }
}
