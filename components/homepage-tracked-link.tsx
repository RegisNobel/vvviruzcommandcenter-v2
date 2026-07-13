"use client";

import Link from "next/link";
import type {MouseEvent, ReactNode} from "react";

type HomepageEventType =
  | "homepage_primary_cta_click"
  | "project_card_click"
  | "workout_collection_click"
  | "homepage_exclusives_click";

function createEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `home-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function HomepageTrackedLink({
  children,
  className,
  eventType,
  href,
  linkLabel = "",
  linkType = "",
  releaseId = null,
  target
}: {
  children: ReactNode;
  className?: string;
  eventType: HomepageEventType;
  href: string;
  linkLabel?: string;
  linkType?: string;
  releaseId?: string | null;
  target?: "_blank";
}) {
  function trackClick(_event: MouseEvent<HTMLAnchorElement>) {
    const payload = JSON.stringify({
      eventId: createEventId(),
      eventType,
      linkLabel,
      linkType,
      page: "home",
      path: window.location.pathname,
      releaseId,
      targetUrl: href
    });

    try {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
          "/api/analytics/track",
          new Blob([payload], {type: "application/json"})
        );

        if (sent) {
          return;
        }
      }

      void fetch("/api/analytics/track", {
        body: payload,
        headers: {"Content-Type": "application/json"},
        keepalive: true,
        method: "POST"
      });
    } catch {
      // Analytics must never interrupt public navigation.
    }
  }

  return (
    <Link
      className={className}
      href={href}
      onClick={trackClick}
      rel={target === "_blank" ? "noreferrer" : undefined}
      target={target}
    >
      {children}
    </Link>
  );
}
