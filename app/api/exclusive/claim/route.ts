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
    const response: ExclusiveClaimResponse = {
      downloadUrl: `/api/exclusive/download?token=${encodeURIComponent(
        subscriber.download_token
      )}`,
      isDuplicate,
      message: isDuplicate
        ? offer.duplicate_message
        : offer.success_message || "Your download is unlocked below.",
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
