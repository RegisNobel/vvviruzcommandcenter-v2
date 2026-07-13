"use client";

import Link from "next/link";
import {useEffect, useRef, type MouseEvent, type ReactNode} from "react";

type ProjectEventType =
  | "project_card_click"
  | "project_hub_release_click"
  | "release_project_link_click";

type ProjectAnalyticsPage = "projects" | "release";

function createEventId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getUtmContext() {
  const params = new URLSearchParams(window.location.search);

  return {
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmMedium: params.get("utm_medium") || "",
    utmSource: params.get("utm_source") || "",
    utmTerm: params.get("utm_term") || ""
  };
}

function sendProjectEvent(payload: Record<string, unknown>) {
  const body = JSON.stringify({...getUtmContext(), ...payload});

  try {
    if (
      navigator.sendBeacon?.(
        "/api/analytics/track",
        new Blob([body], {type: "application/json"})
      )
    ) {
      return;
    }

    void fetch("/api/analytics/track", {
      body,
      headers: {"Content-Type": "application/json"},
      keepalive: true,
      method: "POST"
    });
  } catch {
    // Measurement must never interrupt public navigation.
  }
}

export function ProjectsIndexAnalytics() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }

    hasTracked.current = true;
    sendProjectEvent({
      eventId: createEventId("projects-view"),
      eventType: "projects_index_view",
      page: "projects",
      path: `${window.location.pathname}${window.location.search}`
    });
  }, []);

  return null;
}

export function ProjectTrackedLink({
  categorySlug,
  children,
  className,
  eventType,
  href,
  page,
  position,
  releaseId = null,
  sourcePage
}: {
  categorySlug: string;
  children: ReactNode;
  className?: string;
  eventType: ProjectEventType;
  href: string;
  page: ProjectAnalyticsPage;
  position?: number;
  releaseId?: string | null;
  sourcePage: string;
}) {
  function trackClick(_event: MouseEvent<HTMLAnchorElement>) {
    sendProjectEvent({
      eventId: createEventId("project-click"),
      eventType,
      hubPath: `/projects/${categorySlug}`,
      linkLabel: position ? `${categorySlug}:${position}` : categorySlug,
      linkType: sourcePage,
      page,
      path: `${window.location.pathname}${window.location.search}`,
      releaseId,
      targetUrl: href
    });
  }

  return (
    <Link className={className} href={href} onClick={trackClick}>
      {children}
    </Link>
  );
}
