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
      "Unsubscribed At"
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
        subscriber.unsubscribed_at
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

