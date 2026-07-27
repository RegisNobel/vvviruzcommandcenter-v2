import "server-only";

import {getPublicSiteBaseUrl, getPublicSiteUrl} from "@/lib/public-site-url";

const indexNowEndpoint = "https://api.indexnow.org/indexnow";

function getIndexNowKey() {
  const key = process.env.INDEXNOW_KEY?.trim() || "";

  return /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : "";
}

export function isIndexNowConfigured() {
  return Boolean(getIndexNowKey());
}

export async function submitIndexNowUrls(paths: string[]) {
  const key = getIndexNowKey();

  if (!key) {
    return {configured: false, submitted: 0};
  }

  const baseUrl = getPublicSiteBaseUrl();
  const urls = Array.from(
    new Set(
      paths
        .map((path) => getPublicSiteUrl(path))
        .filter((url) => url.startsWith(`${baseUrl}/`) || url === baseUrl)
    )
  ).slice(0, 10_000);

  if (urls.length === 0) {
    return {configured: true, submitted: 0};
  }

  try {
    const response = await fetch(indexNowEndpoint, {
      body: JSON.stringify({
        host: new URL(baseUrl).hostname,
        key,
        keyLocation: getPublicSiteUrl("/indexnow-key.txt"),
        urlList: urls
      }),
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "POST",
      signal: AbortSignal.timeout(5_000)
    });

    return {
      configured: true,
      submitted: response.ok ? urls.length : 0
    };
  } catch {
    return {configured: true, submitted: 0};
  }
}
