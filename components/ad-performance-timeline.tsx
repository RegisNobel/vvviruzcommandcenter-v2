import React from "react";
import type { AdPerformanceTimeline, AdPerformanceSnapshot, AdPerformanceRow, AdPerformanceCell } from "@/lib/types";
import { AlertTriangle, TrendingUp, HelpCircle, Award, ArrowRight, UserMinus } from "lucide-react";

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
    return "—";
  }
  return formatCurrency(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(isoString: string | null) {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return isoString;
  }
}

interface AdPerformanceTimelineSectionProps {
  timeline: AdPerformanceTimeline;
}

export function AdPerformanceTimelineSection({ timeline }: AdPerformanceTimelineSectionProps) {
  const { snapshots, rows, hasOverlappingSnapshots } = timeline;

  const pageLabelClass = "text-xs font-semibold uppercase tracking-wider text-[#7f858d]";

  if (snapshots.length < 2) {
    return (
      <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-6 sm:px-5 space-y-4">
        <div>
          <p className={pageLabelClass}>Ad Performance Timeline</p>
          <h3 className="mt-2 text-xl font-semibold text-[#efe7db]">
            Chronological Ad Matrix
          </h3>
        </div>
        <div className="rounded-[20px] border border-dashed border-[#383c43] bg-[#101318] px-6 py-8 text-center text-sm leading-6 text-[#7f858d]">
          <p className="font-medium text-[#efe7db] mb-1">Timeline requires at least 2 snapshot uploads</p>
          <p className="max-w-md mx-auto">
            Upload and link additional Meta CSV reports in Ad Lab to track individual ad-level movement, rebounds, and winner changes over time.
          </p>
        </div>
      </div>
    );
  }

  const renderMovementBadge = (label: AdPerformanceCell["movementLabel"]) => {
    if (!label) return null;

    switch (label) {
      case "New Winner":
        return (
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
            New Winner
          </span>
        );
      case "Held Lead":
        return (
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-blue-500/40 bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 uppercase tracking-wider">
            Held Lead
          </span>
        );
      case "Rebounded":
        return (
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-purple-500/40 bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            Rebounded
          </span>
        );
      case "New Entrant":
        return (
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
            New Entrant
          </span>
        );
      case "Needs More Data":
        return (
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            Low Data
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-5 sm:px-5 space-y-6">
      <div>
        <p className={pageLabelClass}>Ad Performance Timeline</p>
        <h3 className="mt-2 text-xl font-semibold text-[#efe7db]">
          Ad-Level Movement Matrix
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
          Compare individual ad creatives side-by-side across chronological uploads to observe performance curves, lead handovers, and rebounds.
        </p>
      </div>

      {hasOverlappingSnapshots && (
        <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Snapshot-Based Timeline:</span> Multiple snapshot uploads have overlapping date ranges. Columns represent independent snapshots chronologically rather than summed lifetime totals.
          </div>
        </div>
      )}

      {/* Threshold Legend/Explanation */}
      <div className="rounded-[16px] border border-[#2d3138] bg-[#0c0f13] px-4 py-3 text-xs text-[#8a9098] flex flex-wrap gap-x-6 gap-y-2 items-center">
        <span className="font-semibold text-[#efe7db] flex items-center gap-1">
          <Award size={14} className="text-emerald-400" />
          Threshold Rules:
        </span>
        <span>
          Reliable winner requires spend <code className="text-[#efe7db] bg-[#1a1f26] px-1 py-0.5 rounded">&gt;= $10</code> and results <code className="text-[#efe7db] bg-[#1a1f26] px-1 py-0.5 rounded">&gt;= 5</code>.
        </span>
        <span>
          If no ad meets threshold, the snapshot displays <span className="text-[#e2e8f0] font-medium">No Reliable Winner</span> and notes the lowest-CPR low-data ad as a secondary variant.
        </span>
      </div>

      {/* Scrollable Matrix Table */}
      <div className="rounded-[18px] border border-[#2d3138] bg-[#0c0f13] overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#2d3138]">
          <table className="w-full text-left text-xs text-[#aeb3bb] border-collapse min-w-[800px]">
            <thead>
              {/* Main Snapshot Header Row */}
              <tr className="border-b border-[#20242b] bg-[#0f1216]">
                <th className="py-4 px-4 font-semibold text-sm text-[#efe7db] min-w-[240px] max-w-[320px] sticky left-0 bg-[#0f1216] z-10 border-r border-[#20242b]">
                  Ad Creative Name
                </th>
                {snapshots.map((snapshot) => (
                  <th key={snapshot.id} className="py-4 px-4 font-semibold min-w-[180px] align-top">
                    <div className="text-xs text-[#efe7db] truncate" title={snapshot.name}>
                      {snapshot.name}
                    </div>
                    <div className="text-[10px] text-[#7f858d] font-normal mt-1">
                      {snapshot.reportingStart && snapshot.reportingEnd ? (
                        <span>
                          {formatTimestamp(snapshot.reportingStart)} - {formatTimestamp(snapshot.reportingEnd)}
                        </span>
                      ) : (
                        <span>Snapshot Date Ranges Unknown</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#7f858d] font-normal mt-0.5">
                      Spend: {formatCurrency(snapshot.totalSpend)} &middot; Results: {snapshot.totalResults}
                    </div>
                  </th>
                ))}
              </tr>
              {/* Snapshot Winners & Notes Summary Row */}
              <tr className="border-b border-[#20242b] bg-[#10141b]">
                <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-[#7f858d] font-semibold sticky left-0 bg-[#10141b] z-10 border-r border-[#20242b]">
                  Snapshot Summary
                </th>
                {snapshots.map((snapshot) => {
                  return (
                    <th key={snapshot.id} className="py-3 px-4 font-normal text-left align-top space-y-1">
                      {snapshot.winnerAdName ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                            Winner: {snapshot.winnerAdName.length > 20 ? snapshot.winnerAdName.slice(0, 18) + "..." : snapshot.winnerAdName}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-500/15 border border-slate-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a9098] uppercase">
                            No Reliable Winner
                          </span>
                        </div>
                      )}

                      {/* Secondary Low Data Note */}
                      {snapshot.lowDataWinnerAdName && !snapshot.winnerAdName && (
                        <div className="text-[10px] text-[#8a9098] leading-tight">
                          <span className="font-medium text-[#cbbba0]">Low-Data Leader:</span> {snapshot.lowDataWinnerAdName.length > 18 ? snapshot.lowDataWinnerAdName.slice(0, 16) + "..." : snapshot.lowDataWinnerAdName}
                        </div>
                      )}

                      {/* Lost Lead Note */}
                      {snapshot.lostLeadAdName && (
                        <div className="text-[10px] text-amber-400/90 leading-tight font-medium flex items-center gap-0.5">
                          <UserMinus size={10} />
                          <span>Lost Lead: {snapshot.lostLeadAdName.length > 18 ? snapshot.lostLeadAdName.slice(0, 16) + "..." : snapshot.lostLeadAdName}</span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20242b]">
              {rows.map((row) => (
                <tr key={row.normalizedName} className="hover:bg-[#141820]/30 transition-colors">
                  {/* Ad name column pinned to left for premium horizontal scrolling */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#efe7db] sticky left-0 bg-[#0c0f13] z-10 border-r border-[#20242b] truncate max-w-[320px] shadow-[4px_0_8px_rgba(0,0,0,0.2)]">
                    {row.originalName}
                  </td>
                  {row.cells.map((cell, idx) => {
                    if (!cell) {
                      return (
                        <td key={idx} className="py-3.5 px-4 text-[#4a4f57] font-medium text-center">
                          —
                        </td>
                      );
                    }

                    return (
                      <td key={idx} className={`py-3.5 px-4 space-y-1.5 align-top ${cell.isSnapshotWinner ? "bg-emerald-500/5" : ""}`}>
                        {/* CPR */}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${cell.isSnapshotWinner ? "text-emerald-400" : "text-[#efe7db]"}`}>
                            {formatNullableCurrency(cell.cpr)}
                          </span>
                          <span className="text-[10px] text-[#7f858d]">CPR</span>
                        </div>

                        {/* Spend & Results */}
                        <div className="text-[10px] text-[#7f858d] leading-normal">
                          <span>{cell.results} results</span>
                          <span className="mx-1">&middot;</span>
                          <span>{formatCurrency(cell.spend)}</span>
                        </div>

                        {/* Confidence score */}
                        {cell.confidenceScore !== "No Signal" && (
                          <div className="text-[10px] text-purple-400 font-semibold leading-none">
                            {cell.confidenceScore}
                          </div>
                        )}

                        {/* Movement Badge */}
                        {cell.movementLabel && (
                          <div className="pt-0.5">
                            {renderMovementBadge(cell.movementLabel)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
