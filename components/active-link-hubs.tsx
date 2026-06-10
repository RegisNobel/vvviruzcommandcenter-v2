"use client";

import {Check, Copy, ExternalLink, Link2} from "lucide-react";
import {useState, useEffect} from "react";

import type {LinkHubRecord} from "@/lib/types";

type ActiveLinkHubsProps = {
  hubs: LinkHubRecord[];
};

export function ActiveLinkHubs({hubs}: ActiveLinkHubsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteUrl(window.location.origin);
    }
  }, []);

  const activeHubs = hubs.filter((hub) => hub.isEnabled);

  function handleCopy(path: string, id: string) {
    const url = `${siteUrl}/${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <section className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-[#c9a347]" />
        <h3 className="text-lg font-semibold text-ink">Active Link Hubs</h3>
      </div>

      {activeHubs.length === 0 ? (
        <p className="text-sm text-muted">No active link hubs found.</p>
      ) : (
        <div className="space-y-2">
          {activeHubs.map((hub) => {
            const publicUrl = `${siteUrl}/${hub.path}`;
            const displayRelease = hub.path === "links" && !hub.releaseId
              ? "Latest Release (Fallback)"
              : hub.release_title || "Assigned Release";

            return (
              <div
                className="flex items-center justify-between gap-4 rounded-xl border border-[#272b31] bg-[#121418] px-3.5 py-2.5 transition hover:border-[#3a3f47]"
                key={hub.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm">/{hub.path}</span>
                    {hub.label && (
                      <span className="text-xs text-muted">({hub.label})</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 truncate">
                    {displayRelease}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#ece6da] hover:bg-white/10 hover:text-white transition"
                    onClick={() => handleCopy(hub.path, hub.id)}
                    title="Copy URL"
                    type="button"
                  >
                    {copiedId === hub.id ? (
                      <Check className="text-emerald-400" size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <a
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#ece6da] hover:bg-white/10 hover:text-white transition"
                    href={publicUrl}
                    rel="noreferrer"
                    target="_blank"
                    title="Open URL"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
