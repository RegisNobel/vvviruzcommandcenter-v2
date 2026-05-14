export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {emailField} from "@/lib/email/validation";
import {
  consumeRateLimit,
  getClientIpAddress,
  retryAfterSeconds,
  type RateLimitState
} from "@/lib/public-rate-limit";
import {createCommissionRequest} from "@/lib/repositories/commissions";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import {sendCampaignEmail} from "@/lib/email/campaigns";

const commissionSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailField("Enter a valid email address."),
  requestType: z.string().trim().min(1, "Request type is required."),
  budgetRange: z.string().trim().min(1, "Budget range is required."),
  deadline: z.string().trim().min(1, "Deadline is required."),
  specificDeadline: z.string().trim().optional().default(""),
  topic: z.string().trim().min(1, "Topic/Concept is required."),
  beatLink: z.string().trim().optional().default(""),
  referenceLink: z.string().trim().optional().default(""),
  usageIntent: z.string().trim().min(1, "Usage intent is required."),
  additionalNotes: z.string().trim().optional().default(""),
  
  bot_test_field: z.string().optional().default(""),
  
  source_utm_source: z.string().optional().default(""),
  source_utm_medium: z.string().optional().default(""),
  source_utm_campaign: z.string().optional().default(""),
  source_utm_content: z.string().optional().default(""),
  source_utm_term: z.string().optional().default(""),
  source_referrer: z.string().optional().default(""),
  source_landing_page: z.string().optional().default("")
});

const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function rateLimitResponse(state: RateLimitState) {
  return NextResponse.json(
    {message: "Too many request attempts. Try again in a few minutes."},
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds(state.retryAfterMs))
      }
    }
  );
}

function getBotTestFieldValue(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("bot_test_field" in payload)) {
    return "";
  }

  const value = (payload as {bot_test_field?: unknown}).bot_test_field;
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const rawPayload = await request.json();

    if (getBotTestFieldValue(rawPayload)) {
      // Fake success for bots
      return NextResponse.json({message: "Request received."});
    }

    const clientIp = getClientIpAddress(request);
    const ipThrottleState = await consumeRateLimit({
      bucket: "commission-request-ip",
      key: clientIp,
      maxAttempts: 5,
      windowMs: TEN_MINUTES_MS,
      blockMs: FIFTEEN_MINUTES_MS
    });

    if (!ipThrottleState.allowed) {
      return rateLimitResponse(ipThrottleState);
    }

    const payload = commissionSchema.parse(rawPayload);
    const emailThrottleState = await consumeRateLimit({
      bucket: "commission-request-email",
      key: payload.email,
      maxAttempts: 3,
      windowMs: TEN_MINUTES_MS,
      blockMs: FIFTEEN_MINUTES_MS
    });

    if (!emailThrottleState.allowed) {
      return rateLimitResponse(emailThrottleState);
    }

    const requestRecord = await createCommissionRequest({
      name: payload.name,
      email: payload.email,
      requestType: payload.requestType,
      budgetRange: payload.budgetRange,
      deadline: payload.deadline,
      specificDeadline: payload.specificDeadline,
      topic: payload.topic,
      beatLink: payload.beatLink,
      referenceLink: payload.referenceLink,
      usageIntent: payload.usageIntent,
      additionalNotes: payload.additionalNotes,
      status: "New",
      quotedPrice: "",
      paypalLink: "",
      adminNotes: "",
      deliveryLink: "",
      utmSource: payload.source_utm_source,
      utmMedium: payload.source_utm_medium,
      utmCampaign: payload.source_utm_campaign,
      utmContent: payload.source_utm_content,
      utmTerm: payload.source_utm_term,
      referrer: payload.source_referrer || request.headers.get("referer") || "",
      landingPage: payload.source_landing_page
    });

    // Fire off admin notification email
    const siteSettings = await readSiteSettings();
    const adminEmail = siteSettings.contact_email;
    const baseUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");

    if (adminEmail) {
      try {
        await sendCampaignEmail({
          to: adminEmail,
          subject: `New Commission Request: ${payload.requestType} from ${payload.name}`,
          previewText: payload.topic,
          body: `A new commission request has been submitted.\n\nName: ${payload.name}\nEmail: ${payload.email}\nType: ${payload.requestType}\nBudget: ${payload.budgetRange}\nDeadline: ${payload.deadline}\nTopic: ${payload.topic}\n\nClick the link below to review the request in the admin dashboard.`,
          ctaLabel: "Review Request",
          ctaUrl: `${baseUrl}/admin/commissions/${requestRecord.id}`,
          unsubscribeUrl: baseUrl
        });
      } catch (err) {
        console.error("Failed to send admin notification email for commission:", err);
        // Do not block request creation if email fails
      }
    }

    return NextResponse.json({
      message: "Request received. I'll review it and reply with next steps if it's a fit."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid request data."},
        {status: 400}
      );
    }

    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to submit the request right now."},
      {status: 500}
    );
  }
}
