"use client";

import React from "react";

type TrackedExternalLinkProps = {
  href: string;
  eventType: string;
  className?: string;
  children: React.ReactNode;
};

export function TrackedExternalLink({
  href,
  eventType,
  className,
  children
}: TrackedExternalLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Fire-and-forget analytics call
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          page: "preview"
        })
      });
    } catch (err) {
      console.error("Failed to log client analytic event:", err);
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
