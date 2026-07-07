"use client";

import {useEffect} from "react";

type InsiderAccessAnalyticsProps = {
  releaseId?: string | null;
  releaseTitle?: string;
};

export function InsiderAccessAnalytics({
  releaseId,
  releaseTitle
}: InsiderAccessAnalyticsProps) {
  useEffect(() => {
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "exclusive_page_view",
          page: "preview"
        })
      });
    } catch (err) {
      console.error("Failed to track exclusives page view:", err);
    }
  }, []);

  return null;
}
