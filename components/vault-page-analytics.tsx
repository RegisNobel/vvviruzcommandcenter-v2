"use client";

import {useEffect} from "react";

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

export function VaultPageAnalytics() {
  useEffect(() => {
    function track(payload: Record<string, string | undefined>) {
      const body = JSON.stringify({
        page: "vault",
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

    track({ eventType: "vault_page_view" });

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-event]")
        : null;

      if (!target) return;

      track({
        eventType: target.dataset.analyticsEvent || "vault_cta_click"
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
