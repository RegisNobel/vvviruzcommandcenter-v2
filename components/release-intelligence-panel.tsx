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
      return { badge: "status-badge-ready", panel: "state-panel-success", dot: "bg-[var(--status-success)]" };
    case "Promising":
      return { badge: "status-badge-info", panel: "state-panel-info", dot: "bg-[var(--status-info)]" };
    case "Testing":
      return { badge: "status-badge-warning", panel: "state-panel-warning", dot: "bg-[var(--status-warning)]" };
    case "Needs New Creative":
      return { badge: "status-badge-warning", panel: "state-panel-warning", dot: "bg-[var(--status-warning)]" };
    case "Paused":
      return { badge: "status-badge-neutral", panel: "state-panel-neutral", dot: "bg-[var(--status-neutral)]" };
    case "Retired":
      return { badge: "status-badge-danger", panel: "state-panel-danger", dot: "bg-[var(--status-danger)]" };
    case "Untested":
    default:
      return { badge: "status-badge-neutral", panel: "state-panel-neutral", dot: "bg-[var(--status-neutral)]" };
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

function getStatusBadgeClass(status: "Strong" | "Weak" | "Neutral" | "Low Data" | "Untested" | "Below Average" | "Needs Challenger" | "Narrow Coverage") {
  switch (status) {
    case "Strong":
      return "status-badge-ready";
    case "Weak":
      return "status-badge-danger";
    case "Below Average":
      return "status-badge-warning";
    case "Needs Challenger":
      return "status-badge-warning";
    case "Narrow Coverage":
      return "status-badge-warning";
    case "Neutral":
      return "status-badge-neutral";
    case "Low Data":
      return "status-badge-warning";
    case "Untested":
    default:
      return "status-badge-neutral";
  }
}

