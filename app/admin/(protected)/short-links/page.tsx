import type {Metadata} from "next";
import {headers} from "next/headers";

import {ShortLinksAdminPage} from "@/components/short-links-admin-page";
import {readReleaseSummaries} from "@/lib/repositories/releases";
import {
  readShortLinksForAdmin
} from "@/lib/repositories/short-links";
import type {ShortLinkAdminFilter} from "@/lib/types";

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

const shortLinkFilters = ["ACTIVE", "ARCHIVED", "PAUSED", "DELETED"] as const satisfies readonly ShortLinkAdminFilter[];

function normalizeShortLinkFilter(value: string | string[] | undefined): ShortLinkAdminFilter {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue = rawValue?.toUpperCase();

  return shortLinkFilters.includes(normalizedValue as ShortLinkAdminFilter)
    ? (normalizedValue as ShortLinkAdminFilter)
    : "ACTIVE";
}

function getStringParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

export default async function AdminShortLinksPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string | string[];
    destinationUrl?: string | string[];
    releaseId?: string | string[];
    campaignLabel?: string | string[];
    contentLabel?: string | string[];
    utmSource?: string | string[];
    utmMedium?: string | string[];
    utmCampaign?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const statusFilter = normalizeShortLinkFilter(params.status);
  const [baseUrl, links, releases] = await Promise.all([
    getBaseUrl(),
    readShortLinksForAdmin(statusFilter),
    readReleaseSummaries()
  ]);

  const prefill = {
    destinationUrl: getStringParam(params.destinationUrl),
    releaseId: getStringParam(params.releaseId),
    campaignLabel: getStringParam(params.campaignLabel),
    contentLabel: getStringParam(params.contentLabel),
    utmSource: getStringParam(params.utmSource),
    utmMedium: getStringParam(params.utmMedium),
    utmCampaign: getStringParam(params.utmCampaign)
  };

  return (
    <ShortLinksAdminPage
      baseUrl={baseUrl}
      initialLinks={links}
      releaseOptions={releases}
      statusFilter={statusFilter}
      prefill={prefill}
    />
  );
}
