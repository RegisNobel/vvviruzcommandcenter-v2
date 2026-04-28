"use client";

import {useEffect} from "react";

type LinkPageAnalyticsProps = {
  releaseId: string;
};

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

export function LinkPageAnalytics({releaseId}: LinkPageAnalyticsProps) {
  useEffect(() => {
    track({
      eventType: "links_page_view",
      releaseId
    });

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-event]")
        : null;

      if (!target) {
        return;
      }

      track({
        eventType: target.dataset.analyticsEvent || "links_link_click",
        releaseId,
        linkType: target.dataset.analyticsLinkType || "",
        linkLabel: target.dataset.analyticsLinkLabel || target.textContent?.trim() || "",
        targetUrl: target.dataset.analyticsTargetUrl || ""
      });
    }

    document.addEventListener("click", handleClick);

    return () => document.removeEventListener("click", handleClick);
  }, [releaseId]);

  return null;
}
