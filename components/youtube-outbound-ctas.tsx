"use client";

type YouTubeOutboundCTAsProps = {
  publicUrl: string;
  subscribeUrl: string;
};

export function YouTubeOutboundCTAs({ publicUrl, subscribeUrl }: YouTubeOutboundCTAsProps) {
  const trackClick = (eventType: string) => {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        page: "preview"
      })
    }).catch(err => console.error("Outbound track error:", err));
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
      <a
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#c9a347] to-[#e6c167] px-6 py-3.5 text-sm font-bold text-[#13161a] transition hover:scale-[1.02] active:scale-[0.98]"
        href={publicUrl}
        onClick={() => trackClick("exclusive_open_in_youtube")}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open in YouTube
      </a>
      <a
        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-[#f4eedf] transition hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10"
        href={subscribeUrl}
        onClick={() => trackClick("exclusive_subscribe_youtube_click")}
        rel="noopener noreferrer"
        target="_blank"
      >
        Subscribe on YouTube
      </a>
    </div>
  );
}
