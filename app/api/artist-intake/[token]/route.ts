export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {sendCampaignEmail} from "@/lib/email/campaigns";
import {
  consumeRateLimit,
  getClientIpAddress,
  retryAfterSeconds
} from "@/lib/public-rate-limit";
import {
  recordArtistIntakeNotificationResult,
  saveArtistIntakeResponse
} from "@/lib/repositories/artist-intakes";
import {readSiteSettings} from "@/lib/repositories/site-settings";

const requestSchema = z.object({
  intent: z.enum(["save", "submit"]),
  response: z.unknown(),
  bot_test_field: z.string().optional().default("")
});

export async function POST(
  request: Request,
  {params}: {params: Promise<{token: string}>}
) {
  try {
    const {token} = await params;
    const throttle = await consumeRateLimit({
      bucket: "artist-intake-save",
      key: getClientIpAddress(request),
      maxAttempts: 60,
      windowMs: 60 * 60 * 1000,
      blockMs: 15 * 60 * 1000
    });
    if (!throttle.allowed) {
      return NextResponse.json(
        {message: "Too many intake requests. Try again shortly."},
        {
          status: 429,
          headers: {"Retry-After": String(retryAfterSeconds(throttle.retryAfterMs))}
        }
      );
    }

    const body = requestSchema.parse(await request.json());
    if (body.bot_test_field) {
      return NextResponse.json({status: body.intent === "submit" ? "SUBMITTED" : "DRAFT"});
    }

    const result = await saveArtistIntakeResponse({
      token,
      response: body.response,
      submit: body.intent === "submit"
    });

    if (body.intent === "submit") {
      try {
        const settings = await readSiteSettings();
        const adminEmail = settings.contact_email.trim();
        const baseUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
        if (adminEmail) {
          await sendCampaignEmail({
            to: adminEmail,
            subject: `Artist intake submitted: ${result.artistName}`,
            previewText: `${result.artistName} completed the managed artist intake.`,
            body: `${result.artistName} (${result.inviteeEmail}) submitted the managed artist intake. Review the source material before creating or updating any public profile.`,
            ctaLabel: "Review artist intake",
            ctaUrl: `${baseUrl}/admin/artists/intake/${result.id}`,
            unsubscribeUrl: baseUrl
          });
          await recordArtistIntakeNotificationResult({
            id: result.id,
            status: "SENT"
          });
        } else {
          await recordArtistIntakeNotificationResult({
            id: result.id,
            status: "NOT_CONFIGURED",
            error: "No command-center contact email is configured."
          });
        }
      } catch (error) {
        console.error("Artist intake notification failed:", error);
        try {
          await recordArtistIntakeNotificationResult({
            id: result.id,
            status: "FAILED",
            error:
              error instanceof Error
                ? error.message
                : "The submission notification could not be sent."
          });
        } catch (recordError) {
          console.error(
            "Artist intake notification failure could not be recorded:",
            recordError
          );
        }
      }
    }

    return NextResponse.json({
      status: result.status,
      message:
        result.status === "SUBMITTED"
          ? "Your intake has been submitted for review."
          : "Draft saved."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: error.issues[0]?.message || "Review the highlighted intake fields.",
          issues: error.issues.map((issue) => ({
            message: issue.message,
            path: issue.path.join(".")
          }))
        },
        {status: 400}
      );
    }
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The intake could not be saved."
      },
      {status: 400}
    );
  }
}
