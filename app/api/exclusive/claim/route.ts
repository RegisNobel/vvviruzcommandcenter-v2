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
import type {ExclusiveClaimResponse} from "@/lib/types";

const claimSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailField("Enter a valid email address."),
  consent_given: z.boolean().default(false)
});

const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

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

export async function POST(request: Request) {
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

  try {
    const payload = claimSchema.parse(await request.json());
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

    const {subscriber, isDuplicate} = await upsertExclusiveSubscriber({
      name: payload.name,
      email: payload.email,
      consentGiven: payload.consent_given
    });

    let targetLink = "";
    if (offer.private_external_url?.trim()) {
      targetLink = offer.private_external_url.trim();
    } else if (offer.exclusive_track_file_path?.trim()) {
      const baseUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
      targetLink = `${baseUrl}/api/exclusive/download?token=${encodeURIComponent(subscriber.download_token)}`;
    }

    if (offer.unlock_experience === "email_only" || offer.also_email_link) {
      if (offer.email_subject?.trim() && offer.email_body?.trim()) {
        try {
          await sendCampaignEmail({
            to: subscriber.email,
            subject: offer.email_subject,
            previewText: "",
            body: offer.email_body,
            ctaLabel: offer.instant_unlock_button_label || "Access Exclusive",
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
    }

    const response: ExclusiveClaimResponse = {
      downloadUrl: offer.exclusive_track_file_path?.trim() ? `/api/exclusive/download?token=${encodeURIComponent(
        subscriber.download_token
      )}` : undefined,
      privateExternalUrl: offer.private_external_url?.trim() || undefined,
      unlockExperience: offer.unlock_experience,
      instantUnlockButtonLabel: offer.instant_unlock_button_label || "Listen Now",
      isDuplicate,
      message: isDuplicate
        ? offer.duplicate_message
        : offer.success_message || "Your exclusive is unlocked.",
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
      {message: "Unable to unlock the exclusive track right now."},
      {status: 500}
    );
  }
}
