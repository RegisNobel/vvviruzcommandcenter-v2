export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {emailField} from "@/lib/email/validation";
import {
  deleteSubscriber,
  markSubscriberUnsubscribed,
  updateSubscriber
} from "@/lib/repositories/audience";
import type {SubscriberSource} from "@/lib/types";

const subscriberUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailField("Enter a valid email."),
  source: z.enum(["exclusive", "manual"]).default("manual"),
  status: z.enum(["active", "unsubscribed"]),
  consent_given: z.boolean().default(false),
  unsubscribe: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  try {
    const payload = subscriberUpdateSchema.parse(await request.json());
    const {id} = await params;

    if (payload.unsubscribe) {
      const subscriber = await markSubscriberUnsubscribed(id);

      return NextResponse.json({subscriber, message: "Subscriber unsubscribed."});
    }

    const subscriber = await updateSubscriber({
      id,
      name: payload.name,
      email: payload.email,
      source: payload.source as SubscriberSource,
      status: payload.status,
      consentGiven: payload.consent_given
    });

    return NextResponse.json({subscriber, message: "Subscriber updated."});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {message: error.issues[0]?.message || "Invalid subscriber data."},
        {status: 400}
      );
    }

    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to update subscriber."},
      {status: 400}
    );
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

  const {id} = await params;

  try {
    await deleteSubscriber(id);

    return NextResponse.json({message: "Subscriber deleted."});
  } catch (error) {
    return NextResponse.json(
      {message: error instanceof Error ? error.message : "Unable to delete subscriber."},
      {status: 400}
    );
  }
}
