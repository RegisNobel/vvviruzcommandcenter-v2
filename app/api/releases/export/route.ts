export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {prisma} from "@/lib/db/prisma";

function escapeCsvValue(value: string) {
  const normalizedValue = value.trim();
  const spreadsheetSafeValue = /^[=+\-@]/.test(normalizedValue)
    ? `'${normalizedValue}`
    : normalizedValue;

  return `"${spreadsheetSafeValue.replace(/"/g, "\"\"")}"`;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);

  if (auth instanceof Response) {
    return auth;
  }

  const releases = await prisma.release.findMany({
    where: {
      isPublished: true
    },
    select: {
      title: true,
      upc: true,
      isrc: true
    },
    orderBy: [
      {
        releaseDate: "desc"
      },
      {
        title: "asc"
      }
    ]
  });

  const rows = [
    ["Title", "UPC", "ISRC"].join(","),
    ...releases.map((release) =>
      [release.title, release.upc, release.isrc]
        .map(escapeCsvValue)
        .join(",")
    )
  ];
  const csv = `\uFEFF${rows.join("\r\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vvviruz-public-release-codes.csv"',
      "Cache-Control": "private, no-store"
    }
  });
}
