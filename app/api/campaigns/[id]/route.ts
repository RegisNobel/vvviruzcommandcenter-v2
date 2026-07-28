export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  countAudienceRecipients,
  deleteCampaign,
  readCampaign,
  saveCampaign
} from "@/lib/repositories/audience";
import type {AudienceFilter} from "@/lib/types";
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const campaignSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required."),
  preview_text: z.string().default(""),
  body: z.string().trim().min(1, "Body is required."),
  cta_label: z.string().default(""),
  cta_url: z.string().default(""),
  audience_filter: z.enum(["all_active", "exclusive_source", "manual_source"])
});

export async function GET(
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

  return NextResponse.json({campaign});
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
    const payload = campaignSchema.parse(await request.json());
    const {id} = await params;
    const existing = await readCampaign(id);

    if (!existing) {
      return NextResponse.json({message: "Campaign not found."}, {status: 404});
    }

    const recipientCount = await countAudienceRecipients(
      payload.audience_filter as AudienceFilter
    );
    const campaign = await saveCampaign({
      ...existing,
      subject: payload.subject,
      preview_text: payload.preview_text,
      body: payload.body,
      cta_label: payload.cta_label,
      cta_url: payload.cta_url,
      audience_filter: payload.audience_filter,
      recipient_count: recipientCount,
      status: existing.status === "sent" ? "sent" : "draft",
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({campaign, message: "Campaign updated."});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "audience.campaign.update",
      fallbackMessage: "The email campaign could not be updated."
    });
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

    await deleteCampaign(id);

    return NextResponse.json({message: "Campaign deleted."});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "audience.campaign.delete",
      fallbackMessage: "The email campaign could not be deleted."
    });
  }
}
