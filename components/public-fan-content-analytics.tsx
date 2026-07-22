"use client";

import Link from "next/link";
import {useEffect, type ComponentProps, type ReactNode} from "react";

type FanEventType =
  | "contextual_cta_click"
  | "latest_intel_view"
  | "latest_intel_click"
  | "vault_item_view"
  | "vault_preview_click"
  | "vault_checkout_click";

type FanAnalyticsPage = "home" | "public" | "release" | "vault";

function eventId(type: FanEventType, id: string) {
  return `${type}:${id}:${crypto.randomUUID()}`;
}

function send(type: FanEventType, page: FanAnalyticsPage, id: string, options?: {releaseId?: string; targetUrl?: string; label?: string; contentType?: string; contentId?: string; interactionSource?: string; eventId?: string}) {
  const payload = JSON.stringify({eventType: type, page, eventId: options?.eventId || eventId(type, id), path: window.location.pathname, releaseId: options?.releaseId || null, targetUrl: options?.targetUrl || "", linkLabel: options?.label || "", linkType: id, contentType: options?.contentType || "", contentId: options?.contentId || "", interactionSource: options?.interactionSource || ""});
  if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics/track", new Blob([payload], {type: "application/json"}));
  else void fetch("/api/analytics/track", {method: "POST", headers: {"content-type": "application/json"}, body: payload, keepalive: true});
}

export function trackLatestIntelView(intelId: string, pageVisitId: string) {
  send("latest_intel_view", "public", intelId, {
    contentType: "latest_intel",
    contentId: intelId,
    interactionSource: `page_visit:${pageVisitId}`,
    eventId: `latest_intel_view:${pageVisitId}:${intelId}`
  });
}

export function trackLatestIntelClick(input: {intelId: string; pageVisitId: string; targetUrl: string; label: string}) {
  send("latest_intel_click", "public", input.intelId, {
    targetUrl: input.targetUrl,
    label: input.label,
    contentType: "latest_intel",
    contentId: input.intelId,
    interactionSource: `page_visit:${input.pageVisitId}`,
    eventId: `latest_intel_click:${input.pageVisitId}:${input.intelId}:${crypto.randomUUID()}`
  });
}

export function VaultItemImpressions({ids}: {ids: string[]}) {
  useEffect(() => { ids.forEach((id) => send("vault_item_view", "vault", id)); }, [ids]);
  return null;
}

export function FanTrackedLink({children, eventType, eventKey, page, releaseId, ...props}: ComponentProps<typeof Link> & {children: ReactNode; eventType: Exclude<FanEventType, "latest_intel_view" | "vault_item_view">; eventKey: string; page: FanAnalyticsPage; releaseId?: string}) {
  return <Link {...props} onClick={() => send(eventType, page, eventKey, {releaseId, targetUrl: String(props.href), label: typeof children === "string" ? children : eventKey})}>{children}</Link>;
}
