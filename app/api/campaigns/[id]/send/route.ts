export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {sendCampaignToSubscriber} from "@/lib/email/delivery";
import {
  createEmailSendLog,
  listAudienceRecipients,
  readCampaign,
  updateCampaignStatus
} from "@/lib/repositories/audience";

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const {id} = await params;
  const campaign = await readCampaign(id);

  if (!campaign) {
    return NextResponse.json({message: "Campaign not found."}, {status: 404});
  }

  if (campaign.status === "sent") {
    return NextResponse.json(
      {message: "This campaign has already been sent."},
      {status: 400}
    );
  }

  const recipients = await listAudienceRecipients(campaign.audience_filter);

  if (recipients.length === 0) {
    return NextResponse.json(
      {message: "No active consented subscribers match this audience."},
      {status: 400}
    );
  }

  await updateCampaignStatus({
    id: campaign.id,
    status: "sending",
    recipientCount: recipients.length,
    sentAt: null
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendCampaignToSubscriber(campaign, recipient);

      await createEmailSendLog({
        campaignId: campaign.id,
        subscriberId: recipient.id,
        email: recipient.email,
        status: "sent",
        providerMessageId: result.providerMessageId,
        sentAt: new Date().toISOString()
      });
      sentCount += 1;
    } catch (error) {
      await createEmailSendLog({
        campaignId: campaign.id,
        subscriberId: recipient.id,
        email: recipient.email,
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown email delivery error."
      });
      failedCount += 1;
    }
  }

  const sentAt = sentCount > 0 ? new Date().toISOString() : null;
  const finalStatus = failedCount > 0 ? "failed" : "sent";
  const updatedCampaign = await updateCampaignStatus({
    id: campaign.id,
    status: finalStatus,
    recipientCount: recipients.length,
    sentAt
  });

  return NextResponse.json({
    campaign: updatedCampaign,
    summary: {
      recipientCount: recipients.length,
      sentCount,
      failedCount
    },
    message:
      failedCount > 0
        ? "Campaign finished with some delivery failures."
        : "Campaign sent successfully."
  });
}

