import "server-only";

import {normalizeExternalUrl} from "@/lib/public-utils";
import type {EmailCampaignRecord, SubscriberRecord} from "@/lib/types";

import {
  buildCampaignUnsubscribeUrl,
  buildExclusivePageUrl,
  sendCampaignEmail
} from "@/lib/email/campaigns";

export async function sendCampaignToSubscriber(
  campaign: EmailCampaignRecord,
  subscriber: SubscriberRecord
) {
  return sendCampaignEmail({
    to: subscriber.email,
    subject: campaign.subject,
    previewText: campaign.preview_text,
    body: campaign.body,
    ctaLabel: campaign.cta_label,
    ctaUrl: normalizeExternalUrl(campaign.cta_url),
    unsubscribeUrl: buildCampaignUnsubscribeUrl(subscriber.unsubscribe_token)
  });
}

export async function sendCampaignTest(campaign: EmailCampaignRecord, email: string) {
  return sendCampaignEmail({
    to: email,
    subject: campaign.subject,
    previewText: campaign.preview_text,
    body: campaign.body,
    ctaLabel: campaign.cta_label,
    ctaUrl: normalizeExternalUrl(campaign.cta_url),
    unsubscribeUrl: buildExclusivePageUrl()
  });
}

