export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {listSubscribers} from "@/lib/repositories/audience";

function escapeCsvValue(value: string | boolean | null) {
  const normalizedValue =
    value === null ? "" : typeof value === "boolean" ? (value ? "true" : "false") : value;
  const escapedValue = normalizedValue.replace(/"/g, "\"\"");

  return `"${escapedValue}"`;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const subscribers = await listSubscribers({status: "all"});
  const rows = [
    [
      "Name",
      "Email",
      "Source",
      "Status",
      "Consent",
      "Created At",
      "Updated At",
      "Unsubscribed At",
      "Source Offer Mode",
      "Source Offer Name",
      "Source Signup Context",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "UTM Content",
      "UTM Term",
      "Referrer",
      "Landing Page",
      "Consent Status",
      "Unsubscribe Status"
    ].join(","),
    ...subscribers.map((subscriber) =>
      [
        subscriber.name,
        subscriber.email,
        subscriber.source,
        subscriber.status,
        subscriber.consent_given,
        subscriber.created_at,
        subscriber.updated_at,
        subscriber.unsubscribed_at,
        subscriber.source_offer_mode,
        subscriber.source_offer_name,
        subscriber.source_signup_context,
        subscriber.source_utm_source,
        subscriber.source_utm_medium,
        subscriber.source_utm_campaign,
        subscriber.source_utm_content,
        subscriber.source_utm_term,
        subscriber.source_referrer,
        subscriber.source_landing_page,
        subscriber.consent_given ? "consented" : "not consented",
        subscriber.status === "unsubscribed" ? "unsubscribed" : "subscribed"
      ]
        .map(escapeCsvValue)
        .join(",")
    )
  ];
  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vvviruz-subscribers.csv"',
      "Cache-Control": "no-store"
    }
  });
}
