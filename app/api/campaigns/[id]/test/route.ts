export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {sendCampaignTest} from "@/lib/email/delivery";
import {getAdminTestEmail} from "@/lib/email/campaigns";
import {readCampaign} from "@/lib/repositories/audience";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const {id} = await params;
    const campaign = await readCampaign(id);

    if (!campaign) {
      return NextResponse.json({message: "Campaign not found."}, {status: 404});
    }

    await sendCampaignTest(campaign, getAdminTestEmail());

    return NextResponse.json({message: "Test email sent."});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "audience.campaign.test-send",
      fallbackMessage: "The test email could not be sent. Check the email settings and try again."
    });
  }
}
