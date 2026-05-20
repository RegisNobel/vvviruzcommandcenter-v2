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
import {readPublicExclusiveOffer} from "@/lib/repositories/exclusive-offer";
import {upsertExclusiveSubscriber} from "@/lib/repositories/audience";
import {
  buildCampaignUnsubscribeUrl,
  sendCampaignEmail
} from "@/lib/email/campaigns";
import {
  normalizePrivateExternalUrl,
  validateExclusiveEmailDeliverySettings
} from "@/lib/exclusive-offer-safety";
import type {ExclusiveClaimResponse} from "@/lib/types";

const claimSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailField("Enter a valid email address."),
  consent_given: z.boolean().default(false),
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

type UnlockExperience = ExclusiveClaimResponse["unlockExperience"];

const CLAIM_SUCCESS_MESSAGES: Record<UnlockExperience, string> = {
  instant_unlock: "You're in. Your preview is unlocked.",
  email_only: "You're in. Check your email for the preview.",
  signup_notify: "You're in. I'll send the preview/update when it's ready."
};

const CLAIM_DUPLICATE_MESSAGES: Record<UnlockExperience, string> = {
  instant_unlock: "You're already in. Your preview is unlocked.",
  email_only: "You're already on the list. Check your email for the preview.",
  signup_notify: "You're already on the list. I'll send the update when it's ready."
};

function isModeSafeClaimMessage(message: string, unlockExperience: UnlockExperience) {
  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return false;
  }

  if (unlockExperience === "instant_unlock") {
    return true;
  }

  return !/\b(download|downloaded|unlock|unlocked|listen now|access below)\b/i.test(
    normalizedMessage
  );
}

function getClaimMessage(
  unlockExperience: UnlockExperience,
  configuredMessage: string,
  isDuplicate: boolean
) {
  const fallback = isDuplicate
    ? CLAIM_DUPLICATE_MESSAGES[unlockExperience]
    : CLAIM_SUCCESS_MESSAGES[unlockExperience];

  return isModeSafeClaimMessage(configuredMessage, unlockExperience)
    ? configuredMessage.trim()
    : fallback;
}

function rateLimitResponse(state: RateLimitState) {
  return NextResponse.json(
    {message: "Too many signup attempts. Try again in a few minutes."},
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

function createFakeClaimSuccess(): ExclusiveClaimResponse {
  return {
    unlockExperience: "signup_notify",
    instantUnlockButtonLabel: "Listen Now",
    isDuplicate: false,
    message: CLAIM_SUCCESS_MESSAGES.signup_notify,
    subscriber: {
      id: "pending",
      name: "Subscriber",
      email: "subscriber@example.com",
      status: "active",
      consent_given: true
    }
  };
}

export async function POST(request: Request) {
  try {
    const rawPayload = await request.json();

    if (getBotTestFieldValue(rawPayload)) {
      return NextResponse.json(createFakeClaimSuccess());
    }

    const clientIp = getClientIpAddress(request);
    const ipThrottleState = await consumeRateLimit({
      bucket: "exclusive-claim-ip",
      key: clientIp,
      maxAttempts: 8,
      windowMs: TEN_MINUTES_MS,
      blockMs: FIFTEEN_MINUTES_MS
    });

    if (!ipThrottleState.allowed) {
      return rateLimitResponse(ipThrottleState);
    }

    const payload = claimSchema.parse(rawPayload);
    const emailThrottleState = await consumeRateLimit({
      bucket: "exclusive-claim-email",
      key: payload.email,
      maxAttempts: 3,
      windowMs: TEN_MINUTES_MS,
      blockMs: FIFTEEN_MINUTES_MS
    });

    if (!emailThrottleState.allowed) {
      return rateLimitResponse(emailThrottleState);
    }

    const {offer, isAvailable} = await readPublicExclusiveOffer();

    if (!isAvailable) {
      return NextResponse.json(
        {message: "The exclusive track is unavailable right now."},
        {status: 503}
      );
    }

    const shouldSendEmail =
      offer.unlock_experience === "email_only" ||
      (offer.unlock_experience === "instant_unlock" && offer.also_email_link);
    const privateExternalUrl = offer.private_external_url?.trim()
      ? normalizePrivateExternalUrl(offer.private_external_url)
      : "";
    const publicSiteBaseUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const shouldUseUploadedTrack =
      !privateExternalUrl && Boolean(offer.exclusive_track_file_path?.trim());

    validateExclusiveEmailDeliverySettings(offer);

    if (shouldSendEmail && shouldUseUploadedTrack && !publicSiteBaseUrl) {
      throw new Error("PUBLIC_SITE_URL is required before email delivery can send preview links.");
    }

    const {subscriber, isDuplicate} = await upsertExclusiveSubscriber({
      name: payload.name,
      email: payload.email,
      consentGiven: payload.consent_given,
      sourceAttribution: {
        sourceUtmSource: payload.source_utm_source,
        sourceUtmMedium: payload.source_utm_medium,
        sourceUtmCampaign: payload.source_utm_campaign,
        sourceUtmContent: payload.source_utm_content,
        sourceUtmTerm: payload.source_utm_term,
        sourceReferrer: payload.source_referrer || request.headers.get("referer") || "",
        sourceLandingPage: payload.source_landing_page,
        sourceOfferMode:
          offer.unlock_experience === "signup_notify"
            ? "signup_notify_me"
            : offer.unlock_experience,
        sourceOfferName: offer.exclusive_track_title || "Early Access Preview List",
        sourceSignupContext:
          offer.unlock_experience === "signup_notify"
            ? "early_access_preview_list"
            : "exclusives_page"
      }
    });

    let targetLink = "";
    if (privateExternalUrl) {
      targetLink = privateExternalUrl;
    } else if (offer.exclusive_track_file_path?.trim()) {
      targetLink = publicSiteBaseUrl
        ? `${publicSiteBaseUrl}/api/exclusive/download?token=${encodeURIComponent(subscriber.download_token)}`
        : "";
    }

    if (shouldSendEmail) {
      try {
        await sendCampaignEmail({
          to: subscriber.email,
          subject: offer.email_subject,
          previewText: "",
          body: offer.email_body,
          ctaLabel: offer.instant_unlock_button_label || "Access Preview",
          ctaUrl: targetLink || undefined,
          unsubscribeUrl: buildCampaignUnsubscribeUrl(subscriber.unsubscribe_token)
        });
      } catch (emailError) {
        console.error("Failed to send transactional exclusive email:", emailError);
        if (offer.unlock_experience === "email_only") {
          throw new Error("Unable to send the email right now. Please try again later.");
        }
      }
    }

    const isInstantUnlock = offer.unlock_experience === "instant_unlock";
    const response: ExclusiveClaimResponse = {
      downloadUrl: isInstantUnlock && offer.exclusive_track_file_path?.trim()
        ? `/api/exclusive/download?token=${encodeURIComponent(subscriber.download_token)}`
        : undefined,
      privateExternalUrl: isInstantUnlock ? privateExternalUrl || undefined : undefined,
      unlockExperience: offer.unlock_experience,
      instantUnlockButtonLabel: offer.instant_unlock_button_label || "Listen Now",
      isDuplicate,
      message: getClaimMessage(
        offer.unlock_experience,
        isDuplicate ? offer.duplicate_message : offer.success_message,
        isDuplicate
      ),
      subscriber: {
        id: subscriber.id,
        name: subscriber.name,
        email: subscriber.email,
        status: subscriber.status,
        consent_given: subscriber.consent_given
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid signup data."},
        {status: 400}
      );
    }

    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to complete signup right now."},
      {status: 500}
    );
  }
}
