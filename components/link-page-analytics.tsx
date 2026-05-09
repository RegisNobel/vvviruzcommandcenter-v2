"use client";

import {useEffect} from "react";

type LinkPageAnalyticsProps = {
  releaseId: string;
  releaseTitle: string;
};

type MetaPixelValue = number | string | string[];

declare global {
  interface Window {
    fbq?: (
      method: "track" | "trackCustom",
      eventName: string,
      params?: Record<string, MetaPixelValue>
    ) => void;
  }
}

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
  attempt = 0
) {
  if (typeof window.fbq !== "function") {
    if (attempt < 10) {
      window.setTimeout(() => trackMetaPixel(method, eventName, params, attempt + 1), 250);
    }

    return;
  }

  window.fbq(method, eventName, params);
}

function track(payload: Record<string, string>) {
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

export function LinkPageAnalytics({releaseId, releaseTitle}: LinkPageAnalyticsProps) {
  useEffect(() => {
    const utmParams = getUtmParams();

    track({
      eventType: "links_page_view",
      releaseId
    });

    trackMetaPixel("track", "ViewContent", {
      content_ids: [releaseId],
      content_name: releaseTitle,
      content_type: "music_release",
      page: "links",
      ...toMetaUtmParams(utmParams)
    });

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

      track({
        eventType: target.dataset.analyticsEvent || "links_link_click",
        releaseId,
        linkType,
        linkLabel,
        targetUrl
      });

      trackMetaPixel("trackCustom", "StreamingOutboundClick", {
        content_ids: [releaseId],
        content_name: releaseTitle,
        content_type: "music_release",
        link_label: linkLabel,
        page: "links",
        platform: linkType,
        target_url: targetUrl,
        ...toMetaUtmParams(getUtmParams())
      });

      trackMetaPixel("track", "Lead", {
        content_category: "streaming_outbound_click",
        content_ids: [releaseId],
        content_name: releaseTitle,
        content_type: "music_release",
        link_label: linkLabel,
        page: "links",
        platform: linkType,
        target_url: targetUrl,
        ...toMetaUtmParams(getUtmParams())
      });
    }

    document.addEventListener("click", handleClick);

    return () => document.removeEventListener("click", handleClick);
  }, [releaseId, releaseTitle]);

  return null;
}