export default function ReleaseIntelligencePanel({
  adMetrics,
  latestAdLearning,
  releaseTitle,
  streamingClicksCount = 0,
  utmCoverageRate = 0,
  releaseId,
  reports = []
}: {
  adMetrics: ReleaseAdMetricsOverview;
  latestAdLearning: AdCampaignLearningRecord | null;
  releaseTitle: string;
  streamingClicksCount?: number;
  utmCoverageRate?: number;
  releaseId: string;
  reports?: any[];
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
      } : null,
      reports
    });
  }, [adMetrics, latestAdLearning, reports]);

  return (
    <div className="command-surface space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="table-label">
            Strategic Campaign Intelligence
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{releaseTitle}</p>
        </div>
        <span
          className={`${promoStyle.badge} px-3.5 py-1.5 uppercase tracking-[0.12em]`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${promoStyle.dot}`} />
          {promoVerdict}
        </span>
      </div>

      {adMetrics.has_data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <div className="inset-surface px-3 py-3">
            <p className="table-label">Campaigns</p>
            <p className="mt-1 text-base font-semibold text-ink">{adMetrics.batch_count}</p>
          </div>
          <div className="inset-surface px-3 py-3">
            <p className="table-label">Total Spend</p>
            <p className="mt-1 text-base font-semibold text-ink">{formatCurrency(adMetrics.total_spend)}</p>
          </div>
          <div className="inset-surface px-3 py-3">
            <p className="table-label">Results</p>
            <p className="mt-1 text-base font-semibold text-ink">{formatNumber(adMetrics.total_results)}</p>
          </div>
          <div className="inset-surface px-3 py-3">
            <p className="table-label">Streaming Clicks</p>
            <p className="mt-1 text-base font-semibold text-ink">{formatNumber(streamingClicksCount)}</p>
          </div>
          <div className="inset-surface px-3 py-3">
            <p className="table-label">UTM Coverage</p>
            <p className="mt-1 text-base font-semibold text-ink">
              {utmCoverageRate > 0 ? `${utmCoverageRate.toFixed(1)}%` : "0%"}
            </p>
          </div>
          <div className="inset-surface flex flex-col justify-between px-3 py-3">
            <p className="table-label">Attribution</p>
            <Link
              href={`/admin/attribution?releaseId=${releaseId}`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary transition hover:text-brand-primary-hover"
            >
              Open Auditor
              <span className="text-[10px]">→</span>
            </Link>
          </div>
        </div>
      )}

      {adMetrics.has_data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(246,201,69,0.3)] bg-[var(--brand-primary-soft)] px-4 py-3.5 text-sm leading-6 text-brand-primary">
            <p className="table-label mb-1 text-secondary">Campaign Decision</p>
            <p className="text-sm font-semibold text-ink">{recommendation.campaignDecision}</p>
          </div>

          <div className={`${promoStyle.panel} px-4 py-3.5`}>
            <p className="table-label mb-1 opacity-90">Next Test Direction</p>
            <p className="font-semibold text-sm">{recommendation.nextTestDirection}</p>
            {recommendation.controlAd ? (
              <p className="mt-1 text-[10px] font-mono opacity-80">
                Reference Creative: {recommendation.controlAd}
              </p>
            ) : null}
          </div>

          {recommendation.componentDiagnosis && (
            <div className="inset-surface space-y-4 p-4">
              <div>
                <p className="table-label mb-2">Component Diagnosis</p>
                {recommendation.componentDiagnosis.controlAd ? (
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-elevated px-2.5 py-1 text-xs text-ink">
                    <span className="font-bold text-brand-primary">Control Ad:</span>
                    <span className="font-mono">{recommendation.componentDiagnosis.controlAd}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted">No Control Ad identified yet.</span>
                )}
              </div>

              {recommendation.componentDiagnosis.diagnosisComment && (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  💡 {recommendation.componentDiagnosis.diagnosisComment}
                </div>
              )}

              {recommendation.componentDiagnosis.controlAd && (
                <div className="grid grid-cols-2 gap-4 border-t border-edge pt-2 sm:grid-cols-4">
                  <div>
                    <p className="table-label">Visual Format</p>
                    <p className="mt-0.5 text-xs font-semibold text-ink">{recommendation.componentDiagnosis.controlVisual || "N/A"}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${getStatusBadgeClass(recommendation.componentDiagnosis.visualStatus)}`}>
                      {recommendation.componentDiagnosis.visualStatus}
                    </span>
                    <p className="mt-1.5 text-[10px] leading-normal text-muted">{recommendation.componentDiagnosis.visualReason}</p>
                  </div>
                  <div>
                    <p className="table-label">Song Section</p>
                    <p className="mt-0.5 text-xs font-semibold text-ink">{recommendation.componentDiagnosis.controlSongSection || "N/A"}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${getStatusBadgeClass(recommendation.componentDiagnosis.songSectionStatus)}`}>
                      {recommendation.componentDiagnosis.songSectionStatus}
                    </span>
                    <p className="mt-1.5 text-[10px] leading-normal text-muted">{recommendation.componentDiagnosis.songSectionReason}</p>
                  </div>
                  <div>
                    <p className="table-label">Copy Angle</p>
                    <p className="mt-0.5 text-xs font-semibold text-ink">{recommendation.componentDiagnosis.controlCopyAngle || "N/A"}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${getStatusBadgeClass(recommendation.componentDiagnosis.copyAngleStatus)}`}>
                      {recommendation.componentDiagnosis.copyAngleStatus}
                    </span>
                    <p className="mt-1.5 text-[10px] leading-normal text-muted">{recommendation.componentDiagnosis.copyAngleReason}</p>
                  </div>
                  <div>
                    <p className="table-label">Copy Pair</p>
                    <p className="mt-0.5 max-w-full truncate text-xs font-semibold text-ink" title={recommendation.componentDiagnosis.controlCopyPair || ""}>{recommendation.componentDiagnosis.controlCopyPair || "N/A"}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${getStatusBadgeClass(recommendation.componentDiagnosis.copyPairStatus)}`}>
                      {recommendation.componentDiagnosis.copyPairStatus}
                    </span>
                    <p className="mt-1.5 text-[10px] leading-normal text-muted">{recommendation.componentDiagnosis.copyPairReason}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-edge pt-2 text-xs">
                {recommendation.componentDiagnosis.preserveComponents && recommendation.componentDiagnosis.preserveComponents.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-400">Preserve:</span>
                    <span className="text-secondary">{recommendation.componentDiagnosis.preserveComponents.join(", ")}</span>
                  </div>
                )}
                {recommendation.componentDiagnosis.testComponent && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">Test Next:</span>
                    <span className="text-secondary">{recommendation.componentDiagnosis.testComponent}</span>
                  </div>
                )}
                {recommendation.componentDiagnosis.coverageWarnings && recommendation.componentDiagnosis.coverageWarnings.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="table-label text-brand-primary">Coverage Gaps:</span>
                    {recommendation.componentDiagnosis.coverageWarnings.map((warning, idx) => (
                      <div key={idx} className="text-amber-300 flex items-center gap-1 text-[11px]">
                        <span>⚠️ {warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2 border-t border-edge pt-2 text-xs italic text-muted">
                <span className="font-bold text-ink">Why this diagnosis?</span> {recommendation.componentDiagnosis.diagnosisRead}
              </div>
            </div>
          )}

          {recommendation.componentDiagnosis && recommendation.componentDiagnosis.iterationCandidates && recommendation.componentDiagnosis.iterationCandidates.length > 0 && (
            <div className="space-y-3 border-t border-edge pt-3">
              <p className="table-label">Iteration Candidates</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {recommendation.componentDiagnosis.iterationCandidates.map((cand, idx) => (
                  <div key={idx} className="inset-surface flex flex-col justify-between space-y-3 p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="max-w-[80%] truncate font-mono text-xs font-semibold text-brand-primary" title={cand.suggestedPattern}>
                          {cand.suggestedPattern}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          cand.confidence === "High"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : cand.confidence === "Moderate"
                            ? "bg-sky-500/10 text-sky-400"
                            : "bg-surface-elevated text-ink"
                        }`}>
                          {cand.confidence}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-secondary">
                        <p>
                          <strong className="text-ink">What changes:</strong> {cand.whatChanges}
                        </p>
                        <p>
                          <strong className="text-ink">What stays same:</strong> {cand.whatStaysSame}
                        </p>
                      </div>
                    </div>
                    <p className="border-t border-edge pt-2 text-xs leading-5 text-muted">
                      {cand.whyMatters}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {adMetrics.has_data && recommendation.dataWarnings.length > 0 && (
        <div className="space-y-2">
          {recommendation.dataWarnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {!adMetrics.has_data && (
        <p className="text-sm text-muted">
          No campaign data imported for this release yet. Import a Meta CSV batch from Ad Lab to generate a promo verdict.
        </p>
      )}
    </div>
  );
}
