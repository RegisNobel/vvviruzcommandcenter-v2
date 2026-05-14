"use client";

import { useMemo } from "react";
import { 
  ReleaseAdMetricsOverview, 
  AdCampaignLearningRecord,
  ReleasePromoVerdict 
} from "@/lib/types";

// Helper functions (copied from release-detail-editor.tsx)
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatHookType(value: "HOOK_STORY" | "HOOK_DIRECT" | "HOOK_QUESTION" | "HOOK_VISUAL") {
  const labels = {
    HOOK_STORY: "Story/POV",
    HOOK_DIRECT: "Direct",
    HOOK_QUESTION: "Question",
    HOOK_VISUAL: "Visual/Loop"
  };
  return labels[value] || value;
}

function getVerdictStyle(verdict: ReleasePromoVerdict) {
  switch (verdict) {
    case "Winner":
      return { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400", dot: "bg-emerald-500" };
    case "Promising":
      return { border: "border-sky-500/30", bg: "bg-sky-500/5", text: "text-sky-400", dot: "bg-sky-500" };
    case "Testing":
      return { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-400", dot: "bg-amber-500" };
    case "Needs New Creative":
      return { border: "border-orange-500/30", bg: "bg-orange-500/5", text: "text-orange-400", dot: "bg-orange-500" };
    case "Paused":
      return { border: "border-[#424852]", bg: "bg-[#1a1d23]", text: "text-[#aeb3bb]", dot: "bg-[#6b7280]" };
    case "Retired":
      return { border: "border-red-500/30", bg: "bg-red-500/5", text: "text-red-400", dot: "bg-red-500" };
    case "Untested":
    default:
      return { border: "border-[#31353b]", bg: "bg-[#14171b]", text: "text-[#7f858d]", dot: "bg-[#424852]" };
  }
}

function getReleasePromoVerdict(
  adMetrics: ReleaseAdMetricsOverview,
  latestLearning: AdCampaignLearningRecord | null
): ReleasePromoVerdict {
  if (!adMetrics.has_data || adMetrics.total_spend < 5) {
    return "Untested";
  }

  const decision = latestLearning?.decision;
  if (decision === "retire") return "Retired";
  if (decision === "pause") return "Paused";

  const hasWinnerAd = adMetrics.best_ad?.signals.some(s => s.includes("Winner")) ?? false;
  const isScaleReady = decision === "scale" || (hasWinnerAd && (adMetrics.cpr || 99) < 0.50);

  if (isScaleReady) return "Winner";
  if (hasWinnerAd || (adMetrics.total_results > 20 && (adMetrics.cpr || 99) < 0.85)) return "Promising";

  if (adMetrics.total_spend > 30 && adMetrics.total_results < 5) return "Needs New Creative";

  return "Testing";
}

function getReleaseNextMove(
  verdict: ReleasePromoVerdict,
  adMetrics: ReleaseAdMetricsOverview,
  latestLearning: AdCampaignLearningRecord | null
): string {
  const bestHookLabel = adMetrics.best_hook?.label ?? null;
  const nextTest = latestLearning?.next_test?.trim();

  if (nextTest) return nextTest;

  switch (verdict) {
    case "Winner":
      return "Scale budget and test lookalike audiences based on current winners.";
    case "Promising":
      return `Promising signal — run one more tight batch to confirm before adding budget.`;
    case "Needs New Creative":
      return "Current hooks aren't hitting. Test 3 radically different visual concepts.";
    case "Testing":
      return bestHookLabel
        ? `Keep testing. ${bestHookLabel.replace(/_/g, " ")} is showing the strongest signal.`
        : "Keep running. Not enough data to determine a winning angle yet.";
    case "Paused":
      return "Release is on hold. Review metrics before resuming.";
    case "Retired":
      return "Promotion concluded. Archive and apply lessons to next release.";
    case "Untested":
    default:
      return "Import Meta campaign data to generate a promo verdict.";
  }
}

export default function ReleaseIntelligencePanel({
  adMetrics,
  latestAdLearning,
  releaseTitle
}: {
  adMetrics: ReleaseAdMetricsOverview;
  latestAdLearning: AdCampaignLearningRecord | null;
  releaseTitle: string;
}) {
  const promoVerdict = useMemo(() => getReleasePromoVerdict(adMetrics, latestAdLearning), [adMetrics, latestAdLearning]);
  const promoNextMove = useMemo(() => getReleaseNextMove(promoVerdict, adMetrics, latestAdLearning), [promoVerdict, adMetrics, latestAdLearning]);
  const promoStyle = useMemo(() => getVerdictStyle(promoVerdict), [promoVerdict]);
  const promoContentTypeHint = useMemo(() => adMetrics.best_ad?.signals.find(s =>
    ["Scale Winner", "Efficiency Winner", "Attention Winner", "Click Winner"].includes(s)
  ) ?? null, [adMetrics.best_ad]);

  return (
    <div className="rounded-[22px] border border-[#31353b] bg-[#121418] p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7f858d]">
            Promo Intelligence
          </p>
          <p className="mt-1 text-sm font-semibold text-[#ede7dc]">{releaseTitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${promoStyle.border} ${promoStyle.bg} ${promoStyle.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${promoStyle.dot}`} />
          {promoVerdict}
        </span>
      </div>

      {adMetrics.has_data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Campaigns</p>
            <p className="mt-1 text-base font-semibold text-[#ede7dc]">{adMetrics.batch_count}</p>
          </div>
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Total Spend</p>
            <p className="mt-1 text-base font-semibold text-[#ede7dc]">{formatCurrency(adMetrics.total_spend)}</p>
          </div>
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Results</p>
            <p className="mt-1 text-base font-semibold text-[#ede7dc]">{formatNumber(adMetrics.total_results)}</p>
          </div>
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Latest Decision</p>
            <p className="mt-1 text-sm font-semibold capitalize text-[#ede7dc]">
              {latestAdLearning?.decision ? latestAdLearning.decision.replace(/-/g, " ") : "—"}
            </p>
          </div>
        </div>
      )}

      {adMetrics.has_data && (adMetrics.best_ad || adMetrics.best_hook) && (
        <div className="space-y-2">
          {adMetrics.best_ad && (
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#272b31] bg-[#14171b] px-3 py-2.5">
              <span className="text-xs text-[#7f858d]">Best Creative</span>
              <span className="text-right text-xs font-medium text-[#ede7dc]">
                {adMetrics.best_ad.ad_name}
                {adMetrics.best_ad.cpr !== null && (
                  <span className="ml-2 text-emerald-400">{formatCurrency(adMetrics.best_ad.cpr)} CPR</span>
                )}
              </span>
            </div>
          )}
          {adMetrics.best_hook && (
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#272b31] bg-[#14171b] px-3 py-2.5">
              <span className="text-xs text-[#7f858d]">Best Hook Type</span>
              <span className="text-right text-xs font-medium text-[#ede7dc]">
                {formatHookType(adMetrics.best_hook.label as any)}
                {adMetrics.best_hook.cpr !== null && (
                  <span className="ml-2 text-sky-400">{formatCurrency(adMetrics.best_hook.cpr)} CPR</span>
                )}
              </span>
            </div>
          )}
          {promoContentTypeHint && (
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#272b31] bg-[#14171b] px-3 py-2.5">
              <span className="text-xs text-[#7f858d]">Top Signal</span>
              <span className="text-right text-xs font-medium text-[#ede7dc]">{promoContentTypeHint}</span>
            </div>
          )}
        </div>
      )}

      <div className={`rounded-[16px] border px-4 py-3 text-sm leading-6 ${promoStyle.border} ${promoStyle.bg} ${promoStyle.text}`}>
        <span className="font-semibold">Next Move: </span>
        {promoNextMove}
      </div>

      {!adMetrics.has_data && (
        <p className="text-sm text-[#6b7280]">
          No campaign data imported for this release yet. Import a Meta CSV batch from Ad Lab to generate a promo verdict.
        </p>
      )}
    </div>
  );
}
