import type {Metadata} from "next";
import {headers} from "next/headers";

import {ShortLinksAdminPage} from "@/components/short-links-admin-page";
import {readReleaseSummaries} from "@/lib/repositories/releases";
import {readActiveShortLinks} from "@/lib/repositories/short-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Short Links"
};

async function getBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/g, "");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

export default async function AdminShortLinksPage() {
  const [baseUrl, links, releases] = await Promise.all([
    getBaseUrl(),
    readActiveShortLinks(),
    readReleaseSummaries()
  ]);

  return (
    <ShortLinksAdminPage
      baseUrl={baseUrl}
      initialLinks={links}
      releaseOptions={releases}
    />
  );
}
