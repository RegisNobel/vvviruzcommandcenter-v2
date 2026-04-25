import {randomBytes} from "node:crypto";

import {prisma} from "@/lib/db/prisma";
import {toDate} from "@/lib/db/serialization";
import type {
  AudienceFilter,
  AudienceOverview,
  EmailCampaignRecord,
  EmailCampaignStatus,
  EmailSendLogRecord,
  EmailSendLogStatus,
  SubscriberRecord,
  SubscriberSource,
  SubscriberStatus
} from "@/lib/types";
import {createId} from "@/lib/utils";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createToken() {
  return randomBytes(24).toString("base64url");
}

function toSubscriberRecord(subscriber: {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  consentGiven: boolean;
  downloadToken: string;
  unsubscribeToken: string;
  createdAt: Date;
  updatedAt: Date;
  unsubscribedAt: Date | null;
}): SubscriberRecord {
  return {
    id: subscriber.id,
    name: subscriber.name,
    email: subscriber.email,
    source: subscriber.source as SubscriberSource,
    status: subscriber.status as SubscriberStatus,
    consent_given: subscriber.consentGiven,
    download_token: subscriber.downloadToken,
    unsubscribe_token: subscriber.unsubscribeToken,
    created_at: subscriber.createdAt.toISOString(),
    updated_at: subscriber.updatedAt.toISOString(),
    unsubscribed_at: subscriber.unsubscribedAt?.toISOString() ?? null
  };
}

function toEmailCampaignRecord(campaign: {
  id: string;
  subject: string;
  previewText: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audienceFilter: string;
  status: string;
  recipientCount: number;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailCampaignRecord {
  return {
    id: campaign.id,
    subject: campaign.subject,
    preview_text: campaign.previewText,
    body: campaign.body,
    cta_label: campaign.ctaLabel,
    cta_url: campaign.ctaUrl,
    audience_filter: campaign.audienceFilter as AudienceFilter,
    status: campaign.status as EmailCampaignStatus,
    recipient_count: campaign.recipientCount,
    sent_at: campaign.sentAt?.toISOString() ?? null,
    created_at: campaign.createdAt.toISOString(),
    updated_at: campaign.updatedAt.toISOString()
  };
}

function toEmailSendLogRecord(log: {
  id: string;
  campaignId: string;
  subscriberId: string | null;
  email: string;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}): EmailSendLogRecord {
  return {
    id: log.id,
    campaign_id: log.campaignId,
    subscriber_id: log.subscriberId,
    email: log.email,
    status: log.status as EmailSendLogStatus,
    provider_message_id: log.providerMessageId,
    error_message: log.errorMessage,
    sent_at: log.sentAt?.toISOString() ?? null,
    created_at: log.createdAt.toISOString()
  };
}

type SubscriberFilters = {
  search?: string;
  status?: SubscriberStatus | "all";
};

export async function listSubscribers(filters: SubscriberFilters = {}) {
  const search = filters.search?.trim();
  const status = filters.status && filters.status !== "all" ? filters.status : undefined;

  const subscribers = await prisma.subscriber.findMany({
    where: {
      ...(status ? {status} : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search
                }
              },
              {
                email: {
                  contains: normalizeEmail(search)
                }
              }
            ]
          }
        : {})
    },
    orderBy: [{createdAt: "desc"}]
  });

  return subscribers.map(toSubscriberRecord);
}

export async function readSubscriber(subscriberId: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: {
      id: subscriberId
    }
  });

  return subscriber ? toSubscriberRecord(subscriber) : null;
}

export async function readSubscriberByEmail(email: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: {
      email: normalizeEmail(email)
    }
  });

  return subscriber ? toSubscriberRecord(subscriber) : null;
}

export async function readSubscriberByDownloadToken(downloadToken: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: {
      downloadToken
    }
  });

  return subscriber ? toSubscriberRecord(subscriber) : null;
}

export async function readSubscriberByUnsubscribeToken(unsubscribeToken: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: {
      unsubscribeToken
    }
  });

  return subscriber ? toSubscriberRecord(subscriber) : null;
}

