"use client";

import {useEffect, useRef} from "react";

type ArtistEventType =
  | "artist_profile_view"
  | "artist_release_view"
  | "artist_feature_open"
  | "artist_streaming_click"
  | "artist_platform_click";

function createEventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sendArtistEvent(input: {
  artistProfileId: string;
  eventType: ArtistEventType;
  releaseId?: string;
  linkLabel?: string;
  targetUrl?: string;
  eventId?: string;
}) {
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: {"content-type": "application/json"},
    keepalive: true,
    body: JSON.stringify({
      page: "artist",
      path: window.location.pathname,
      eventId: input.eventId || createEventId(),
      artistProfileId: input.artistProfileId,
      eventType: input.eventType,
      releaseId: input.releaseId || null,
      linkLabel: input.linkLabel || "",
      targetUrl: input.targetUrl || ""
    })
  });
}

export function ArtistAnalytics({
  artistProfileId,
  releaseId,
  viewEventType
}: {
  artistProfileId: string;
  releaseId?: string;
  viewEventType: "artist_profile_view" | "artist_release_view";
}) {
  const viewEventId = useRef(createEventId());

  useEffect(() => {
    sendArtistEvent({
      artistProfileId,
      eventType: viewEventType,
      releaseId,
      eventId: viewEventId.current
    });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLElement>("[data-artist-event]");
      if (!link) return;
      const eventType = link.dataset.artistEvent as ArtistEventType | undefined;
      if (!eventType) return;
      sendArtistEvent({
        artistProfileId,
        eventType,
        releaseId: link.dataset.releaseId || releaseId,
        linkLabel: link.dataset.artistLabel || link.textContent?.trim() || "",
        targetUrl:
          link instanceof HTMLAnchorElement
            ? link.href
            : link.dataset.targetUrl || ""
      });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [artistProfileId, releaseId, viewEventType]);

  return null;
}
