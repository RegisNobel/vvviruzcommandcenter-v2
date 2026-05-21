import React from "react";
import type { CreativePerformanceMemory, ComponentPerformanceRow } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, Sparkles, Award, Star } from "lucide-react";

// Formatting helpers
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNullableCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return formatCurrency(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

interface CreativePerformanceMemorySectionProps {
  memory: CreativePerformanceMemory;
}

export function CreativePerformanceMemorySection({ memory }: CreativePerformanceMemorySectionProps) {
  const {
    visuals,
    songSections,
    revisions,
    bestVisual,
    bestSongSection,
    volumeWinner,
    efficiencyWinner,
    strongestConfidenceSignal,
    hasOverlappingSnapshots
  } = memory;

  const pageLabelClass = "text-xs font-semibold uppercase tracking-wider text-[#7f858d]";

  const renderTrendPill = (trend: ComponentPerformanceRow["trendLabel"]) => {
    switch (trend) {
      case "Improving":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            <TrendingUp size={12} />
            Improving
          </span>
        );
      case "Fading":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-300">
            <TrendingDown size={12} />
            Fading
          </span>
        );
      case "Stable":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-300">
            <Minus size={12} />
            Stable
          </span>
        );
      case "Needs More Data":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
            <Info size={12} />
            Low Data
          </span>
        );
    }
  };

  const renderSummaryCard = (
    title: string,
    value: string | null | undefined,
    icon: React.ReactNode,
    extra?: React.ReactNode,
    warning?: string
  ) => {
    return (
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0f1216] p-4 flex flex-col justify-between min-h-[110px]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7f858d]">
            {icon}
            {title}
          </div>
          <p className="mt-2 text-base font-semibold text-[#efe7db] truncate">
            {value || "None Isolated"}
          </p>
        </div>
        <div>
          {extra && <div className="mt-1">{extra}</div>}
          {warning && (
            <p className="mt-1 text-xs text-amber-400 flex items-center gap-1 font-medium">
              <AlertTriangle size={12} />
              {warning}
            </p>
          )}
        </div>
      </div>
    );
  };

  const hasAnyData =
    visuals.length > 0 || songSections.length > 0 || revisions.length > 0;

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-5 sm:px-5 space-y-6">
      <div>
        <p className={pageLabelClass}>Creative Performance Memory</p>
        <h3 className="mt-2 text-xl font-semibold text-[#efe7db]">
          Historical component breakdown
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
          Aggregated performance history of creative components extracted from ad naming conventions across all test cycles.
        </p>
      </div>

      {hasOverlappingSnapshots && (
        <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Overlapping Snapshot Warnings Active:</span> Due to overlapping batch date ranges, the summed metrics are marked as snapshot totals instead of absolute lifetime totals.
          </div>
        </div>
      )}

      {/* Top Level Interpretation Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {renderSummaryCard(
          "Best Reusable Visual",
          bestVisual?.value,
          <Star size={12} className="text-amber-400" />,
          bestVisual ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(bestVisual.cpr)} CPR &middot; {bestVisual.results} results
            </p>
          ) : null,
          bestVisual?.warning
        )}

        {renderSummaryCard(
          "Best Reusable Song Section",
          bestSongSection?.value,
          <Award size={12} className="text-purple-400" />,
          bestSongSection ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(bestSongSection.cpr)} CPR &middot; {bestSongSection.results} results
            </p>
          ) : null,
          bestSongSection?.warning
        )}

        {renderSummaryCard(
          "Volume Winner",
          volumeWinner?.value,
          <Sparkles size={12} className="text-sky-400" />,
          volumeWinner ? (
            <p className="text-xs text-[#8a9098]">
              {volumeWinner.results} results &middot; {formatNullableCurrency(volumeWinner.cpr)} CPR
            </p>
          ) : null
        )}

        {renderSummaryCard(
          "Efficiency Winner",
          efficiencyWinner?.value,
          <Star size={12} className="text-emerald-400" />,
          efficiencyWinner ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(efficiencyWinner.cpr)} CPR &middot; {efficiencyWinner.results} results
            </p>
          ) : null
        )}

        {renderSummaryCard(
          "Strongest Confidence Signal",
          strongestConfidenceSignal?.value,
          <Award size={12} className="text-amber-400" />,
          strongestConfidenceSignal ? (
            <div className="text-xs text-[#8a9098]">
              <p>{strongestConfidenceSignal.score}</p>
              <p className="text-[10px] mt-0.5">{strongestConfidenceSignal.results} results &middot; {formatNullableCurrency(strongestConfidenceSignal.cpr)} CPR</p>
            </div>
          ) : null
        )}
      </div>

      {/* Component tables */}
      <div className="space-y-6">
        {/* Helper to render group table */}
        {renderGroupTable("Visual Performance", visuals)}
        {renderGroupTable("Song Section Performance", songSections)}
        {renderGroupTable("Revision Performance", revisions)}
      </div>
    </div>
  );

  function renderGroupTable(title: string, rows: ComponentPerformanceRow[]) {
    if (rows.length === 0) return null;

    return (
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0c0f13] overflow-hidden">
        <div className="border-b border-[#2d3138] px-4 py-3 bg-[#0f1216]">
          <h4 className="text-sm font-semibold text-[#efe7db]">{title}</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#aeb3bb]">
            <thead>
              <tr className="border-b border-[#20242b] text-[10px] uppercase tracking-wider text-[#7f858d] bg-[#0f1216]/50">
                <th className="py-2.5 px-4 font-semibold">Component</th>
                <th className="py-2.5 px-4 font-semibold text-center">Batches</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Spend</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Results</th>
                <th className="py-2.5 px-4 font-semibold text-right">Avg CPR</th>
                <th className="py-2.5 px-4 font-semibold text-right">Best Batch CPR</th>
                <th className="py-2.5 px-4 font-semibold text-right">Latest Batch CPR</th>
                <th className="py-2.5 px-4 font-semibold">Confidence Signal</th>
                <th className="py-2.5 px-4 font-semibold text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20242b]">
              {rows.map((row) => (
                <tr key={row.value} className="hover:bg-[#141820]/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-[#efe7db]">{row.value}</td>
                  <td className="py-3 px-4 text-center">{row.batchCount}</td>
                  <td className="py-3 px-4 text-right">
                    <span>{formatCurrency(row.totalSpend)}</span>
                    {row.isSpendOverlapping && (
                      <span className="block text-[10px] text-amber-400 font-medium mt-0.5">
                        overlapping snapshot total
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span>{formatNumber(row.totalResults)}</span>
                    {row.isSpendOverlapping && (
                      <span className="block text-[10px] text-amber-400 font-medium mt-0.5">
                        snapshot-based
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#efe7db]">
                    {formatNullableCurrency(row.averageCpr)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNullableCurrency(row.bestBatchCpr)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNullableCurrency(row.latestBatchCpr)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-[#efe7db]">{row.confidenceScore}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {renderTrendPill(row.trendLabel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