export async function createSubscriber(values: {
  name: string;
  email: string;
  source?: SubscriberSource;
  status?: SubscriberStatus;
  consentGiven: boolean;
}) {
  const now = new Date();
  const subscriber = await prisma.subscriber.create({
    data: {
      id: createId(),
      name: values.name.trim(),
      email: normalizeEmail(values.email),
      source: values.source ?? "manual",
      status: values.status ?? "active",
      consentGiven: values.consentGiven,
      downloadToken: createToken(),
      unsubscribeToken: createToken(),
      createdAt: now,
      updatedAt: now,
      unsubscribedAt: values.status === "unsubscribed" ? now : null
    }
  });

  return toSubscriberRecord(subscriber);
}

export async function updateSubscriber(values: {
  id: string;
  name: string;
  email: string;
  source?: SubscriberSource;
  status: SubscriberStatus;
  consentGiven: boolean;
}) {
  const now = new Date();
  const existing = await prisma.subscriber.findUnique({
    where: {
      id: values.id
    }
  });

  if (!existing) {
    throw new Error("Subscriber not found.");
  }

  const subscriber = await prisma.subscriber.update({
    where: {
      id: values.id
    },
    data: {
      name: values.name.trim(),
      email: normalizeEmail(values.email),
      source: values.source ?? (existing.source as SubscriberSource),
      status: values.status,
      consentGiven: values.consentGiven,
      updatedAt: now,
      unsubscribedAt: values.status === "unsubscribed" ? existing.unsubscribedAt ?? now : null
    }
  });

  return toSubscriberRecord(subscriber);
}

export async function deleteSubscriber(subscriberId: string) {
  await prisma.subscriber.delete({
    where: {
      id: subscriberId
    }
  });
}

export async function markSubscriberUnsubscribed(subscriberId: string) {
  const now = new Date();
  const subscriber = await prisma.subscriber.update({
    where: {
      id: subscriberId
    },
    data: {
      status: "unsubscribed",
      updatedAt: now,
      unsubscribedAt: now
    }
  });

  return toSubscriberRecord(subscriber);
}

export async function unsubscribeSubscriberByToken(unsubscribeToken: string) {
  const subscriber = await prisma.subscriber.findUnique({
    where: {
      unsubscribeToken
    }
  });

  if (!subscriber) {
    return null;
  }

  if (subscriber.status === "unsubscribed") {
    return toSubscriberRecord(subscriber);
  }

  const now = new Date();
  const updated = await prisma.subscriber.update({
    where: {
      id: subscriber.id
    },
    data: {
      status: "unsubscribed",
      updatedAt: now,
      unsubscribedAt: now
    }
  });

  return toSubscriberRecord(updated);
}

export async function upsertExclusiveSubscriber(values: {
  name: string;
  email: string;
  consentGiven: boolean;
}) {
  const now = new Date();
  const normalizedEmail = normalizeEmail(values.email);
  const existing = await prisma.subscriber.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  if (existing) {
    const updated = await prisma.subscriber.update({
      where: {
        id: existing.id
      },
      data: {
        name: values.name.trim() || existing.name,
        source: existing.source || "exclusive",
        status: "active",
        consentGiven: values.consentGiven,
        updatedAt: now,
        unsubscribedAt: null
      }
    });

    return {
      subscriber: toSubscriberRecord(updated),
      isDuplicate: true
    };
  }

  const created = await prisma.subscriber.create({
    data: {
      id: createId(),
      name: values.name.trim(),
      email: normalizedEmail,
      source: "exclusive",
      status: "active",
      consentGiven: values.consentGiven,
      downloadToken: createToken(),
      unsubscribeToken: createToken(),
      createdAt: now,
      updatedAt: now
    }
  });

  return {
    subscriber: toSubscriberRecord(created),
    isDuplicate: false
  };
}

export async function readAudienceOverview(): Promise<AudienceOverview> {
  const [total, active, unsubscribed, consented, exclusive, manual] = await Promise.all([
    prisma.subscriber.count(),
    prisma.subscriber.count({where: {status: "active"}}),
    prisma.subscriber.count({where: {status: "unsubscribed"}}),
    prisma.subscriber.count({where: {status: "active", consentGiven: true}}),
    prisma.subscriber.count({where: {source: "exclusive"}}),
    prisma.subscriber.count({where: {source: "manual"}})
  ]);

  return {
    total_subscribers: total,
    active_subscribers: active,
    unsubscribed_subscribers: unsubscribed,
    consented_subscribers: consented,
    exclusive_subscribers: exclusive,
    manual_subscribers: manual
  };
}

