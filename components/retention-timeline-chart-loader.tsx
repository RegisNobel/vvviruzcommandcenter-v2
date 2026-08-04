"use client";

import dynamic from "next/dynamic";

import type {RetentionChartPayload} from "@/lib/analytics/retention-chart-contract";

const RetentionTimelineChart = dynamic(
  () => import("./retention-timeline-chart").then((module) => module.RetentionTimelineChart),
  {
    loading: () => (
      <div aria-live="polite" className="state-loading p-6" role="status">
        Loading audience timeline…
      </div>
    ),
    ssr: false
  }
);

export function RetentionTimelineChartLoader({payload}: {payload: RetentionChartPayload}) {
  return <RetentionTimelineChart payload={payload} />;
}
