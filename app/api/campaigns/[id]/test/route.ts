export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {sendCampaignTest} from "@/lib/email/delivery";
import {getAdminTestEmail} from "@/lib/email/campaigns";
import {readCampaign} from "@/lib/repositories/audience";

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
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to send test email."},
      {status: 400}
    );
  }
}

