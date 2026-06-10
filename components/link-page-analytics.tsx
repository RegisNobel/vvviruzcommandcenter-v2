"use client";

import {useEffect} from "react";

type LinkPageAnalyticsProps = {
  releaseId: string;
  releaseTitle: string;
  hubPath?: string;
};

type MetaPixelValue = number | string | string[];
type MetaPixelOptions = {
  eventID?: string;
};

declare global {
  interface Window {
    fbq?: (
      method: "track" | "trackCustom",
      eventName: string,
      params?: Record<string, MetaPixelValue>,
      options?: MetaPixelOptions
    ) => void;
  }
}

const streamingPlatformLinkTypes = new Set([
  "apple-music",
  "spotify",
  "youtube-music",
  "youtube-video"
]);

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || ""
  };
}

function toMetaUtmParams(utmParams: ReturnType<typeof getUtmParams>) {
  return {
    utm_source: utmParams.utmSource,
    utm_medium: utmParams.utmMedium,
    utm_campaign: utmParams.utmCampaign,
    utm_content: utmParams.utmContent,
    utm_term: utmParams.utmTerm
  };
}

function trackMetaPixel(
  method: "track" | "trackCustom",
  eventName: string,
  params: Record<string, MetaPixelValue>,
  eventId?: string,
  attempt = 0
) {
  if (typeof window.fbq !== "function") {
    if (attempt < 10) {
      window.setTimeout(() => trackMetaPixel(method, eventName, params, eventId, attempt + 1), 250);
    }

    return;
  }

  window.fbq(method, eventName, params, eventId ? {eventID: eventId} : undefined);
}

function createMetaEventId(prefix: string) {
  const randomId = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

  return `${prefix}.${Date.now()}.${randomId}`;
}

function isStreamingPlatformLink(linkType: string) {
  return streamingPlatformLinkTypes.has(linkType);
}

function track(payload: Record<string, string | undefined>) {
  const body = JSON.stringify({
    page: "links",
    path: `${window.location.pathname}${window.location.search}`,
    ...getUtmParams(),
    ...payload
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", new Blob([body], {type: "application/json"}));
    return;
  }

  void fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  });
}

export function LinkPageAnalytics({releaseId, releaseTitle, hubPath = "/links"}: LinkPageAnalyticsProps) {
  useEffect(() => {
    const utmParams = getUtmParams();
    const viewContentEventId = createMetaEventId("links-view-content");

    track({
      eventType: "links_page_view",
      metaEventId: viewContentEventId,
      metaEventName: "ViewContent",
      releaseId,
      releaseTitle,
      hubPath
    });

    trackMetaPixel("track", "ViewContent", {
      content_ids: [releaseId],
      content_name: releaseTitle,
      content_type: "music_release",
      page: "links",
      hub_path: hubPath,
      ...toMetaUtmParams(utmParams)
    }, viewContentEventId);

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-event]")
        : null;

      if (!target) {
        return;
      }

      const linkType = target.dataset.analyticsLinkType || "";
      const linkLabel = target.dataset.analyticsLinkLabel || target.textContent?.trim() || "";
      const targetUrl = target.dataset.analyticsTargetUrl || "";
      const shouldTrackMetaConversion = isStreamingPlatformLink(linkType);
      const leadEventId = shouldTrackMetaConversion
        ? createMetaEventId("links-streaming-click")
        : undefined;

      track({
        eventType: target.dataset.analyticsEvent || "links_link_click",
        releaseId,
        linkType,
        linkLabel,
        metaEventId: leadEventId,
        metaEventName: shouldTrackMetaConversion ? "Lead" : undefined,
        releaseTitle,
        targetUrl,
        hubPath
      });

      if (!shouldTrackMetaConversion || !leadEventId) {
        return;
      }

      const metaClickParams = {
        content_category: "streaming_outbound_click",
        content_ids: [releaseId],
        content_name: releaseTitle,
        content_type: "music_release",
        link_label: linkLabel,
        page: "links",
        hub_path: hubPath,
        platform: linkType,
        target_url: targetUrl,
        ...toMetaUtmParams(getUtmParams())
      };

      trackMetaPixel(
        "trackCustom",
        "StreamingOutboundClick",
        metaClickParams,
        leadEventId
      );

      trackMetaPixel("track", "Lead", {
        ...metaClickParams
      }, leadEventId);
    }

    document.addEventListener("click", handleClick);

    return () => document.removeEventListener("click", handleClick);
  }, [releaseId, releaseTitle, hubPath]);

  return null;
}
