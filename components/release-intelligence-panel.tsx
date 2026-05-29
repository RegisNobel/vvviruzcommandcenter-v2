"use client";

import { useMemo } from "react";
import Link from "next/link";
import { 
  ReleaseAdMetricsOverview, 
  AdCampaignLearningRecord,
  ReleasePromoVerdict 
} from "@/lib/types";
import { getUnifiedCampaignRecommendation } from "@/lib/ads/recommendations";

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

export default function ReleaseIntelligencePanel({
  adMetrics,
  latestAdLearning,
  releaseTitle,
  streamingClicksCount = 0,
  utmCoverageRate = 0,
  releaseId
}: {
  adMetrics: ReleaseAdMetricsOverview;
  latestAdLearning: AdCampaignLearningRecord | null;
  releaseTitle: string;
  streamingClicksCount?: number;
  utmCoverageRate?: number;
  releaseId: string;
}) {
  const promoVerdict = useMemo(() => getReleasePromoVerdict(adMetrics, latestAdLearning), [adMetrics, latestAdLearning]);
  const promoStyle = useMemo(() => getVerdictStyle(promoVerdict), [promoVerdict]);
  const promoContentTypeHint = useMemo(() => adMetrics.best_ad?.signals.find(s =>
    ["Scale Winner", "Efficiency Winner", "Attention Winner", "Click Winner"].includes(s)
  ) ?? null, [adMetrics.best_ad]);

  const recommendation = useMemo(() => {
    return getUnifiedCampaignRecommendation({
      adMetrics: {
        totalSpend: adMetrics.total_spend,
        totalResults: adMetrics.total_results,
        totalImpressions: adMetrics.total_impressions,
        totalLinkClicks: adMetrics.total_link_clicks,
        totalLandingPageViews: adMetrics.total_landing_page_views,
        clickToLandingRate: adMetrics.click_to_landing_rate,
        cpr: adMetrics.cpr,
        bestAd: adMetrics.best_ad ? {
          ad_name: adMetrics.best_ad.ad_name,
          spend: adMetrics.best_ad.spend,
          results: adMetrics.best_ad.results,
          cpr: adMetrics.best_ad.cpr,
          ctr: adMetrics.best_ad.ctr,
          signals: adMetrics.best_ad.signals
        } : null,
        bestHook: adMetrics.best_hook ? {
          label: adMetrics.best_hook.label,
          spend: adMetrics.best_hook.spend,
          results: adMetrics.best_hook.results,
          cpr: adMetrics.best_hook.cpr,
          ctr: adMetrics.best_hook.ctr
        } : null,
        worstAd: adMetrics.worst_ad ? {
          ad_name: adMetrics.worst_ad.ad_name,
          spend: adMetrics.worst_ad.spend,
          results: adMetrics.worst_ad.results,
          cpr: adMetrics.worst_ad.cpr
        } : null,
        worstHook: adMetrics.worst_hook ? {
          label: adMetrics.worst_hook.label,
          spend: adMetrics.worst_hook.spend,
          results: adMetrics.worst_hook.results,
          cpr: adMetrics.worst_hook.cpr
        } : null,
        batchCount: adMetrics.batch_count
      },
      funnel: null,
      latestLearning: latestAdLearning ? {
        decision: latestAdLearning.decision,
        next_test: latestAdLearning.next_test,
        updated_at: latestAdLearning.updated_at
      } : null
    });
  }, [adMetrics, latestAdLearning]);

  return (
    <div className="rounded-[22px] border border-[#31353b] bg-[#121418] p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7f858d]">
            Strategic Campaign Intelligence
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Streaming Clicks</p>
            <p className="mt-1 text-base font-semibold text-[#ede7dc]">{formatNumber(streamingClicksCount)}</p>
          </div>
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">UTM Coverage</p>
            <p className="mt-1 text-base font-semibold text-[#ede7dc]">
              {utmCoverageRate > 0 ? `${utmCoverageRate.toFixed(1)}%` : "0%"}
            </p>
          </div>
          <div className="rounded-[18px] border border-[#272b31] bg-[#14171b] px-3 py-3 flex flex-col justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">Attribution</p>
            <Link
              href={`/admin/attribution?releaseId=${releaseId}`}
              className="mt-1 text-xs font-semibold text-[#c9a347] hover:text-[#d5b15b] transition inline-flex items-center gap-1"
            >
              Open Auditor
              <span className="text-[10px]">→</span>
            </Link>
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
              <span className="text-xs text-[#7f858d]">Best Copy Angle</span>
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

      {adMetrics.has_data && (
        <div className="space-y-4">
          <div className="rounded-[16px] border border-[#5b4920]/40 bg-[#1a1710] px-4 py-3.5 text-sm leading-6 text-[#d7b45e]">
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-90 text-[#aeb3bb] mb-1">Campaign Decision</p>
            <p className="font-semibold text-sm text-[#efe7dc]">{recommendation.campaignDecision}</p>
          </div>

          <div className={`rounded-[16px] border px-4 py-3.5 text-sm leading-6 ${promoStyle.border} ${promoStyle.bg} ${promoStyle.text}`}>
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-90 mb-1">Next Test Direction</p>
            <p className="font-semibold text-sm">{recommendation.nextTestDirection}</p>
          </div>
        </div>
      )}

      {adMetrics.has_data && recommendation.dataWarnings.length > 0 && (
        <div className="space-y-2">
          {recommendation.dataWarnings.map((warning, idx) => (
            <div key={idx} className="rounded-[14px] border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {!adMetrics.has_data && (
        <p className="text-sm text-[#6b7280]">
          No campaign data imported for this release yet. Import a Meta CSV batch from Ad Lab to generate a promo verdict.
        </p>
      )}
    </div>
  );
}
