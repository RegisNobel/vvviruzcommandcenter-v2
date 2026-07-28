export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  countAudienceRecipients,
  listCampaigns,
  listEmailSendLogs,
  saveCampaign
} from "@/lib/repositories/audience";
import type {AudienceFilter, EmailCampaignRecord} from "@/lib/types";
import {createId} from "@/lib/utils";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const campaignSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required."),
  preview_text: z.string().default(""),
  body: z.string().trim().min(1, "Body is required."),
  cta_label: z.string().default(""),
  cta_url: z.string().default(""),
  audience_filter: z.enum(["all_active", "exclusive_source", "manual_source"])
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const [campaigns, sendLogs] = await Promise.all([listCampaigns(), listEmailSendLogs()]);

  return NextResponse.json({campaigns, sendLogs});
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const payload = campaignSchema.parse(await request.json());
    const now = new Date().toISOString();
    const recipientCount = await countAudienceRecipients(
      payload.audience_filter as AudienceFilter
    );
    const campaign: EmailCampaignRecord = {
      id: createId(),
      subject: payload.subject,
      preview_text: payload.preview_text,
      body: payload.body,
      cta_label: payload.cta_label,
      cta_url: payload.cta_url,
      audience_filter: payload.audience_filter,
      status: "draft",
      recipient_count: recipientCount,
      sent_at: null,
      created_at: now,
      updated_at: now
    };
    const savedCampaign = await saveCampaign(campaign);

    return NextResponse.json({campaign: savedCampaign, message: "Campaign saved."});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "audience.campaign.create",
      fallbackMessage: "The email campaign could not be saved."
    });
  }
}
