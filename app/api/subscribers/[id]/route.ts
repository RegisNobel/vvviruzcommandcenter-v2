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
import {adminErrorResponse} from "@/lib/server/admin-error-response";

const subscriberUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailField("Enter a valid email."),
  source: z.enum(["exclusive", "vault", "manual"]).default("manual"),
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
    return adminErrorResponse(error, {
      context: "audience.subscriber.update",
      fallbackMessage: "The subscriber could not be updated."
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

  const {id} = await params;

  try {
    await deleteSubscriber(id);

    return NextResponse.json({message: "Subscriber deleted."});
  } catch (error) {
    return adminErrorResponse(error, {
      context: "audience.subscriber.delete",
      fallbackMessage: "The subscriber could not be deleted."
    });
  }
}
