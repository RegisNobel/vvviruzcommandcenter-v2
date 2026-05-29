import React, { useState } from "react";
import type { CopyPerformanceMemory, CopyPerformanceRow, UnlinkedAdSummaryRow } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, Sparkles, Award, Star, ChevronDown, ChevronUp } from "lucide-react";

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

interface CopyPerformanceMemorySectionProps {
  memory: CopyPerformanceMemory;
  hideSummaryCards?: boolean;
}

export function CopyPerformanceMemorySection({
  memory,
  hideSummaryCards = false
}: CopyPerformanceMemorySectionProps) {
  const {
    coverage,
    copyPairs,
    copyAngles,
    songSections,
    combos,
    unlinkedAds,
    hasOverlappingSnapshots,
    winners
  } = memory;

  const [openSections, setOpenSections] = useState({
    pairs: true,
    angles: false,
    sections: false,
    combos: false,
    unlinked: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const pageLabelClass = "text-xs font-semibold uppercase tracking-wider text-[#7f858d]";

  const hasAnyData =
    copyPairs.length > 0 ||
    copyAngles.length > 0 ||
    songSections.length > 0 ||
    combos.length > 0 ||
    unlinkedAds.length > 0;

  if (!hasAnyData) {
    return null;
  }

  const renderSummaryCard = (
    title: string,
    winner: { label: string; cpr: number | null; results: number; warning?: string } | null,
    icon: React.ReactNode
  ) => {
    const isNeedsData = !winner;
    return (
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0f1216] p-4 flex flex-col justify-between min-h-[110px]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7f858d]">
            {icon}
            {title}
          </div>
          <p className="mt-2 text-sm sm:text-base font-semibold text-[#efe7db] line-clamp-2" title={winner?.label || "Needs More Data"}>
            {winner ? winner.label : "Needs More Data"}
          </p>
        </div>
        <div className="mt-2">
          {winner ? (
            <>
              <p className="text-xs text-[#8a9098]">
                {formatNullableCurrency(winner.cpr)} CPR &middot; {winner.results} results
              </p>
              {winner.warning && (
                <p className="mt-1 text-xs text-amber-400 flex items-center gap-1 font-medium">
                  <AlertTriangle size={12} />
                  {winner.warning}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-amber-400 flex items-center gap-1 font-medium">
              <Info size={12} />
              Needs More Data
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSnapshotLabel = (
    metricBasis?: "combined_total" | "latest_snapshot"
  ) => metricBasis === "latest_snapshot" ? (
    <span className="block text-[10px] text-amber-400 font-medium mt-0.5">
      latest snapshot
    </span>
  ) : null;

  const renderSpendCell = (row: { metricBasis?: "combined_total" | "latest_snapshot"; spend: number }) => (
    <td className="py-3 px-4 text-right">
      {formatCurrency(row.spend)}
      {renderSnapshotLabel(row.metricBasis)}
    </td>
  );

  const renderResultsCell = (row: { metricBasis?: "combined_total" | "latest_snapshot"; results: number }) => (
    <td className="py-3 px-4 text-right">
      {formatNumber(row.results)}
      {renderSnapshotLabel(row.metricBasis)}
    </td>
  );

  const renderSnapshotNotice = () => hasOverlappingSnapshots ? (
    <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200 flex items-start gap-2">
      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-amber-300">Rolling Snapshot Mode:</span> Copy spend/results use the latest snapshot for each row instead of summing duplicated overlapping Meta exports.
      </div>
    </div>
  ) : null;

  if (hideSummaryCards) {
    return (
      <div className="space-y-6">
        {renderSnapshotNotice()}

        {/* Coverage Section */}
        <div className="rounded-[18px] border border-[#2d3138] bg-[#0c0f13] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-[#efe7db]">Copy Linking Coverage</h4>
              <p className="text-xs text-[#8a9098] mt-0.5">
                {coverage.metricBasis === "latest_snapshot"
                  ? "Percentage of latest snapshot spend and creative ads that have associated Copy Lab entries."
                  : "Percentage of total spend and creative ads that have associated Copy Lab entries."}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-[#efe7db]">Linked: {formatCurrency(coverage.linkedSpend)} ({coverage.linkedSpendPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-[#efe7db]">Unlinked: {formatCurrency(coverage.unlinkedSpend)} ({coverage.unlinkedSpendPercentage.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-[#1b1f24] rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${coverage.linkedSpendPercentage}%` }}></div>
            <div className="bg-amber-500 h-full" style={{ width: `${coverage.unlinkedSpendPercentage}%` }}></div>
          </div>

          {/* Coverage Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left pt-2">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Linked Ads</span>
              <span className="text-lg font-bold text-[#efe7db]">{coverage.linkedAdCount}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Unlinked Ads</span>
              <span className="text-lg font-bold text-[#efe7db]">{coverage.unlinkedAdCount}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Linked Spend</span>
              <span className="text-lg font-bold text-[#efe7db]">{formatCurrency(coverage.linkedSpend)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Unlinked Spend</span>
              <span className="text-lg font-bold text-[#efe7db]">{formatCurrency(coverage.unlinkedSpend)}</span>
            </div>
          </div>

          {/* Warning if unlinked spend > 10% */}
          {coverage.unlinkedSpendPercentage > 10 && (
            <div className="rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-200 flex items-start gap-2 mt-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">Copy Performance Incomplete:</span> Over 10% of promotional spend ({coverage.unlinkedSpendPercentage.toFixed(1)}%) is unlinked. Link these ads in Ad Lab to ensure analysis is complete and accurate.
              </div>
            </div>
          )}
        </div>

        {/* Stacked Collapsible Tables */}
        <div className="space-y-3">
          {/* Copy Pair Performance */}
          {renderCollapsibleTable(
            "pairs",
            "Copy Pair Performance",
            copyPairs,
            ["Copy Pair (Hook & Caption)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
            (row: CopyPerformanceRow) => (
              <tr key={row.copyEntryId || row.label} className="hover:bg-[#141820]/30 transition-colors">
                <td className="py-3 px-4 max-w-[300px]">
                  <div className="font-medium text-[#efe7db] truncate" title={row.hook}>{row.hook || row.label}</div>
                  {row.caption && <div className="text-[11px] text-[#7f858d] truncate mt-0.5" title={row.caption}>{row.caption}</div>}
                </td>
                {renderSpendCell(row)}
                {renderResultsCell(row)}
                <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
                <td className="py-3 px-4 text-center">{row.batchCount}</td>
                <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
              </tr>
            )
          )}

          {/* Copy Angle Performance */}
          {renderCollapsibleTable(
            "angles",
            "Copy Angle Performance",
            copyAngles,
            ["Copy Angle (Strategy Type)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
            (row: CopyPerformanceRow) => (
              <tr key={row.label} className={`hover:bg-[#141820]/30 transition-colors ${row.label === "Unlinked" ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
                <td className="py-3 px-4 font-semibold text-[#efe7db]">
                  {row.label}
                  {row.label === "Unlinked" && <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>}
                </td>
                {renderSpendCell(row)}
                {renderResultsCell(row)}
                <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
                <td className="py-3 px-4 text-center">{row.batchCount}</td>
                <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
              </tr>
            )
          )}

          {/* Copy Song Section Performance */}
          {renderCollapsibleTable(
            "sections",
            "Copy Song Section Performance",
            songSections,
            ["Song Section (Target Part)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
            (row: CopyPerformanceRow) => (
              <tr key={row.label} className={`hover:bg-[#141820]/30 transition-colors ${row.label === "Unlinked" ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
                <td className="py-3 px-4 font-semibold text-[#efe7db]">
                  {row.label}
                  {row.label === "Unlinked" && <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>}
                </td>
                {renderSpendCell(row)}
                {renderResultsCell(row)}
                <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
                <td className="py-3 px-4 text-center">{row.batchCount}</td>
                <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
              </tr>
            )
          )}

          {/* Copy + Song Section Combo Performance */}
          {renderCollapsibleTable(
            "combos",
            "Copy + Song Section Combo Performance",
            combos,
            ["Copy + Song Section Combo", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
            (row: CopyPerformanceRow) => {
              const isUnlinked = row.label === "Unlinked";
              const plusIndex = row.label.lastIndexOf(" + ");
              const hookText = plusIndex !== -1 ? row.label.slice(0, plusIndex) : row.label;
              const songSec = plusIndex !== -1 ? row.label.slice(plusIndex + 3) : "";

              return (
                <tr key={row.copyEntryId ? `${row.copyEntryId}-${row.label}` : row.label} className={`hover:bg-[#141820]/30 transition-colors ${isUnlinked ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
                  <td className="py-3 px-4 text-xs max-w-[320px]">
                    {isUnlinked ? (
                      <>
                        <span className="font-semibold text-[#efe7db]">Unlinked</span>
                        <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>
                      </>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[#efe7db] truncate block" title={hookText}>
                          {hookText || "Untitled Copy"}
                        </span>
                        {songSec && (
                          <span className="text-[10px] text-[#7f858d] uppercase tracking-wider block">
                            {songSec}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  {renderSpendCell(row)}
                  {renderResultsCell(row)}
                  <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                  <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
                  <td className="py-3 px-4 text-center">{row.batchCount}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
                </tr>
              );
            }
          )}

          {/* Unlinked Ads Summary */}
          {renderCollapsibleTable(
            "unlinked",
            `Unlinked Ads Summary (${unlinkedAds.length})`,
            unlinkedAds,
            ["Ad Name", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Batches"],
            (row: UnlinkedAdSummaryRow) => (
              <tr key={row.adName} className="hover:bg-[#141820]/30 transition-colors bg-[#18120c]/15">
                <td className="py-3 px-4 font-mono text-xs text-amber-200/90 truncate max-w-[280px]" title={row.adName}>{row.adName}</td>
                {renderSpendCell(row)}
                {renderResultsCell(row)}
                <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                <td className="py-3 px-4 text-center">{row.batchCount}</td>
              </tr>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-5 sm:px-5 space-y-6">
      <div>
        <p className={pageLabelClass}>Copy Performance Memory</p>
        <h3 className="mt-2 text-xl font-semibold text-[#efe7db]">
          Historical copy & strategy breakdown
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
          Aggregated performance history of Copy Lab hooks, angles, song sections, and visual combinations.
        </p>
      </div>

      {renderSnapshotNotice()}

      {/* Coverage Section */}
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0c0f13] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-[#efe7db]">Copy Linking Coverage</h4>
            <p className="text-xs text-[#8a9098] mt-0.5">
              {coverage.metricBasis === "latest_snapshot"
                ? "Percentage of latest snapshot spend and creative ads that have associated Copy Lab entries."
                : "Percentage of total spend and creative ads that have associated Copy Lab entries."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-[#efe7db]">Linked: {formatCurrency(coverage.linkedSpend)} ({coverage.linkedSpendPercentage.toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-[#efe7db]">Unlinked: {formatCurrency(coverage.unlinkedSpend)} ({coverage.unlinkedSpendPercentage.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-[#1b1f24] rounded-full h-2.5 overflow-hidden flex">
          <div className="bg-emerald-500 h-full" style={{ width: `${coverage.linkedSpendPercentage}%` }}></div>
          <div className="bg-amber-500 h-full" style={{ width: `${coverage.unlinkedSpendPercentage}%` }}></div>
        </div>

        {/* Coverage Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left pt-2">
          <div>
            <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Linked Ads</span>
            <span className="text-lg font-bold text-[#efe7db]">{coverage.linkedAdCount}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Unlinked Ads</span>
            <span className="text-lg font-bold text-[#efe7db]">{coverage.unlinkedAdCount}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Linked Spend</span>
            <span className="text-lg font-bold text-[#efe7db]">{formatCurrency(coverage.linkedSpend)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-[#7f858d]">Unlinked Spend</span>
            <span className="text-lg font-bold text-[#efe7db]">{formatCurrency(coverage.unlinkedSpend)}</span>
          </div>
        </div>

        {/* Warning if unlinked spend > 10% */}
        {coverage.unlinkedSpendPercentage > 10 && (
          <div className="rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-200 flex items-start gap-2 mt-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Copy Performance Incomplete:</span> Over 10% of promotional spend ({coverage.unlinkedSpendPercentage.toFixed(1)}%) is unlinked. Link these ads in Ad Lab to ensure analysis is complete and accurate.
            </div>
          </div>
        )}
      </div>

      {/* Winners Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {renderSummaryCard(
          "Best Copy Pair",
          winners.bestCopyPair,
          <Star size={12} className="text-emerald-400" />
        )}

        {renderSummaryCard(
          "Best Copy Angle",
          winners.bestAngle,
          <Award size={12} className="text-[#a78bfa]" />
        )}

        {renderSummaryCard(
          "Best Copy + Song Section Combo",
          winners.bestCombo,
          <Sparkles size={12} className="text-sky-400" />
        )}

        {renderSummaryCard(
          "Volume Winner",
          winners.volumeWinner,
          <Star size={12} className="text-amber-400" />
        )}
      </div>

      {/* Stacked Collapsible Tables */}
      <div className="space-y-3">
        {/* Copy Pair Performance */}
        {renderCollapsibleTable(
          "pairs",
          "Copy Pair Performance",
          copyPairs,
          ["Copy Pair (Hook & Caption)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
          (row: CopyPerformanceRow) => (
            <tr key={row.copyEntryId || row.label} className="hover:bg-[#141820]/30 transition-colors">
              <td className="py-3 px-4 max-w-[300px]">
                <div className="font-medium text-[#efe7db] truncate" title={row.hook}>{row.hook || row.label}</div>
                {row.caption && <div className="text-[11px] text-[#7f858d] truncate mt-0.5" title={row.caption}>{row.caption}</div>}
              </td>
              {renderSpendCell(row)}
              {renderResultsCell(row)}
              <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
              <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
              <td className="py-3 px-4 text-center">{row.batchCount}</td>
              <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
            </tr>
          )
        )}

        {/* Copy Angle Performance */}
        {renderCollapsibleTable(
          "angles",
          "Copy Angle Performance",
          copyAngles,
          ["Copy Angle (Strategy Type)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
          (row: CopyPerformanceRow) => (
            <tr key={row.label} className={`hover:bg-[#141820]/30 transition-colors ${row.label === "Unlinked" ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
              <td className="py-3 px-4 font-semibold text-[#efe7db]">
                {row.label}
                {row.label === "Unlinked" && <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>}
              </td>
              {renderSpendCell(row)}
              {renderResultsCell(row)}
              <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
              <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
              <td className="py-3 px-4 text-center">{row.batchCount}</td>
              <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
            </tr>
          )
        )}

        {/* Copy Song Section Performance */}
        {renderCollapsibleTable(
          "sections",
          "Copy Song Section Performance",
          songSections,
          ["Song Section (Target Part)", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
          (row: CopyPerformanceRow) => (
            <tr key={row.label} className={`hover:bg-[#141820]/30 transition-colors ${row.label === "Unlinked" ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
              <td className="py-3 px-4 font-semibold text-[#efe7db]">
                {row.label}
                {row.label === "Unlinked" && <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>}
              </td>
              {renderSpendCell(row)}
              {renderResultsCell(row)}
              <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
              <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
              <td className="py-3 px-4 text-center">{row.batchCount}</td>
              <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
            </tr>
          )
        )}

        {/* Copy + Song Section Combo Performance */}
        {renderCollapsibleTable(
          "combos",
          "Copy + Song Section Combo Performance",
          combos,
          ["Copy + Song Section Combo", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Outbound Clicks", "Batches", "Confidence"],
          (row: CopyPerformanceRow) => {
            const isUnlinked = row.label === "Unlinked";
            const plusIndex = row.label.lastIndexOf(" + ");
            const hookText = plusIndex !== -1 ? row.label.slice(0, plusIndex) : row.label;
            const songSec = plusIndex !== -1 ? row.label.slice(plusIndex + 3) : "";

            return (
              <tr key={row.copyEntryId ? `${row.copyEntryId}-${row.label}` : row.label} className={`hover:bg-[#141820]/30 transition-colors ${isUnlinked ? "bg-[#18120c]/25 border-l-2 border-amber-500/40" : ""}`}>
                <td className="py-3 px-4 text-xs max-w-[320px]">
                  {isUnlinked ? (
                    <>
                      <span className="font-semibold text-[#efe7db]">Unlinked</span>
                      <span className="ml-2 text-[10px] font-normal text-amber-400 italic">(requires linking)</span>
                    </>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[#efe7db] truncate block" title={hookText}>
                        {hookText || "Untitled Copy"}
                      </span>
                      {songSec && (
                        <span className="text-[10px] text-[#7f858d] uppercase tracking-wider block">
                          {songSec}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                {renderSpendCell(row)}
                {renderResultsCell(row)}
                <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
                <td className="py-3 px-4 text-right text-xs text-[#8a9098]">{formatNumber(row.outboundStreamingClicks)}</td>
                <td className="py-3 px-4 text-center">{row.batchCount}</td>
                <td className="py-3 px-4 text-xs font-semibold text-[#efe7db]">{row.confidenceScore}</td>
              </tr>
            );
          }
        )}

        {/* Unlinked Ads Summary */}
        {renderCollapsibleTable(
          "unlinked",
          `Unlinked Ads Summary (${unlinkedAds.length})`,
          unlinkedAds,
          ["Ad Name", "Spend", "Results", "CPR", "Link Clicks", "LP Views", "Batches"],
          (row: UnlinkedAdSummaryRow) => (
            <tr key={row.adName} className="hover:bg-[#141820]/30 transition-colors bg-[#18120c]/15">
              <td className="py-3 px-4 font-mono text-xs text-amber-200/90 truncate max-w-[280px]" title={row.adName}>{row.adName}</td>
              {renderSpendCell(row)}
              {renderResultsCell(row)}
              <td className="py-3 px-4 text-right font-medium text-[#efe7db]">{formatNullableCurrency(row.cpr)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.linkClicks)}</td>
              <td className="py-3 px-4 text-right">{formatNumber(row.landingPageViews)}</td>
              <td className="py-3 px-4 text-center">{row.batchCount}</td>
            </tr>
          )
        )}
      </div>
    </div>
  );

  function renderCollapsibleTable<T>(
    sectionKey: keyof typeof openSections,
    title: string,
    rows: T[],
    headers: string[],
    renderRow: (row: T) => React.ReactNode
  ) {
    const isOpen = openSections[sectionKey];
    if (rows.length === 0) return null;

    return (
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0c0f13] overflow-hidden">
        {/* Header Button */}
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0f1216] border-b border-[#2d3138] hover:bg-[#15191e] transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[#efe7db]">{title}</h4>
            <span className="rounded-full bg-[#1b1f24] text-[#8a9098] px-2 py-0.5 text-[10px] font-semibold">
              {rows.length} rows
            </span>
          </div>
          {isOpen ? <ChevronUp size={16} className="text-[#8a9098]" /> : <ChevronDown size={16} className="text-[#8a9098]" />}
        </button>

        {isOpen && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#aeb3bb]">
              <thead>
                <tr className="border-b border-[#20242b] text-[10px] uppercase tracking-wider text-[#7f858d] bg-[#0f1216]/50">
                  {headers.map((header, idx) => (
                    <th
                      key={header}
                      className={`py-2.5 px-4 font-semibold ${
                        idx === 0
                          ? ""
                          : header === "Batches"
                          ? "text-center"
                          : header === "Confidence"
                          ? ""
                          : "text-right"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20242b]">
                {rows.map((row) => renderRow(row))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}
