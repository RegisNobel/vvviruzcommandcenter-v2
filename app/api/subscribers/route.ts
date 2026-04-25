export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {
  createSubscriber,
  listSubscribers,
  readAudienceOverview
} from "@/lib/repositories/audience";
import type {SubscriberSource, SubscriberStatus} from "@/lib/types";

const subscriberCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email."),
  source: z.enum(["exclusive", "manual"]).default("manual"),
  status: z.enum(["active", "unsubscribed"]).default("active"),
  consent_given: z.boolean().default(false)
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = (url.searchParams.get("status")?.trim() || "all") as
    | SubscriberStatus
    | "all";
  const [subscribers, overview] = await Promise.all([
    listSubscribers({search, status}),
    readAudienceOverview()
  ]);

  return NextResponse.json({subscribers, overview});
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const payload = subscriberCreateSchema.parse(await request.json());
    const subscriber = await createSubscriber({
      name: payload.name,
      email: payload.email,
      source: payload.source as SubscriberSource,
      status: payload.status,
      consentGiven: payload.consent_given
    });

    return NextResponse.json({subscriber, message: "Subscriber added."});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid subscriber data."},
        {status: 400}
      );
    }

    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to add subscriber."},
      {status: 400}
    );
  }
}