function getAudienceWhereClause(audienceFilter: AudienceFilter) {
  if (audienceFilter === "exclusive_source") {
    return {
      status: "active",
      consentGiven: true,
      source: "exclusive"
    };
  }

  if (audienceFilter === "manual_source") {
    return {
      status: "active",
      consentGiven: true,
      source: "manual"
    };
  }

  return {
    status: "active",
    consentGiven: true
  };
}

export async function countAudienceRecipients(audienceFilter: AudienceFilter) {
  return prisma.subscriber.count({
    where: getAudienceWhereClause(audienceFilter)
  });
}

export async function listAudienceRecipients(audienceFilter: AudienceFilter) {
  const subscribers = await prisma.subscriber.findMany({
    where: getAudienceWhereClause(audienceFilter),
    orderBy: [{createdAt: "asc"}]
  });

  return subscribers.map(toSubscriberRecord);
}

export async function listCampaigns() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: [{createdAt: "desc"}]
  });

  return campaigns.map(toEmailCampaignRecord);
}

export async function readCampaign(campaignId: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: {
      id: campaignId
    }
  });

  return campaign ? toEmailCampaignRecord(campaign) : null;
}

export async function saveCampaign(input: EmailCampaignRecord) {
  const now = new Date();
  const existing = await prisma.emailCampaign.findUnique({
    where: {
      id: input.id
    }
  });

  if (existing && existing.status === "sent") {
    throw new Error("Sent campaigns can no longer be edited.");
  }

  const campaign = await prisma.emailCampaign.upsert({
    where: {
      id: input.id
    },
    create: {
      id: input.id,
      subject: input.subject.trim(),
      previewText: input.preview_text.trim(),
      body: input.body,
      ctaLabel: input.cta_label.trim(),
      ctaUrl: input.cta_url.trim(),
      audienceFilter: input.audience_filter,
      status: input.status,
      recipientCount: input.recipient_count,
      sentAt: input.sent_at ? toDate(input.sent_at) : null,
      createdAt: toDate(input.created_at, now),
      updatedAt: toDate(input.updated_at, now)
    },
    update: {
      subject: input.subject.trim(),
      previewText: input.preview_text.trim(),
      body: input.body,
      ctaLabel: input.cta_label.trim(),
      ctaUrl: input.cta_url.trim(),
      audienceFilter: input.audience_filter,
      status: input.status,
      recipientCount: input.recipient_count,
      sentAt: input.sent_at ? toDate(input.sent_at) : null,
      updatedAt: now
    }
  });

  return toEmailCampaignRecord(campaign);
}

export async function updateCampaignStatus(values: {
  id: string;
  status: EmailCampaignStatus;
  recipientCount?: number;
  sentAt?: string | null;
}) {
  const campaign = await prisma.emailCampaign.update({
    where: {
      id: values.id
    },
    data: {
      status: values.status,
      recipientCount: values.recipientCount,
      sentAt:
        values.sentAt === undefined
          ? undefined
          : values.sentAt
            ? toDate(values.sentAt)
            : null,
      updatedAt: new Date()
    }
  });

  return toEmailCampaignRecord(campaign);
}

export async function deleteCampaign(campaignId: string) {
  const existing = await prisma.emailCampaign.findUnique({
    where: {
      id: campaignId
    }
  });

  if (!existing) {
    return;
  }

  if (existing.status === "sent") {
    throw new Error("Sent campaigns cannot be deleted.");
  }

  await prisma.emailCampaign.delete({
    where: {
      id: campaignId
    }
  });
}

export async function createEmailSendLog(values: {
  campaignId: string;
  subscriberId: string | null;
  email: string;
  status: EmailSendLogStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  const log = await prisma.emailSendLog.create({
    data: {
      id: createId(),
      campaignId: values.campaignId,
      subscriberId: values.subscriberId,
      email: normalizeEmail(values.email),
      status: values.status,
      providerMessageId: values.providerMessageId ?? null,
      errorMessage: values.errorMessage ?? null,
      sentAt: values.sentAt ? toDate(values.sentAt) : null,
      createdAt: new Date()
    }
  });

  return toEmailSendLogRecord(log);
}

export async function listEmailSendLogs() {
  const logs = await prisma.emailSendLog.findMany({
    orderBy: [{createdAt: "desc"}],
    take: 200
  });

  return logs.map(toEmailSendLogRecord);
}

