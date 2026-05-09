import "server-only";

import {createHash} from "node:crypto";

import {readSiteSettings} from "@/lib/repositories/site-settings";

export type MetaConversionsEventName = "ViewContent" | "Lead";

type MetaConversionsEventInput = {
  eventId: string;
  eventName: MetaConversionsEventName;
  eventSourceUrl: string;
  clientIpAddress: string;
  clientUserAgent: string;
  fbc?: string;
  fbp?: string;
  visitorId?: string;
  releaseId?: string | null;
  releaseTitle?: string;
  linkLabel?: string;
  linkType?: string;
  targetUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getGraphApiVersion() {
  return clean(process.env.META_GRAPH_API_VERSION) || "v22.0";
}

async function getDatasetId() {
  const envDatasetId = clean(process.env.META_DATASET_ID) || clean(process.env.META_PIXEL_ID);

  if (envDatasetId) {
    return envDatasetId;
  }

  const siteSettings = await readSiteSettings();

  return clean(siteSettings.site_content.analytics.meta_pixel_id);
}

function getAccessToken() {
  return clean(process.env.META_CAPI_ACCESS_TOKEN);
}

function getOptionalTestEventCode() {
  return clean(process.env.META_TEST_EVENT_CODE);
}

function toUnixSeconds(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== undefined && value !== null && value !== "";
    })
  );
}

function buildCustomData(input: MetaConversionsEventInput) {
  return compactRecord({
    content_category:
      input.eventName === "Lead" ? "streaming_outbound_click" : "music_release",
    content_ids: input.releaseId ? [input.releaseId] : undefined,
    content_name: clean(input.releaseTitle),
    content_type: "music_release",
    link_label: clean(input.linkLabel),
    page: "links",
    platform: clean(input.linkType),
    target_url: clean(input.targetUrl),
    utm_source: clean(input.utmSource),
    utm_medium: clean(input.utmMedium),
    utm_campaign: clean(input.utmCampaign),
    utm_content: clean(input.utmContent),
    utm_term: clean(input.utmTerm)
  });
}

function buildUserData(input: MetaConversionsEventInput) {
  return compactRecord({
    client_ip_address: clean(input.clientIpAddress),
    client_user_agent: clean(input.clientUserAgent),
    external_id: input.visitorId ? [sha256(input.visitorId)] : undefined,
    fbc: clean(input.fbc),
    fbp: clean(input.fbp)
  });
}

export async function sendMetaConversionsApiEvent(input: MetaConversionsEventInput) {
  const accessToken = getAccessToken();
  const datasetId = await getDatasetId();

  if (!accessToken || !datasetId || !input.eventId || !input.eventSourceUrl) {
    return {
      skipped: true
    };
  }

  const url = new URL(
    `https://graph.facebook.com/${getGraphApiVersion()}/${encodeURIComponent(datasetId)}/events`
  );
  const testEventCode = getOptionalTestEventCode();

  url.searchParams.set("access_token", accessToken);

  const payload = compactRecord({
    data: [
      {
        action_source: "website",
        custom_data: buildCustomData(input),
        event_id: input.eventId,
        event_name: input.eventName,
        event_source_url: input.eventSourceUrl,
        event_time: toUnixSeconds(),
        user_data: buildUserData(input)
      }
    ],
    test_event_code: testEventCode || undefined
  });

  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const message = await response.text();

      console.warn("Meta Conversions API event failed.", {
        eventName: input.eventName,
        status: response.status,
        response: message.slice(0, 500)
      });
    }

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    console.warn("Meta Conversions API request failed.", {
      eventName: input.eventName,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    return {
      ok: false
    };
  }
}
