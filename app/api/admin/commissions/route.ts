export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {listCommissionRequests} from "@/lib/repositories/commissions";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const requests = await listCommissionRequests();
    return NextResponse.json({requests});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "commission.list",
      fallbackMessage: "Commission requests could not be loaded."
    });
  }
}
