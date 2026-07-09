"use client";

import React, { useState } from "react";
import type {
  AdPerformanceTimeline,
  CreativePerformanceMemory,
  CopyPerformanceMemory,
  ReleaseAdMetricsOverview
} from "@/lib/types";
import { CreativePerformanceMemorySection } from "./creative-performance-memory";
import { CopyPerformanceMemorySection } from "./copy-performance-memory";
import { AdPerformanceTimelineSection } from "./ad-performance-timeline";
import { Award, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface PerformanceMemorySectionProps {
  adMetrics: ReleaseAdMetricsOverview;
  timeline: AdPerformanceTimeline;
  creativeMemory: CreativePerformanceMemory;
  copyMemory: CopyPerformanceMemory;
  campaignControlAd?: string | null;
}

export function PerformanceMemorySection({
  adMetrics,
  timeline,
  creativeMemory,
  copyMemory,
  campaignControlAd
}: PerformanceMemorySectionProps) {
  const [activeTab, setActiveTab] = useState<"creative" | "copy" | "timeline">("timeline");

  const pageLabelClass = "table-label";

  const renderSummaryCard = (
    title: string,
    value: string | null | undefined,
    icon: React.ReactNode,
    extra?: React.ReactNode,
    warning?: string
  ) => {
    return (
      <div className="inset-surface flex min-h-[110px] flex-col justify-between p-4">
        <div>
          <div className="table-label flex items-center gap-1.5">
            {icon}
            {title}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink sm:text-base" title={value || "None Isolated"}>
            {value || "None Isolated"}
          </p>
        </div>
        <div className="mt-2">
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
    creativeMemory.visuals.length > 0 ||
    creativeMemory.songSections.length > 0 ||
    creativeMemory.revisions.length > 0 ||
    copyMemory.copyPairs.length > 0 ||
    copyMemory.copyAngles.length > 0 ||
    timeline.rows.length > 0;

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="command-surface space-y-6 px-4 py-5 sm:px-5">
      {/* Header */}
      <div>
        <p className={pageLabelClass}>Performance Memory</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">
          Consolidated Historical Insights
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Review what worked across ads, creative components, and copy strategy.
        </p>
      </div>

      {/* Top 5 Consolidated Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {renderSummaryCard(
          "Best Control Ad",
          adMetrics.best_ad?.ad_name,
          <Award size={12} className="text-emerald-400" />,
          adMetrics.best_ad ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(adMetrics.best_ad.cpr)} CPR &middot; {adMetrics.best_ad.results} results
            </p>
          ) : null
        )}

        {renderSummaryCard(
          "Best Visual",
          creativeMemory.bestVisual?.value,
          <Star size={12} className="text-amber-400" />,
          creativeMemory.bestVisual ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(creativeMemory.bestVisual.cpr)} CPR &middot; {creativeMemory.bestVisual.results} results
            </p>
          ) : null,
          creativeMemory.bestVisual?.warning
        )}

        {renderSummaryCard(
          "Best Song Section",
          creativeMemory.bestSongSection?.value,
          <Award size={12} className="text-purple-400" />,
          creativeMemory.bestSongSection ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(creativeMemory.bestSongSection.cpr)} CPR &middot; {creativeMemory.bestSongSection.results} results
            </p>
          ) : null,
          creativeMemory.bestSongSection?.warning
        )}

        {renderSummaryCard(
          "Best Copy Angle",
          copyMemory.winners.bestAngle?.label,
          <Award size={12} className="text-[#a78bfa]" />,
          copyMemory.winners.bestAngle ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(copyMemory.winners.bestAngle.cpr)} CPR &middot; {copyMemory.winners.bestAngle.results} results
            </p>
          ) : null
        )}

        {renderSummaryCard(
          "Best Copy Pair",
          copyMemory.winners.bestCopyPair?.label,
          <Star size={12} className="text-emerald-400" />,
          copyMemory.winners.bestCopyPair ? (
            <p className="text-xs text-[#8a9098]">
              {formatNullableCurrency(copyMemory.winners.bestCopyPair.cpr)} CPR &middot; {copyMemory.winners.bestCopyPair.results} results
            </p>
          ) : null
        )}
      </div>

      {/* Tabs Menu */}
      <div className="mobile-scroll-x flex gap-6 border-b border-edge pb-px">
        {[
          { key: "creative" as const, label: "Creative Component Memory" },
          { key: "copy" as const, label: "Copy Strategy Memory" },
          { key: "timeline" as const, label: "Ad Timeline" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "pb-3 text-xs font-semibold tracking-wide border-b-2 px-1 transition duration-150 outline-none uppercase whitespace-nowrap",
              activeTab === tab.key
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Panel (Unstyled wrapper to delegate container rendering to children) */}
      <div>
        {activeTab === "creative" && (
          <CreativePerformanceMemorySection
            memory={creativeMemory}
            hideSummaryCards
          />
        )}
        {activeTab === "copy" && (
          <CopyPerformanceMemorySection
            memory={copyMemory}
            hideSummaryCards
          />
        )}
        {activeTab === "timeline" && (
          <AdPerformanceTimelineSection
            timeline={timeline}
            campaignControlAd={campaignControlAd}
          />
        )}
      </div>
    </div>
  );
}
